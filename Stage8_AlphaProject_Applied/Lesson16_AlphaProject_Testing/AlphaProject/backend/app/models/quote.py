"""F1 T004 — Quote / index / kline models.

Used by quote_service, kline_service, /quotes API, and AnomalyService (T002 +
inherited from F2 AnomalyService.quote_fetcher contract).
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict


class DataStatus(str, Enum):
    NORMAL = "normal"
    SUSPENDED = "suspended"
    NO_DATA = "no_data"
    STALE = "stale"


class QuoteSnapshot(BaseModel):
    model_config = ConfigDict(use_enum_values=False)

    code: str
    price: float | None
    change_pct: float | None
    volume_ratio: float | None
    volume: int | None
    updated_at: datetime
    status: DataStatus = DataStatus.NORMAL


class MarketIndex(BaseModel):
    name: str
    code: str
    point: float | None
    change_pct: float | None
    updated_at: datetime
    status: DataStatus = DataStatus.NORMAL


class KlinePoint(BaseModel):
    ts: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int


__all__ = ["DataStatus", "QuoteSnapshot", "MarketIndex", "KlinePoint"]
