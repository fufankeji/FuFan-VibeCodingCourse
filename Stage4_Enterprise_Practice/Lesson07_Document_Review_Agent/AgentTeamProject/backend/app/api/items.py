from typing import Optional

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.review_item import ReviewItem
from app.models.session import ReviewSession
from app.schemas.item import (
    BatchConfirmRequest,
    BatchConfirmResponse,
    HITLDecisionRequest,
    HITLDecisionResponse,
    ReviewItemListResponse,
    ReviewItemResponse,
)
from app.services import review_service

router = APIRouter()


@router.get("/{session_id}/items", response_model=ReviewItemListResponse)
def list_items(
    session_id: str,
    risk_level: Optional[str] = Query(default=None, description="HIGH/MEDIUM/LOW"),
    human_decision: Optional[str] = Query(default=None),
    cursor: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    session = db.query(ReviewSession).filter(ReviewSession.id == session_id).first()
    if not session:
        raise APIError.not_found("ReviewSession")

    query = db.query(ReviewItem).filter(ReviewItem.session_id == session_id)

    if risk_level:
        query = query.filter(ReviewItem.risk_level == risk_level.upper())
    if human_decision:
        query = query.filter(ReviewItem.human_decision == human_decision)

    query = query.order_by(ReviewItem.created_at.asc())

    if cursor:
        anchor = db.query(ReviewItem).filter(ReviewItem.id == cursor).first()
        if anchor:
            query = query.filter(ReviewItem.created_at > anchor.created_at)

    items = query.limit(limit + 1).all()
    has_more = len(items) > limit
    if has_more:
        items = items[:limit]

    next_cursor = items[-1].id if has_more and items else None
    total = db.query(ReviewItem).filter(ReviewItem.session_id == session_id).count()

    return ReviewItemListResponse(
        items=[ReviewItemResponse.model_validate(i) for i in items],
        total=total,
        next_cursor=next_cursor,
    )


@router.get("/{session_id}/items/{item_id}", response_model=ReviewItemResponse)
def get_item(session_id: str, item_id: str, db: Session = Depends(get_db)):
    item = db.query(ReviewItem).filter(
        ReviewItem.id == item_id, ReviewItem.session_id == session_id
    ).first()
    if not item:
        raise APIError.not_found("ReviewItem")
    return ReviewItemResponse.model_validate(item)


@router.post("/{session_id}/items/{item_id}/decision", response_model=HITLDecisionResponse)
async def submit_decision(
    session_id: str,
    item_id: str,
    body: HITLDecisionRequest,
    x_user_id: str = Header(default="anonymous", alias="X-User-ID"),
    x_user_role: str = Header(default="reviewer", alias="X-User-Role"),
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
):
    return await review_service.submit_decision(
        session_id=session_id,
        item_id=item_id,
        decision_data=body,
        user_id=x_user_id,
        user_role=x_user_role,
        idempotency_key=idempotency_key,
        db=db,
    )


@router.delete("/{session_id}/items/{item_id}/decision")
async def revoke_decision(
    session_id: str,
    item_id: str,
    x_user_id: str = Header(default="anonymous", alias="X-User-ID"),
    db: Session = Depends(get_db),
):
    return await review_service.revoke_decision(
        session_id=session_id,
        item_id=item_id,
        user_id=x_user_id,
        db=db,
    )


@router.post("/{session_id}/items/batch-confirm", response_model=BatchConfirmResponse)
async def batch_confirm(
    session_id: str,
    body: BatchConfirmRequest,
    x_user_id: str = Header(default="anonymous", alias="X-User-ID"),
    db: Session = Depends(get_db),
):
    return await review_service.batch_confirm(
        session_id=session_id,
        item_ids=body.item_ids,
        note=body.note,
        user_id=x_user_id,
        db=db,
    )
