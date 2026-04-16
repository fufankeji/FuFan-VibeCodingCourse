from typing import Optional

from pydantic import BaseModel


class UserProfile(BaseModel):
    id: str
    email: str
    avatar_url: str
    streak_days: int
    level: int

    model_config = {"from_attributes": True}


class UserProfileUpdate(BaseModel):
    avatar_url: Optional[str] = None
    streak_days: Optional[int] = None
    level: Optional[int] = None
