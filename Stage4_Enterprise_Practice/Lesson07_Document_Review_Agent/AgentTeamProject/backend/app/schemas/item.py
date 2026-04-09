from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class ReviewItemResponse(BaseModel):
    id: str
    session_id: str
    clause_text: str
    page_number: int
    paragraph_index: int
    highlight_anchor: str
    char_offset_start: int
    char_offset_end: int
    risk_level: str
    confidence_score: int
    source_type: str
    risk_category: str
    ai_finding: str
    ai_reasoning: str
    suggested_revision: Optional[str] = None
    human_decision: str
    human_note: Optional[str] = None
    human_edited_risk_level: Optional[str] = None
    human_edited_finding: Optional[str] = None
    is_false_positive: bool
    decided_by: Optional[str] = None
    decided_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReviewItemListResponse(BaseModel):
    items: list[ReviewItemResponse]
    total: int
    next_cursor: Optional[str] = None


class HITLDecisionRequest(BaseModel):
    decision: str  # confirmed / rejected / false_positive / approve
    note: Optional[str] = None
    human_note: Optional[str] = None  # alias for note, accepted for compatibility
    edited_risk_level: Optional[str] = None
    edited_finding: Optional[str] = None
    is_false_positive: bool = False

    @field_validator("decision")
    @classmethod
    def validate_decision(cls, v: str) -> str:
        # "approve" is mapped to "confirmed" for API compatibility
        if v == "approve":
            return "confirmed"
        allowed = {"confirmed", "rejected", "false_positive"}
        if v not in allowed:
            raise ValueError(f"decision must be one of {allowed | {'approve'}}")
        return v

    @field_validator("note")
    @classmethod
    def validate_note_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 1000:
            raise ValueError("note must not exceed 1000 characters")
        return v

    @field_validator("human_note")
    @classmethod
    def validate_human_note(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if len(v) < 10:
                from fastapi import HTTPException
                raise ValueError("HUMAN_NOTE_TOO_SHORT: human_note must be at least 10 characters")
            if len(v) > 1000:
                raise ValueError("human_note must not exceed 1000 characters")
        return v


class HITLDecisionResponse(BaseModel):
    item_id: str
    session_id: str
    decision: str
    decided_by: str
    decided_at: datetime
    message: str


class BatchConfirmRequest(BaseModel):
    item_ids: list[str]
    note: Optional[str] = None

    @field_validator("item_ids")
    @classmethod
    def validate_item_ids(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("item_ids must not be empty")
        if len(v) > 100:
            raise ValueError("Cannot batch confirm more than 100 items at once")
        return v


class BatchConfirmResponse(BaseModel):
    confirmed_count: int
    failed_count: int
    message: str
