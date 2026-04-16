import datetime as dt
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.study_session import StudySession
from app.models.achievement import UserAchievement, ACHIEVEMENT_DEFINITIONS
from app.schemas.analytics import (
    SessionCreate,
    SessionResponse,
    CalendarResponse,
    StatsResponse,
    AchievementResponse,
    AchievementCheckResponse,
)

router = APIRouter()


@router.post("/sessions", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    body: SessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = StudySession(
        user_id=current_user.id,
        duration_minutes=body.duration_minutes,
        date=dt.date.fromisoformat(body.date),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return SessionResponse(
        id=session.id,
        duration_minutes=session.duration_minutes,
        date=str(session.date),
    )


@router.get("/calendar", response_model=CalendarResponse)
def get_calendar(
    year: int = 2026,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    start = dt.date(year, 1, 1)
    end = dt.date(year, 12, 31)
    rows = (
        db.query(StudySession.date, func.sum(StudySession.duration_minutes))
        .filter(
            StudySession.user_id == current_user.id,
            StudySession.date >= start,
            StudySession.date <= end,
        )
        .group_by(StudySession.date)
        .all()
    )
    data = {str(row[0]): row[1] for row in rows}
    return CalendarResponse(year=year, data=data)


def _calc_streak(db: Session, user_id: str) -> int:
    """Calculate current consecutive study days ending today or yesterday."""
    today = dt.date.today()
    dates = (
        db.query(StudySession.date)
        .filter(StudySession.user_id == user_id)
        .distinct()
        .order_by(StudySession.date.desc())
        .all()
    )
    date_set = {row[0] for row in dates}
    streak = 0
    check = today
    # Allow starting from today or yesterday
    if check not in date_set:
        check = today - dt.timedelta(days=1)
    while check in date_set:
        streak += 1
        check -= dt.timedelta(days=1)
    return streak


@router.get("/stats", response_model=StatsResponse)
def get_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    total = db.query(func.sum(StudySession.duration_minutes)).filter(
        StudySession.user_id == current_user.id
    ).scalar() or 0

    count = db.query(func.count(StudySession.id)).filter(
        StudySession.user_id == current_user.id
    ).scalar() or 0

    today = dt.date.today()
    today_mins = db.query(func.sum(StudySession.duration_minutes)).filter(
        StudySession.user_id == current_user.id,
        StudySession.date == today,
    ).scalar() or 0

    streak = _calc_streak(db, current_user.id)

    return StatsResponse(
        total_minutes=total,
        streak_days=streak,
        sessions_count=count,
        today_minutes=today_mins,
    )


@router.get("/achievements", response_model=List[AchievementResponse])
def get_achievements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    unlocked = {
        a.type: a.unlocked_at
        for a in db.query(UserAchievement).filter(
            UserAchievement.user_id == current_user.id
        ).all()
    }
    result = []
    for defn in ACHIEVEMENT_DEFINITIONS:
        ua = unlocked.get(defn["type"])
        result.append(AchievementResponse(
            type=defn["type"],
            name=defn["name"],
            description=defn["description"],
            unlocked=ua is not None,
            unlocked_at=ua.isoformat() if ua else None,
        ))
    return result


@router.post("/achievements/check", response_model=AchievementCheckResponse)
def check_achievements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    unlocked_types = {
        a.type
        for a in db.query(UserAchievement).filter(
            UserAchievement.user_id == current_user.id
        ).all()
    }

    total_minutes = db.query(func.sum(StudySession.duration_minutes)).filter(
        StudySession.user_id == current_user.id
    ).scalar() or 0

    session_count = db.query(func.count(StudySession.id)).filter(
        StudySession.user_id == current_user.id
    ).scalar() or 0

    streak = _calc_streak(db, current_user.id)

    conditions = {
        "first-session": session_count >= 1,
        "streak-7": streak >= 7,
        "streak-30": streak >= 30,
        "hours-10": total_minutes >= 600,
        "hours-100": total_minutes >= 6000,
    }

    newly_unlocked = []
    for atype, met in conditions.items():
        if met and atype not in unlocked_types:
            ua = UserAchievement(user_id=current_user.id, type=atype)
            db.add(ua)
            newly_unlocked.append(atype)

    if newly_unlocked:
        db.commit()

    return AchievementCheckResponse(newly_unlocked=newly_unlocked)
