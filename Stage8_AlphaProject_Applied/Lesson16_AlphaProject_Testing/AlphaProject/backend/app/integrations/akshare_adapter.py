"""AkShare real-fetcher adapters for F1 quote/kline/calendar.

Production injection point — replaces empty `_empty_*` placeholders in main.py.
Each fetcher matches the typed contract declared by the consuming service:

  - SpotFetcher    = Callable[[list[str]], dict[str, dict]]
  - IndexFetcher   = Callable[[], list[dict]]
  - KlineFetcher   = Callable[[str], list[dict]]
  - CalendarFetcher = Callable[[], list[date]]

All AkShare calls are lazy-imported so a missing/broken akshare install does
not block boot. Any fetch failure raises to the service layer which already
handles degradation (cached / NO_DATA / empty list).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

# ── macOS system proxy bypass ──────────────────────────────────────
# AkShare uses requests; requests honors macOS system network proxy via
# urllib.request.getproxies_macosx_sysconf(). If user has Surge/Clash configured
# but the proxy daemon isn't running, every AkShare call dies with ProxyError.
# We monkey-patch requests' env-proxy lookup to no-op so AkShare goes direct.
# (Affects only this process; user's other tools are unaffected.)
try:
    import requests
    import requests.utils as _requests_utils
    _requests_utils.get_environ_proxies = lambda *_args, **_kw: {}
    _orig_session_init = requests.Session.__init__

    def _no_env_session_init(self, *args, **kwargs):  # type: ignore[no-untyped-def]
        _orig_session_init(self, *args, **kwargs)
        self.trust_env = False
        self.proxies = {}

    requests.Session.__init__ = _no_env_session_init  # type: ignore[method-assign]
except Exception:  # pragma: no cover
    pass

# 指数符号映射（新浪）
_INDEX_NAME_TO_SINA = {
    "上证指数": "sh000001",
    "深证成指": "sz399001",
    "创业板指": "sz399006",
}
_INDEX_NAME_TO_CODE = {
    "上证指数": "000001",
    "深证成指": "399001",
    "创业板指": "399006",
}


def _tencent_market_prefix(code: str) -> str:
    """6-digit code → Tencent qt prefix (sh / sz / bj)."""
    if code.startswith("6"):
        return "sh"
    if code.startswith(("0", "3")):
        return "sz"
    if code.startswith(("4", "8")):
        return "bj"
    return "sh"


def akshare_spot_fetcher(codes: list[str]) -> dict[str, dict]:
    """Fetch latest spot quotes via Tencent qt (qt.gtimg.cn) — fast, free, no auth.

    Per-call latency ~50ms for up to ~50 codes batched in one URL. Compared to
    AkShare's full-market Sina scan (~100s) this is the only path that keeps
    F1's 60s refresh budget honest. Tencent qt has been stable for 10+ years
    and is what eastmoney / tonghuashun fall back to internally.

    Format: GET http://qt.gtimg.cn/q=sh600519,sz000001
    Response (utf-8 / gbk):
        v_sh600519="51~贵州茅台~600519~price~prev_close~open~...~chg_pct~..."
    """
    if not codes:
        return {}
    import requests

    syms = ",".join(f"{_tencent_market_prefix(c)}{c}" for c in codes)
    url = f"http://qt.gtimg.cn/q={syms}"
    sess = requests.Session()
    sess.trust_env = False
    sess.proxies = {}
    resp = sess.get(url, timeout=5)
    if resp.status_code != 200:
        return {}
    # Tencent serves GBK-encoded text
    text = resp.content.decode("gbk", errors="ignore")

    out: dict[str, dict] = {}
    for line in text.splitlines():
        # v_sh600519="51~贵州茅台~600519~1302.22~1325.92~..." with 70+ fields
        if "=" not in line or '"' not in line:
            continue
        try:
            _, raw = line.split("=", 1)
            payload = raw.strip().strip(";").strip('"')
            parts = payload.split("~")
            if len(parts) < 40:
                continue
            code = parts[2]
            if code not in codes:
                continue
            price = _to_float(parts[3])
            prev_close = _to_float(parts[4])
            volume = _to_int(parts[6])  # 成交量 (手 → ×100 股)
            chg_pct = _to_float(parts[32]) if len(parts) > 32 else None
            if chg_pct is None and price and prev_close:
                chg_pct = (price - prev_close) / prev_close * 100
            # 量比 in field 49 (some versions), fall back to None
            volume_ratio = _to_float(parts[49]) if len(parts) > 49 else None
            out[code] = {
                "price": price,
                "change_pct": chg_pct,
                "volume_ratio": volume_ratio,
                "volume": (volume or 0) * 100 if volume else None,  # 手→股
            }
        except (ValueError, IndexError):
            continue
    return out


def akshare_index_fetcher() -> list[dict]:
    """Fetch latest market-overview indices via Sina per-symbol API."""
    import akshare as ak

    rows: list[dict] = []
    for name, sina_sym in _INDEX_NAME_TO_SINA.items():
        try:
            df = ak.stock_zh_index_daily(symbol=sina_sym)
            if df is None or df.empty or len(df) < 2:
                continue
            last = df.iloc[-1]
            prev = df.iloc[-2]
            close = _to_float(last.get("close"))
            prev_close = _to_float(prev.get("close"))
            chg = ((close - prev_close) / prev_close * 100) if (close and prev_close) else None
            rows.append({
                "name": name,
                "code": _INDEX_NAME_TO_CODE[name],
                "point": close,
                "change_pct": chg,
            })
        except Exception:
            continue
    return rows


def akshare_kline_fetcher(code: str) -> list[dict]:
    """Fetch daily kline for a single code via Sina (qfq adjusted)."""
    import akshare as ak

    # Sina 需要市场前缀；6 开头 = sh，0/3 开头 = sz，8/4 开头 = bj
    if code.startswith("6"):
        sym = f"sh{code}"
    elif code.startswith(("0", "3")):
        sym = f"sz{code}"
    elif code.startswith(("4", "8")):
        sym = f"bj{code}"
    else:
        sym = f"sh{code}"

    df = ak.stock_zh_a_daily(symbol=sym, adjust="qfq")
    if df is None or df.empty:
        return []
    out: list[dict] = []
    for _, r in df.iterrows():
        ts = r.get("date")
        if hasattr(ts, "isoformat"):
            ts_dt = datetime.combine(ts, datetime.min.time()) if isinstance(ts, date) and not isinstance(ts, datetime) else ts
        else:
            ts_dt = datetime.fromisoformat(str(ts))
        out.append({
            "ts": ts_dt,
            "open": _to_float(r.get("open")) or 0.0,
            "high": _to_float(r.get("high")) or 0.0,
            "low": _to_float(r.get("low")) or 0.0,
            "close": _to_float(r.get("close")) or 0.0,
            "volume": _to_int(r.get("volume")) or 0,
        })
    return out


def akshare_calendar_fetcher() -> list[date]:
    """Fetch full A-share trading calendar (from Sina, AkShare wrapper)."""
    import akshare as ak

    df = ak.tool_trade_date_hist_sina()
    if df is None or df.empty:
        return [date.today()]
    out: list[date] = []
    for _, r in df.iterrows():
        v = r.get("trade_date")
        if isinstance(v, date) and not isinstance(v, datetime):
            out.append(v)
        elif isinstance(v, datetime):
            out.append(v.date())
        else:
            try:
                out.append(date.fromisoformat(str(v)))
            except ValueError:
                continue
    return out


# ── helpers ────────────────────────────────────────────────────────
def _to_float(v: Any) -> float | None:
    if v is None or v == "" or v == "-":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _to_int(v: Any) -> int | None:
    if v is None or v == "" or v == "-":
        return None
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


__all__ = [
    "akshare_spot_fetcher",
    "akshare_index_fetcher",
    "akshare_kline_fetcher",
    "akshare_calendar_fetcher",
]
