import uuid
import json
from datetime import datetime

from sqlalchemy import String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String(36), index=True)
    event_type: Mapped[str] = mapped_column(String(50))
    actor_id: Mapped[str] = mapped_column(String(36), default="system")
    actor_type: Mapped[str] = mapped_column(String(10), default="system")  # user/system
    occurred_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")

    @property
    def metadata_dict(self) -> dict:
        return json.loads(self.metadata_json)
