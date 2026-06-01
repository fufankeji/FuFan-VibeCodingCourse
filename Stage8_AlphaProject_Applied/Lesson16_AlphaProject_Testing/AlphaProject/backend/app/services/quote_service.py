"""F1 T002 — Quote service (spot + indices).

Wraps AkShare-like fetchers behind injectable callables for testability.
Caches last-known-good snapshots and degrades gracefully:
  - Source raises → return cached value (marked STALE if past threshold).
  - Source returns no row for a code → status=NO_DATA (preserved as suspended-like).
  - Within stale threshold + source fail → keep previous status (NORMAL).
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime

from app.models.quote import DataStatus, MarketIndex, QuoteSnapshot

SpotFetcher = Callable[[list[str]], dict[str, dict]]
IndexFetcher = Callable[[], list[dict]]
Clock = Callable[[], datetime]


class QuoteService:
    def __init__(
        self,
        *,
        spot_fetcher: SpotFetcher,
        index_fetcher: IndexFetcher,
        clock: Clock = datetime.now,
        stale_threshold_s: int = 120,
    ) -> None:
        self._spot_fetcher = spot_fetcher
        self._index_fetcher = index_fetcher
        self._clock = clock
        self._stale_threshold_s = stale_threshold_s
        self._cache: dict[str, QuoteSnapshot] = {}
        self._index_cache: list[MarketIndex] = []

    def get_snapshots(self, codes: list[str]) -> dict[str, QuoteSnapshot]:
        now = self._clock()
        try:
            raw = self._spot_fetcher(codes)
        except Exception:
            raw = None

        result: dict[str, QuoteSnapshot] = {}
        for code in codes:
            if raw is not None and code in raw:
                row = raw[code]
                snap = QuoteSnapshot(
                    code=code,
                    price=row.get("price"),
                    change_pct=row.get("change_pct"),
                    volume_ratio=row.get("volume_ratio"),
                    volume=row.get("volume"),
                    updated_at=now,
                    status=DataStatus.NORMAL,
                )
                self._cache[code] = snap
                result[code] = snap
            elif raw is not None and code not in raw:
                # Source responded; this code missing → NO_DATA (suspended/delisted)
                snap = QuoteSnapshot(
                    code=code,
                    price=None,
                    change_pct=None,
                    volume_ratio=None,
                    volume=None,
                    updated_at=now,
                    status=DataStatus.NO_DATA,
                )
                result[code] = snap
            else:
                # Fetch failed entirely → degrade from cache
                cached = self._cache.get(code)
                if cached is None:
                    result[code] = QuoteSnapshot(
                        code=code,
                        price=None,
                        change_pct=None,
                        volume_ratio=None,
                        volume=None,
                        updated_at=now,
                        status=DataStatus.NO_DATA,
                    )
                else:
                    age_s = (now - cached.updated_at).total_seconds()
                    status = DataStatus.STALE if age_s > self._stale_threshold_s else cached.status
                    result[code] = cached.model_copy(update={"status": status})
        return result

    def get_indices(self) -> list[MarketIndex]:
        now = self._clock()
        try:
            raw = self._index_fetcher()
        except Exception:
            return list(self._index_cache)

        out: list[MarketIndex] = []
        for row in raw:
            out.append(
                MarketIndex(
                    name=row["name"],
                    code=row["code"],
                    point=row.get("point"),
                    change_pct=row.get("change_pct"),
                    updated_at=now,
                    status=DataStatus.NORMAL,
                )
            )
        self._index_cache = out
        return out


__all__ = ["QuoteService", "SpotFetcher", "IndexFetcher"]
