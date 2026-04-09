from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from app.core.errors import APIError
from app.core.sse import sse_manager
from app.database import get_db
from app.models.session import ReviewSession

router = APIRouter()


@router.get("/{session_id}/events")
async def session_events(session_id: str, db: Session = Depends(get_db)):
    session = db.query(ReviewSession).filter(ReviewSession.id == session_id).first()
    if not session:
        raise APIError.not_found("ReviewSession")

    async def event_generator():
        # Send initial connection confirmation
        yield {"event": "connected", "data": f'{{"session_id": "{session_id}"}}'}

        async for event in sse_manager.subscribe(session_id):
            yield event

    return EventSourceResponse(event_generator())
