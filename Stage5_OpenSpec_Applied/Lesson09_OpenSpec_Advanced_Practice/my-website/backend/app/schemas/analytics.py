from typing import Optional, List, Dict
from pydantic import BaseModel


class SessionCreate(BaseModel):
    duration_minutes: int
    date: str  # "YYYY-MM-DD"


class SessionResponse(BaseModel):
    id: str
    duration_minutes: int
    date: str

    model_config = {"from_attributes": True}


class CalendarResponse(BaseModel):
    year: int
    data: Dict[str, int]  # { "2026-01-15": 120 }


class StatsResponse(BaseModel):
    total_minutes: int
    streak_days: int
    sessions_count: int
    today_minutes: int


class AchievementResponse(BaseModel):
    type: str
    name: str
    description: str
    unlocked: bool
    unlocked_at: Optional[str] = None


class AchievementCheckResponse(BaseModel):
    newly_unlocked: List[str]
