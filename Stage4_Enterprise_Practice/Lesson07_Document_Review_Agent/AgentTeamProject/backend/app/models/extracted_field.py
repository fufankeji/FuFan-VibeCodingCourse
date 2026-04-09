import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ExtractedField(Base):
    __tablename__ = "extracted_fields"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String(36), index=True)
    field_name: Mapped[str] = mapped_column(String(100))
    field_value: Mapped[str] = mapped_column(Text, default="")
    original_value: Mapped[str] = mapped_column(Text, default="")
    confidence_score: Mapped[int] = mapped_column(Integer, default=50)
    needs_human_verification: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_status: Mapped[str] = mapped_column(String(20), default="unverified")
    source_evidence_text: Mapped[str] = mapped_column(Text, default="")
    source_page_number: Mapped[int] = mapped_column(Integer, default=1)
    source_char_offset_start: Mapped[int] = mapped_column(Integer, default=0)
    source_char_offset_end: Mapped[int] = mapped_column(Integer, default=0)
    verified_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    verified_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
