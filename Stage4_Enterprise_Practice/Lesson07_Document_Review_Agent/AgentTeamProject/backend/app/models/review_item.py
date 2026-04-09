import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ReviewItem(Base):
    __tablename__ = "review_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String(36), index=True)

    # Source text
    clause_text: Mapped[str] = mapped_column(Text)
    page_number: Mapped[int] = mapped_column(Integer, default=1)
    paragraph_index: Mapped[int] = mapped_column(Integer, default=0)
    highlight_anchor: Mapped[str] = mapped_column(String(100), default="")
    char_offset_start: Mapped[int] = mapped_column(Integer, default=0)
    char_offset_end: Mapped[int] = mapped_column(Integer, default=0)

    # AI judgment
    risk_level: Mapped[str] = mapped_column(String(10))  # HIGH/MEDIUM/LOW
    confidence_score: Mapped[int] = mapped_column(Integer, default=50)
    source_type: Mapped[str] = mapped_column(String(20), default="ai_inference")  # rule_engine/ai_inference/hybrid
    risk_category: Mapped[str] = mapped_column(String(100), default="")
    ai_finding: Mapped[str] = mapped_column(Text, default="")
    ai_reasoning: Mapped[str] = mapped_column(Text, default="")
    suggested_revision: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Human decision
    human_decision: Mapped[str] = mapped_column(String(20), default="pending")
    human_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    human_edited_risk_level: Mapped[str | None] = mapped_column(String(10), nullable=True)
    human_edited_finding: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_false_positive: Mapped[bool] = mapped_column(Boolean, default=False)
    decided_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
