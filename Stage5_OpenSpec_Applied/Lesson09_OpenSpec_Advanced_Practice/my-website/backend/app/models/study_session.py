import uuid
import datetime as dt

from sqlalchemy import String, Integer, Date, DateTime, ForeignKey, Column
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow():
    return dt.datetime.now(dt.timezone.utc)


class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    duration_minutes = Column(Integer, nullable=False)
    date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
