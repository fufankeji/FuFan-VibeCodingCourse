import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ReviewSession(Base):
    __tablename__ = "review_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    contract_id: Mapped[str] = mapped_column(String(36))
    state: Mapped[str] = mapped_column(String(20), default="parsing")
    hitl_subtype: Mapped[str | None] = mapped_column(String(20), nullable=True)
    langgraph_thread_id: Mapped[str] = mapped_column(String(100), default=lambda: str(uuid.uuid4()))
    is_scanned_document: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[str] = mapped_column(String(36), default="anonymous")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Progress counters (precomputed for performance)
    total_high_risk: Mapped[int] = mapped_column(default=0)
    decided_high_risk: Mapped[int] = mapped_column(default=0)
    total_medium_risk: Mapped[int] = mapped_column(default=0)
    total_low_risk: Mapped[int] = mapped_column(default=0)
