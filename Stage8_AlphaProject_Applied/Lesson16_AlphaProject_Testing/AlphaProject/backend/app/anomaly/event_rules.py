"""T007 — 事件规则：电报 / 公告关键词匹配自选股.

匹配优先级：代码 > 全称（≥3 字符避免误命中）。MVP 接受一定噪声.
- 电报：在自选清单上全局扫一遍
- 公告：按股拉取（news_source.fetch_announcements(code) 已存在）→ 任意一条即作事件

关键词必须由调用方提供有意义的 name（≥3 字）；过短 name 跳过名称匹配.
"""

from __future__ import annotations

from typing import Any, Protocol

from app.models.anomaly import AnomalySignal, AnomalyType
from app.models.explain import NewsItem

_MIN_NAME_LEN = 3


class _NewsSource(Protocol):
    def fetch_telegraph(self) -> list[NewsItem]: ...
    def fetch_announcements(self, code: str) -> list[NewsItem]: ...


def _matches_telegraph(item: NewsItem, code: str, name: str) -> bool:
    text = item.title or ""
    if code and code in text:
        return True
    if name and len(name) >= _MIN_NAME_LEN and name in text:
        return True
    return False


def detect_events(
    watchlist: list[dict[str, Any]],
    *,
    news_source: _NewsSource,
) -> list[AnomalySignal]:
    """Return one AnomalySignal per (stock, hit) — dedup per stock by title."""
    out: list[AnomalySignal] = []
    seen: set[tuple[str, str]] = set()

    try:
        telegraph = news_source.fetch_telegraph() or []
    except Exception:
        telegraph = []

    for w in watchlist:
        code = str(w.get("code", ""))
        name = str(w.get("name", ""))
        is_holding = bool(w.get("is_holding", False))

        # 电报全局扫
        for item in telegraph:
            if _matches_telegraph(item, code, name):
                key = (code, item.title)
                if key in seen:
                    continue
                seen.add(key)
                out.append(AnomalySignal(
                    code=code, name=name, anomaly_type=AnomalyType.EVENT,
                    is_holding=is_holding, event_title=item.title,
                ))
                break  # one event per stock per cycle suffices

        # 公告按股拉
        try:
            anns = news_source.fetch_announcements(code) or []
        except Exception:
            anns = []
        for item in anns:
            key = (code, item.title)
            if key in seen:
                continue
            seen.add(key)
            out.append(AnomalySignal(
                code=code, name=name, anomaly_type=AnomalyType.EVENT,
                is_holding=is_holding, event_title=item.title,
            ))
            break

    return out


__all__ = ["detect_events"]
