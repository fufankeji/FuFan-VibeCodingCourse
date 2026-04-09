from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ExtractedFieldResponse(BaseModel):
    id: str
    session_id: str
    field_name: str
    field_value: str
    original_value: str
    confidence_score: int
    needs_human_verification: bool
    verification_status: str
    source_evidence_text: str
    source_page_number: int
    source_char_offset_start: int
    source_char_offset_end: int
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    verified_value: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class FieldListResponse(BaseModel):
    items: list[ExtractedFieldResponse]
    total: int


class FieldVerifyRequest(BaseModel):
    verified_value: str
    verification_note: Optional[str] = None


class FieldVerifyResponse(BaseModel):
    id: str
    field_name: str
    verified_value: str
    verification_status: str
    verified_by: str
    verified_at: datetime
    message: str
