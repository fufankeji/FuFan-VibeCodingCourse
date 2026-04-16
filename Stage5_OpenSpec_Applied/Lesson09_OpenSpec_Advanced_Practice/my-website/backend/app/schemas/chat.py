from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_serializer


class CreateConversationRequest(BaseModel):
    title: Optional[str] = None


class ConversationResponse(BaseModel):
    id: str
    title: str
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at")
    @classmethod
    def serialize_dt(cls, v: datetime) -> str:
        return v.isoformat() if v else ""


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at")
    @classmethod
    def serialize_dt(cls, v: datetime) -> str:
        return v.isoformat() if v else ""


class SendMessageRequest(BaseModel):
    content: str
