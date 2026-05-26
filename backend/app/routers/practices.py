from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.practice import PracticeRecord, PracticeContent
from app.models.content import Content
from app.schemas.practice import (
    PracticeCreate, PracticeUpdate, PracticeResponse,
    PracticeListResponse, PracticeStats,
)
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/practices", tags=["practices"])


@router.get("/stats", response_model=PracticeStats)
async def get_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total_r = await db.execute(select(func.count(PracticeRecord.id)))
    total_entries = total_r.scalar() or 0

    mins_r = await db.execute(select(func.coalesce(func.sum(PracticeRecord.duration_minutes), 0)))
    total_minutes = mins_r.scalar() or 0

    # streak
    streak = 0
    today = date.today()
    while True:
        d = (today - timedelta(days=streak)).isoformat()
        r = await db.execute(
            select(PracticeRecord.id).where(PracticeRecord.practice_date == d).limit(1)
        )
        if r.scalar_one_or_none():
            streak += 1
        else:
            break

    # mood distribution
    mood_r = await db.execute(
        select(PracticeRecord.mood, func.count(PracticeRecord.id))
        .where(PracticeRecord.mood.isnot(None))
        .group_by(PracticeRecord.mood)
    )
    mood_dist = {row[0]: row[1] for row in mood_r.all()}

    return PracticeStats(
        total_entries=total_entries,
        total_minutes=total_minutes,
        current_streak=streak,
        mood_distribution=mood_dist,
    )


@router.get("", response_model=PracticeListResponse)
async def list_practices(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    date_from: str | None = None,
    date_to: str | None = None,
    mood: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count_q = select(func.count(PracticeRecord.id))
    q = select(PracticeRecord).options(selectinload(PracticeRecord.linked_contents).selectinload(PracticeContent.content))
    if date_from:
        count_q = count_q.where(PracticeRecord.practice_date >= date_from)
        q = q.where(PracticeRecord.practice_date >= date_from)
    if date_to:
        count_q = count_q.where(PracticeRecord.practice_date <= date_to)
        q = q.where(PracticeRecord.practice_date <= date_to)
    if mood:
        count_q = count_q.where(PracticeRecord.mood == mood)
        q = q.where(PracticeRecord.mood == mood)

    total_r = await db.execute(count_q)
    total = total_r.scalar() or 0

    offset = (page - 1) * limit
    q = q.order_by(PracticeRecord.practice_date.desc(), PracticeRecord.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(q)
    records = result.unique().scalars().all()

    items = [_practice_to_response(r) for r in records]
    return PracticeListResponse(items=items, total=total, page=page, limit=limit)


@router.get("/{practice_id}", response_model=PracticeResponse)
async def get_practice(
    practice_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(PracticeRecord)
        .options(selectinload(PracticeRecord.linked_contents).selectinload(PracticeContent.content))
        .where(PracticeRecord.id == practice_id)
    )
    record = r.unique().scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return _practice_to_response(record)


@router.post("", response_model=PracticeResponse, status_code=status.HTTP_201_CREATED)
async def create_practice(
    req: PracticeCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = PracticeRecord(
        title=req.title,
        body=req.body,
        mood=req.mood,
        duration_minutes=req.duration_minutes,
        practice_date=req.practice_date or date.today().isoformat(),
    )
    db.add(record)
    await db.flush()

    for cid in req.content_ids:
        pc = PracticeContent(practice_id=record.id, content_id=cid)
        db.add(pc)

    await db.commit()
    await db.refresh(record)

    r = await db.execute(
        select(PracticeRecord)
        .options(selectinload(PracticeRecord.linked_contents).selectinload(PracticeContent.content))
        .where(PracticeRecord.id == record.id)
    )
    record = r.unique().scalar_one()
    return _practice_to_response(record)


@router.put("/{practice_id}", response_model=PracticeResponse)
async def update_practice(
    practice_id: int,
    req: PracticeUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(PracticeRecord)
        .options(selectinload(PracticeRecord.linked_contents).selectinload(PracticeContent.content))
        .where(PracticeRecord.id == practice_id)
    )
    record = r.unique().scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    if req.title is not None:
        record.title = req.title
    if req.body is not None:
        record.body = req.body
    if req.mood is not None:
        record.mood = req.mood
    if req.duration_minutes is not None:
        record.duration_minutes = req.duration_minutes
    if req.practice_date is not None:
        record.practice_date = req.practice_date

    if req.content_ids is not None:
        await db.execute(
            select(PracticeContent).where(PracticeContent.practice_id == practice_id)
        )
        existing = (await db.execute(
            select(PracticeContent).where(PracticeContent.practice_id == practice_id)
        )).scalars().all()
        for pc in existing:
            await db.delete(pc)
        for cid in req.content_ids:
            db.add(PracticeContent(practice_id=practice_id, content_id=cid))

    from datetime import datetime
    record.updated_at = datetime.utcnow().isoformat()
    await db.commit()
    await db.refresh(record)
    return _practice_to_response(record)


@router.delete("/{practice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_practice(
    practice_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(PracticeRecord).where(PracticeRecord.id == practice_id))
    record = r.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    await db.delete(record)
    await db.commit()


def _practice_to_response(record: PracticeRecord) -> PracticeResponse:
    from app.schemas.content import ContentResponse, TagResponse

    contents = []
    for pc in record.linked_contents:
        c = pc.content
        contents.append(ContentResponse(
            id=c.id,
            title=c.title,
            source=c.source,
            category=c.category,
            body=c.body,
            notes=c.notes,
            created_at=c.created_at,
            updated_at=c.updated_at,
            tags=[],
        ))
    return PracticeResponse(
        id=record.id,
        title=record.title,
        body=record.body,
        mood=record.mood,
        duration_minutes=record.duration_minutes,
        practice_date=record.practice_date,
        created_at=record.created_at,
        updated_at=record.updated_at,
        linked_contents=contents,
    )
