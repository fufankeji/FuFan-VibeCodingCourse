from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ProgressSummary(BaseModel):
    total_high_risk: int
    decided_high_risk: int
    total_medium_risk: int
    total_low_risk: int
    pending_high_risk: int
    completion_percent: float


class ReviewSessionResponse(BaseModel):
    id: str
    contract_id: str
    state: str
    hitl_subtype: Optional[str] = None
    langgraph_thread_id: str
    is_scanned_document: bool
    created_by: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    updated_at: datetime
    progress_summary: ProgressSummary

    model_config = {"from_attributes": True}


class SessionRecoveryResponse(BaseModel):
    session_id: str
    state: str
    last_updated: datetime
    pending_high_risk_count: int
    resumable: bool
    message: str


class AbortRequest(BaseModel):
    reason: Optional[str] = None
