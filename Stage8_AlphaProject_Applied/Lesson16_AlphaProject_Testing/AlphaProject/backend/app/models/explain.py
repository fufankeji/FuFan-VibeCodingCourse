"""F3 explain schemas (004-T003).

Aligned with F2 anomaly badge enum + Dashboard "为什么" on-demand call.
"""
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class AnomalyType(str, Enum):
    """Anomaly categories used in F2 badges + the F1 Dashboard summary call."""

    LIMIT_UP = "limit_up"
    LIMIT_DOWN = "limit_down"
    BREAKOUT = "breakout"          # 突破前 60 日新高
    BREAKDOWN = "breakdown"        # 跌破前 60 日新低 / 涵盖向下
    VOLUME = "volume"              # 量能异常
    SUMMARY = "summary"            # 无显著异动时的"今日表现综述"（按需）


class ResultSource(str, Enum):
    LLM_PRIMARY = "llm_primary"
    LLM_BACKUP = "llm_backup"
    LLM_LOCAL = "llm_local"
    TEMPLATE = "template"


class ExplainRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    code: str = Field(min_length=1, max_length=10)
    name: str = Field(min_length=1, max_length=50)
    anomaly_type: AnomalyType
    price: float
    change_pct: float
    volume_ratio: float | None = None
    on_demand: bool = False


class NewsItem(BaseModel):
    title: str
    published_at: str | None = None


class ExplainContext(BaseModel):
    sector: str | None = None
    sector_change_pct: float | None = None
    industry: str | None = None
    news: list[NewsItem] = Field(default_factory=list)
    announcements: list[NewsItem] = Field(default_factory=list)
    partial: bool = False  # True → 上下文部分缺失（标"信息不全"）
    empty: bool = False    # True → 含行情都缺失（拒绝生成）


class ExplainResult(BaseModel):
    text: str
    source: ResultSource
    partial: bool = False
    generated_at: datetime = Field(default_factory=datetime.now)
