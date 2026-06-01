from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class WatchlistGroup(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id: int | None = None
    name: str = Field(min_length=1, max_length=20)
    created_at: datetime = Field(default_factory=datetime.now)


class WatchlistItem(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    code: str = Field(min_length=1, max_length=10)
    name: str = Field(min_length=1, max_length=50)
    group_id: int | None = None
    is_holding: bool = False
    display_order: int = 0
    joined_at: datetime = Field(default_factory=datetime.now)
    deleted_at: datetime | None = None
