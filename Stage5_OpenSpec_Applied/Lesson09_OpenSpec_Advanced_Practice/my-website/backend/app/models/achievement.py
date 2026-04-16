import uuid
import datetime as dt

from sqlalchemy import String, DateTime, ForeignKey, UniqueConstraint, Column

from app.database import Base


def _utcnow():
    return dt.datetime.now(dt.timezone.utc)


ACHIEVEMENT_DEFINITIONS = [
    {"type": "first-session", "name": "初次学习", "description": "完成第 1 次学习记录"},
    {"type": "streak-7", "name": "坚持一周", "description": "连续学习 7 天"},
    {"type": "streak-30", "name": "月度达人", "description": "连续学习 30 天"},
    {"type": "hours-10", "name": "学习 10 小时", "description": "累计学习 ≥ 600 分钟"},
    {"type": "hours-100", "name": "百小时达人", "description": "累计学习 ≥ 6000 分钟"},
]


class UserAchievement(Base):
    __tablename__ = "user_achievements"
    __table_args__ = (UniqueConstraint("user_id", "type", name="uq_user_achievement"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String, nullable=False)
    unlocked_at = Column(DateTime(timezone=True), default=_utcnow)
