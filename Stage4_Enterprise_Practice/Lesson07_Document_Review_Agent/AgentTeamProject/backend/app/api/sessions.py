import asyncio
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.sse import sse_manager
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.contract import Contract
from app.models.review_item import ReviewItem
from app.models.session import ReviewSession
from app.schemas.session import (
    AbortRequest,
    ProgressSummary,
    ReviewSessionResponse,
    SessionRecoveryResponse,
)

router = APIRouter()


def _build_progress_summary(session: ReviewSession) -> ProgressSummary:
    total_high = session.total_high_risk
    decided_high = session.decided_high_risk
    pending = max(0, total_high - decided_high)
    total = total_high + session.total_medium_risk + session.total_low_risk
    completion_percent = round((decided_high / total_high * 100) if total_high > 0 else 0.0, 1)
    return ProgressSummary(
        total_high_risk=total_high,
        decided_high_risk=decided_high,
        total_medium_risk=session.total_medium_risk,
        total_low_risk=session.total_low_risk,
        pending_high_risk=pending,
        completion_percent=completion_percent,
    )


@router.get("/{session_id}", response_model=ReviewSessionResponse)
def get_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(ReviewSession).filter(ReviewSession.id == session_id).first()
    if not session:
        raise APIError.not_found("ReviewSession")

    data = {
        "id": session.id,
        "contract_id": session.contract_id,
        "state": session.state,
        "hitl_subtype": session.hitl_subtype,
        "langgraph_thread_id": session.langgraph_thread_id,
        "is_scanned_document": session.is_scanned_document,
        "created_by": session.created_by,
        "created_at": session.created_at,
        "completed_at": session.completed_at,
        "updated_at": session.updated_at,
        "progress_summary": _build_progress_summary(session),
    }
    return ReviewSessionResponse(**data)


@router.get("/{session_id}/recovery", response_model=SessionRecoveryResponse)
def get_session_recovery(session_id: str, db: Session = Depends(get_db)):
    session = db.query(ReviewSession).filter(ReviewSession.id == session_id).first()
    if not session:
        raise APIError.not_found("ReviewSession")

    pending_high = max(0, session.total_high_risk - session.decided_high_risk)
    resumable = session.state in {"hitl_high_risk", "hitl_field_verify", "hitl_medium_confirm"}

    return SessionRecoveryResponse(
        session_id=session_id,
        state=session.state,
        last_updated=session.updated_at,
        pending_high_risk_count=pending_high,
        resumable=resumable,
        message="会话可恢复，继续上次审核进度" if resumable else "会话不在可恢复状态",
    )


@router.post("/{session_id}/retry-parse")
async def retry_parse(
    session_id: str,
    x_user_id: str = Header(default="anonymous", alias="X-User-ID"),
    db: Session = Depends(get_db),
):
    session = db.query(ReviewSession).filter(ReviewSession.id == session_id).first()
    if not session:
        raise APIError.not_found("ReviewSession")

    if session.state not in {"parsing", "aborted"}:
        raise APIError.session_state_invalid(session.state, "parsing/aborted")

    contract = db.query(Contract).filter(Contract.id == session.contract_id).first()
    if not contract:
        raise APIError.not_found("Contract")

    # Reset state
    now = datetime.utcnow()
    session.state = "parsing"
    session.updated_at = now
    db.add(session)

    audit = AuditLog(
        session_id=session_id,
        event_type="retry_parse",
        actor_id=x_user_id,
        actor_type="user",
        occurred_at=now,
        metadata_json=json.dumps({"contract_id": contract.id}),
    )
    db.add(audit)
    db.commit()

    # Re-trigger OCR
    from app.services.upload_service import _background_ocr

    asyncio.create_task(_background_ocr(session_id, contract.file_path, contract.file_type))

    return {"session_id": session_id, "state": "parsing", "message": "重新解析已启动"}


@router.post("/{session_id}/abort")
async def abort_session(
    session_id: str,
    body: Optional[AbortRequest] = None,
    x_user_id: str = Header(default="anonymous", alias="X-User-ID"),
    db: Session = Depends(get_db),
):
    session = db.query(ReviewSession).filter(ReviewSession.id == session_id).first()
    if not session:
        raise APIError.not_found("ReviewSession")

    if session.state in {"report_ready", "aborted"}:
        raise APIError.session_state_invalid(session.state, "非 report_ready/aborted 状态")

    now = datetime.utcnow()
    session.state = "aborted"
    session.completed_at = now
    session.updated_at = now
    db.add(session)

    # Update contract status
    contract = db.query(Contract).filter(Contract.id == session.contract_id).first()
    if contract:
        contract.contract_status = "aborted"
        contract.updated_at = now
        db.add(contract)

    reason = (body.reason if body and body.reason else "") or "用户主动放弃"
    audit = AuditLog(
        session_id=session_id,
        event_type="session_aborted",
        actor_id=x_user_id,
        actor_type="user",
        occurred_at=now,
        metadata_json=json.dumps({"reason": reason}),
    )
    db.add(audit)
    db.commit()

    await sse_manager.publish(
        session_id,
        "session_aborted",
        {"session_id": session_id, "reason": reason},
    )

    return {"session_id": session_id, "state": "aborted", "message": "审核已放弃"}
