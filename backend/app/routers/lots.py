from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.lot import Lot, LotDraw
from app.schemas.lot import LotResponse, LotDrawResponse, LotDrawListResponse
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/lots", tags=["lots"])


@router.get("", response_model=list[LotResponse])
async def list_lots(
    category: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Lot)
    if category:
        q = q.where(Lot.category == category)
    q = q.order_by(Lot.number)
    result = await db.execute(q)
    lots = result.scalars().all()
    return [_lot_to_response(l) for l in lots]


@router.post("/draw", response_model=LotDrawResponse)
async def draw_lot(
    category: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Lot)
    if category:
        q = q.where(Lot.category == category)
    q = q.order_by(func.random()).limit(1)
    result = await db.execute(q)
    lot = result.scalar_one_or_none()
    if not lot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No lots available")

    draw = LotDraw(lot_id=lot.id)
    db.add(draw)
    await db.commit()
    await db.refresh(draw)

    r = await db.execute(select(LotDraw).options(selectinload(LotDraw.lot)).where(LotDraw.id == draw.id))
    draw = r.scalar_one()
    return LotDrawResponse(
        id=draw.id,
        lot=_lot_to_response(draw.lot),
        drawn_at=draw.drawn_at,
    )


@router.get("/history", response_model=LotDrawListResponse)
async def draw_history(
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(LotDraw)
        .options(selectinload(LotDraw.lot))
        .order_by(LotDraw.drawn_at.desc())
        .limit(limit)
    )
    draws = r.scalars().all()
    return LotDrawListResponse(
        items=[LotDrawResponse(
            id=d.id,
            lot=_lot_to_response(d.lot),
            drawn_at=d.drawn_at,
        ) for d in draws]
    )


def _lot_to_response(l: Lot) -> LotResponse:
    return LotResponse(
        id=l.id,
        number=l.number,
        title=l.title,
        body=l.body,
        explanation=l.explanation,
        source=l.source,
        category=l.category,
    )
