"""F1 T003 — Kline service (daily K-line fetch).

Wraps AkShare daily-kline calls behind an injectable fetcher. Failure-tolerant:
when source raises, returns an empty list rather than propagating (so F1 detail
page can render base quote + a friendly "K 线加载失败" hint).

Also exposes `recent_closes(code, n)` consumed by F2 breakout/breakdown rules
(kline_fetcher contract from anomaly_service).
"""

from __future__ import annotations

from collections.abc import Callable

from app.models.quote import KlinePoint

KlineFetcher = Callable[[str], list[dict]]


class KlineService:
    def __init__(self, *, fetcher: KlineFetcher) -> None:
        self._fetcher = fetcher

    def get_daily(self, code: str) -> list[KlinePoint]:
        try:
            rows = self._fetcher(code)
        except Exception:
            return []
        return [KlinePoint(**row) for row in rows]

    def recent_closes(self, code: str, n: int) -> list[float]:
        pts = self.get_daily(code)
        if not pts:
            return []
        return [p.close for p in pts[-n:]]


__all__ = ["KlineService", "KlineFetcher"]
