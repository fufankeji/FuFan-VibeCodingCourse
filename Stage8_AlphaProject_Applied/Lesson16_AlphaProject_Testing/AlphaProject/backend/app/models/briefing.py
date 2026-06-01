"""F4 T003 — briefing data models.

spec §5 Key Entities:
  BriefingContent  → 4 区块聚合 + 正文 + 版本
  DataBlock        → 单区块数据 + 状态（就绪/获取中/暂无）
  BriefingRecord   → 历史归档
"""
from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.config import settings


class BlockStatus(str, Enum):
    ready = "ready"
    loading = "loading"     # "数据获取中" (上游正在拉, 9:15 未到)
    missing = "missing"     # "暂无数据" (上游失败)


class BriefingVersion(str, Enum):
    warmup = "warmup"           # 9:15 预热版（部分区块）
    full = "full"               # 9:18 完整版
    raw = "raw"                 # LLM 超时 → 裸数据
    placeholder = "placeholder" # 全数据源失败 → 占位


class DataBlock(BaseModel):
    name: str
    data: Any | None = None
    status: BlockStatus = BlockStatus.ready


class BriefingContent(BaseModel):
    market_overview: DataBlock
    watchlist: DataBlock
    news: DataBlock
    calendar: DataBlock
    body_text: str = Field(default="", description="LLM 生成的正文 / 裸数据 / 占位文案")
    version: BriefingVersion

    @field_validator("body_text")
    @classmethod
    def _cap_body(cls, v: str) -> str:
        if len(v) > settings.BRIEFING_BODY_LIMIT:
            raise ValueError(
                f"body_text exceeds {settings.BRIEFING_BODY_LIMIT} chars (got {len(v)})"
            )
        return v


class BriefingRecord(BaseModel):
    on_date: str  # ISO yyyy-mm-dd
    content_json: str
    version: BriefingVersion
    push_status: str  # delivered / failed / muted / paused
