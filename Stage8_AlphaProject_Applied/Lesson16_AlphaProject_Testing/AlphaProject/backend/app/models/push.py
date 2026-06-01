"""F6 推送通道 · 数据模型 (002-T003).

spec §5 Key Entities — PushRequest / PushLog / UndeliveredItem.
"""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class Priority(str, Enum):
    """spec §6 — 优先级由上游传入, F6 不查 F5."""

    holding = "holding"  # 持仓: 绕过 dedup
    watch = "watch"  # 自选
    system = "system"  # 简报/系统通知


class MsgType(str, Enum):
    """spec FR-002 — IM OpenAPI msg_type."""

    text = "text"
    interactive = "interactive"


class PushRequest(BaseModel):
    """上游 (F2/F3/F4) 提交的推送意图. spec §5."""

    msg_type: MsgType
    content: dict[str, Any]
    priority: Priority
    # dedup 键 = code + signal (FR-006)
    code: str | None = None
    signal: str | None = None
    # 默认 None = 走 settings 配置的单一接收目标
    receive_id: str | None = None
    receive_id_type: str | None = None


class PushLog(BaseModel):
    """每次推送结果 (FR-013, 保留 ≥90 天)."""

    id: int | None = None
    ts: str
    status: str = Field(description="delivered|failed|muted|deduped|merged")
    retries: int = 0
    target: str | None = None
    code: str | None = None
    signal: str | None = None
    uuid: str | None = None
    error: str | None = None


class UndeliveredItem(BaseModel):
    """重试耗尽后入队 (FR-009)."""

    id: int | None = None
    uuid: str
    request_json: str
    fail_count: int = 0
    queued_at: str
    is_holding: bool = False
