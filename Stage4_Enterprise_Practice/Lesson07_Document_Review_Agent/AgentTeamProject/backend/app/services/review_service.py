"""
Review Service — HITL decision handling.

Responsibilities:
- submit_decision: validate, persist, audit, update progress, trigger SSE
- revoke_decision: undo a pending/confirmed decision
- batch_confirm: bulk confirm medium-risk items
"""

import json
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.sse import sse_manager
from app.models.audit_log import AuditLog
from app.models.review_item import ReviewItem
from app.models.session import ReviewSession
from app.schemas.item import HITLDecisionRequest, HITLDecisionResponse, BatchConfirmResponse

# States that allow HITL decisions
_HITL_ACTIVE_STATES = {"hitl_high_risk", "hitl_field_verify", "hitl_medium_confirm", "hitl_pending"}


async def submit_decision(
    session_id: str,
    item_id: str,
    decision_data: HITLDecisionRequest,
    user_id: str,
    user_role: str,
    idempotency_key: Optional[str],
    db: Session,
) -> HITLDecisionResponse:
    # 1. Validate session state
    session: ReviewSession | None = db.query(ReviewSession).filter(ReviewSession.id == session_id).first()
    if not session:
        raise APIError.not_found("ReviewSession")
    if session.state not in _HITL_ACTIVE_STATES:
        raise APIError.session_state_invalid(session.state, str(_HITL_ACTIVE_STATES))

    # 2. Load review item
    item: ReviewItem | None = db.query(ReviewItem).filter(
        ReviewItem.id == item_id, ReviewItem.session_id == session_id
    ).first()
    if not item:
        raise APIError.not_found("ReviewItem")

    # 3. Batch high-risk prohibition: batch-confirm is only for medium risk
    if decision_data.decision == "confirmed" and item.risk_level == "HIGH":
        # single decision is fine; batch via batch_confirm is blocked for HIGH
        pass

    # 4. Note length — already validated by Pydantic; double-check here
    # Merge human_note into note if note is absent
    effective_note = decision_data.note or decision_data.human_note
    if effective_note and len(effective_note) > 1000:
        raise APIError.bad_request("备注长度不得超过1000字符")

    # 5. Role check: submitter cannot decide on high-risk items
    if item.risk_level == "HIGH" and user_role == "submitter":
        raise APIError.forbidden("提交人角色无法对高风险条款做出决策")

    # 6. Idempotency check
    if idempotency_key:
        existing_log = (
            db.query(AuditLog)
            .filter(
                AuditLog.session_id == session_id,
                AuditLog.event_type == "item_decision_saved",
            )
            .all()
        )
        for log in existing_log:
            meta = log.metadata_dict
            if meta.get("idempotency_key") == idempotency_key and meta.get("item_id") == item_id:
                # Return idempotent response
                return HITLDecisionResponse(
                    item_id=item_id,
                    session_id=session_id,
                    decision=item.human_decision,
                    decided_by=item.decided_by or user_id,
                    decided_at=item.decided_at or log.occurred_at,
                    message="幂等：返回首次决策结果",
                )

    # Persist decision
    now = datetime.utcnow()
    effective_note = decision_data.note or decision_data.human_note
    item.human_decision = decision_data.decision
    item.human_note = effective_note
    item.human_edited_risk_level = decision_data.edited_risk_level
    item.human_edited_finding = decision_data.edited_finding
    item.is_false_positive = decision_data.is_false_positive or decision_data.decision == "false_positive"
    item.decided_by = user_id
    item.decided_at = now
    item.updated_at = now
    db.add(item)

    # Update session progress counters
    if item.risk_level == "HIGH":
        session.decided_high_risk = min(session.decided_high_risk + 1, session.total_high_risk)
    session.updated_at = now
    db.add(session)

    # Write audit log
    audit = AuditLog(
        session_id=session_id,
        event_type="item_decision_saved",
        actor_id=user_id,
        actor_type="user",
        occurred_at=now,
        metadata_json=json.dumps(
            {
                "item_id": item_id,
                "decision": decision_data.decision,
                "risk_level": item.risk_level,
                "idempotency_key": idempotency_key or "",
            }
        ),
    )
    db.add(audit)
    db.commit()
    db.refresh(session)

    # SSE publish
    await sse_manager.publish(
        session_id,
        "item_decision_saved",
        {
            "session_id": session_id,
            "item_id": item_id,
            "decision": decision_data.decision,
            "decided_by": user_id,
            "decided_at": now.isoformat(),
        },
    )

    # Check if all high-risk items have been decided — trigger resume if so
    await _check_and_trigger_resume(session, db)

    return HITLDecisionResponse(
        item_id=item_id,
        session_id=session_id,
        decision=decision_data.decision,
        decided_by=user_id,
        decided_at=now,
        message="决策已保存",
    )


async def revoke_decision(
    session_id: str,
    item_id: str,
    user_id: str,
    db: Session,
) -> dict:
    session: ReviewSession | None = db.query(ReviewSession).filter(ReviewSession.id == session_id).first()
    if not session:
        raise APIError.not_found("ReviewSession")
    if session.state not in _HITL_ACTIVE_STATES:
        raise APIError.session_state_invalid(session.state, str(_HITL_ACTIVE_STATES))

    item: ReviewItem | None = db.query(ReviewItem).filter(
        ReviewItem.id == item_id, ReviewItem.session_id == session_id
    ).first()
    if not item:
        raise APIError.not_found("ReviewItem")

    if item.human_decision == "pending":
        raise APIError.bad_request("该条款尚未做出决策，无法撤销")

    # Reverse progress counter
    now = datetime.utcnow()
    if item.risk_level == "HIGH" and item.human_decision != "pending":
        session.decided_high_risk = max(0, session.decided_high_risk - 1)

    # Reset decision fields
    item.human_decision = "pending"
    item.human_note = None
    item.human_edited_risk_level = None
    item.human_edited_finding = None
    item.is_false_positive = False
    item.decided_by = None
    item.decided_at = None
    item.updated_at = now
    db.add(item)
    session.updated_at = now
    db.add(session)

    audit = AuditLog(
        session_id=session_id,
        event_type="item_decision_revoked",
        actor_id=user_id,
        actor_type="user",
        occurred_at=now,
        metadata_json=json.dumps({"item_id": item_id}),
    )
    db.add(audit)
    db.commit()

    await sse_manager.publish(
        session_id,
        "item_decision_revoked",
        {"session_id": session_id, "item_id": item_id},
    )

    return {"item_id": item_id, "session_id": session_id, "message": "决策已撤销"}


async def batch_confirm(
    session_id: str,
    item_ids: list[str],
    note: Optional[str],
    user_id: str,
    db: Session,
) -> BatchConfirmResponse:
    session: ReviewSession | None = db.query(ReviewSession).filter(ReviewSession.id == session_id).first()
    if not session:
        raise APIError.not_found("ReviewSession")
    if session.state not in _HITL_ACTIVE_STATES:
        raise APIError.session_state_invalid(session.state, str(_HITL_ACTIVE_STATES))

    now = datetime.utcnow()
    confirmed = 0
    failed = 0

    for item_id in item_ids:
        item: ReviewItem | None = db.query(ReviewItem).filter(
            ReviewItem.id == item_id, ReviewItem.session_id == session_id
        ).first()
        if not item:
            failed += 1
            continue
        # Batch confirm only allowed for non-HIGH risk items
        if item.risk_level == "HIGH":
            failed += 1
            continue

        item.human_decision = "confirmed"
        item.human_note = note
        item.decided_by = user_id
        item.decided_at = now
        item.updated_at = now
        db.add(item)
        confirmed += 1

    session.updated_at = now
    db.add(session)

    audit = AuditLog(
        session_id=session_id,
        event_type="batch_confirm",
        actor_id=user_id,
        actor_type="user",
        occurred_at=now,
        metadata_json=json.dumps(
            {"item_ids": item_ids, "confirmed": confirmed, "failed": failed}
        ),
    )
    db.add(audit)
    db.commit()

    await sse_manager.publish(
        session_id,
        "batch_confirmed",
        {"session_id": session_id, "confirmed": confirmed, "failed": failed},
    )

    return BatchConfirmResponse(
        confirmed_count=confirmed,
        failed_count=failed,
        message=f"批量确认完成：成功 {confirmed} 条，失败 {failed} 条",
    )


async def _check_and_trigger_resume(session: ReviewSession, db: Session) -> None:
    """Resume workflow if all high-risk items have been decided."""
    if session.total_high_risk == 0:
        return
    if session.decided_high_risk < session.total_high_risk:
        return

    # All high-risk decided — notify workflow to resume
    await sse_manager.publish(
        session.id,
        "hitl_complete",
        {"session_id": session.id, "message": "所有高风险条款已处理"},
    )
