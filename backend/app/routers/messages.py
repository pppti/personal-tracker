from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.message import CultivationMessage
from app.models.practice import PracticeRecord, PracticeContent
from app.schemas.message import GenerateMessageRequest, MessageResponse, MessageListResponse
from app.services.ai_service import generate_cultivation_message
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/messages", tags=["messages"])


@router.get("", response_model=MessageListResponse)
async def list_messages(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CultivationMessage).order_by(CultivationMessage.generated_at.desc())
    )
    messages = result.scalars().all()
    return MessageListResponse(
        items=[_msg_to_response(m) for m in messages]
    )


@router.get("/{message_id}", response_model=MessageResponse)
async def get_message(
    message_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(CultivationMessage).where(CultivationMessage.id == message_id))
    msg = r.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return _msg_to_response(msg)


@router.post("/generate", response_model=MessageResponse)
async def generate_message(
    req: GenerateMessageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    period_end = date.today()
    period_start = period_end - timedelta(days=req.period_days)

    # gather practices in period
    r = await db.execute(
        select(PracticeRecord)
        .where(PracticeRecord.practice_date >= period_start.isoformat())
        .where(PracticeRecord.practice_date <= period_end.isoformat())
        .order_by(PracticeRecord.practice_date.desc())
    )
    practices = r.scalars().all()

    practice_data = []
    for p in practices:
        practice_data.append({
            "date": p.practice_date,
            "title": p.title or "",
            "body": p.body,
            "mood": p.mood or "",
            "duration_minutes": p.duration_minutes or 0,
        })

    # stats
    total_r = await db.execute(select(func.count(PracticeRecord.id)).where(
        PracticeRecord.practice_date >= period_start.isoformat(),
        PracticeRecord.practice_date <= period_end.isoformat()
    ))
    total_count = total_r.scalar() or 0
    mood_r = await db.execute(
        select(PracticeRecord.mood, func.count(PracticeRecord.id))
        .where(PracticeRecord.mood.isnot(None))
        .where(PracticeRecord.practice_date >= period_start.isoformat())
        .where(PracticeRecord.practice_date <= period_end.isoformat())
        .group_by(PracticeRecord.mood)
    )
    moods = {row[0]: row[1] for row in mood_r.all()}

    body = await generate_cultivation_message(
        practices=practice_data,
        total_count=total_count,
        moods=moods,
        period_start=period_start.isoformat(),
        period_end=period_end.isoformat(),
    )

    msg = CultivationMessage(
        title=f"修行寄语 · {period_start.isoformat()} ~ {period_end.isoformat()}",
        body=body,
        period_start=period_start.isoformat(),
        period_end=period_end.isoformat(),
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return _msg_to_response(msg)


@router.put("/{message_id}/read", response_model=MessageResponse)
async def mark_read(
    message_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(CultivationMessage).where(CultivationMessage.id == message_id))
    msg = r.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    msg.is_read = 1
    await db.commit()
    await db.refresh(msg)
    return _msg_to_response(msg)


def _msg_to_response(m: CultivationMessage) -> MessageResponse:
    return MessageResponse(
        id=m.id,
        title=m.title,
        body=m.body,
        period_start=m.period_start,
        period_end=m.period_end,
        is_read=bool(m.is_read),
        generated_at=m.generated_at,
    )
