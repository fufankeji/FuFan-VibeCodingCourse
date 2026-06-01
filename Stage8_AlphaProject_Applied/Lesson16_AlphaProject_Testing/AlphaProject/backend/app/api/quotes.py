"""F1 T005 — /quotes REST API.

Routes:
  GET /quotes/snapshot     — merged watchlist × quote rows + session label
  GET /quotes/indices      — three market indices (上证/深证/创业板)
  GET /quotes/kline/{code} — daily kline points

Frontend contract:
  - snapshot.rows[*] = {code, name, price, change_pct, volume_ratio, volume,
                       updated_at, status, is_holding, group_id, display_order}
  - sorted server-side as raw watchlist order (持仓优先 sort done client-side
    in dashboardStore for ergonomic re-sort on user toggle).
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models.quote import KlinePoint, MarketIndex, QuoteSnapshot
from app.services.kline_service import KlineService
from app.services.quote_service import QuoteService
from app.services.trading_calendar import TradingCalendar
from app.services.watchlist_service import WatchlistService


def build_quotes_router(
    *,
    watchlist_service: WatchlistService,
    quote_service: QuoteService,
    kline_service: KlineService,
    calendar: TradingCalendar,
    clock: Callable[[], datetime] = datetime.now,
) -> APIRouter:
    router = APIRouter(prefix="/quotes", tags=["quotes"])

    @router.get("/snapshot")
    def snapshot() -> dict:
        items = watchlist_service.snapshot()  # list[dict]
        codes = [it["code"] for it in items]
        quotes = quote_service.get_snapshots(codes) if codes else {}
        rows = []
        for it in items:
            q: QuoteSnapshot | None = quotes.get(it["code"])
            rows.append(
                {
                    "code": it["code"],
                    "name": it["name"],
                    "is_holding": it["is_holding"],
                    "group_id": it["group_id"],
                    "display_order": it["display_order"],
                    "price": q.price if q else None,
                    "change_pct": q.change_pct if q else None,
                    "volume_ratio": q.volume_ratio if q else None,
                    "volume": q.volume if q else None,
                    "updated_at": q.updated_at.isoformat() if q else None,
                    "status": q.status.value if q else "no_data",
                }
            )
        return {
            "rows": rows,
            "session_label": calendar.session_label(clock()),
            "fetched_at": clock().isoformat(),
        }

    @router.get("/indices")
    def indices() -> list[dict]:
        return [idx.model_dump(mode="json") for idx in quote_service.get_indices()]

    @router.get("/kline/{code}")
    def kline(code: str) -> list[dict]:
        return [p.model_dump(mode="json") for p in kline_service.get_daily(code)]

    @router.get("/sparklines")
    def sparklines(n: int = 30) -> dict[str, list[float]]:
        """Batch endpoint: 最近 n 个收盘价，按自选股全集返回。失败的 code 返回空列表。"""
        items = watchlist_service.snapshot()
        out: dict[str, list[float]] = {}
        for it in items:
            code = it["code"]
            try:
                out[code] = kline_service.recent_closes(code, n)
            except Exception:
                out[code] = []
        return out

    return router


__all__ = ["build_quotes_router"]
