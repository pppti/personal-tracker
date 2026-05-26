from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.content import Content, Tag, ContentTag
from app.schemas.content import (
    ContentCreate, ContentUpdate, ContentResponse, ContentListResponse,
    TagCreate, TagResponse,
)
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api", tags=["contents"])


# ——— Tags ———
@router.get("/tags", response_model=list[TagResponse])
async def list_tags(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tag).order_by(Tag.name))
    tags = result.scalars().all()
    return [TagResponse(id=t.id, name=t.name, color=t.color) for t in tags]


@router.post("/tags", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    req: TagCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(Tag).where(Tag.name == req.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tag exists")
    tag = Tag(name=req.name, color=req.color)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return TagResponse(id=tag.id, name=tag.name, color=tag.color)


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Tag).where(Tag.id == tag_id))
    tag = r.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    await db.delete(tag)
    await db.commit()


# ——— Contents ———
@router.get("/contents", response_model=ContentListResponse)
async def list_contents(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = None,
    category: str | None = None,
    tag_id: int | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Content).options(selectinload(Content.tags).selectinload(ContentTag.tag))
    count_q = select(func.count(Content.id))

    if search:
        like = f"%{search}%"
        q = q.where(Content.title.like(like) | Content.body.like(like))
        count_q = count_q.where(Content.title.like(like) | Content.body.like(like))
    if category:
        q = q.where(Content.category == category)
        count_q = count_q.where(Content.category == category)
    if tag_id:
        q = q.where(Content.tags.any(ContentTag.tag_id == tag_id))
        count_q = count_q.where(Content.tags.any(ContentTag.tag_id == tag_id))

    total_r = await db.execute(count_q)
    total = total_r.scalar() or 0

    offset = (page - 1) * limit
    q = q.order_by(Content.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(q)
    contents = result.unique().scalars().all()

    items = [_content_to_response(c) for c in contents]
    return ContentListResponse(items=items, total=total, page=page, limit=limit)


@router.get("/contents/{content_id}", response_model=ContentResponse)
async def get_content(
    content_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Content)
        .options(selectinload(Content.tags).selectinload(ContentTag.tag))
        .where(Content.id == content_id)
    )
    c = r.unique().scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return _content_to_response(c)


@router.post("/contents", response_model=ContentResponse, status_code=status.HTTP_201_CREATED)
async def create_content(
    req: ContentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content = Content(
        title=req.title,
        source=req.source,
        category=req.category,
        body=req.body,
        notes=req.notes,
    )
    db.add(content)
    await db.flush()

    for tid in req.tag_ids:
        db.add(ContentTag(content_id=content.id, tag_id=tid))

    await db.commit()
    await db.refresh(content)

    r = await db.execute(
        select(Content)
        .options(selectinload(Content.tags).selectinload(ContentTag.tag))
        .where(Content.id == content.id)
    )
    content = r.unique().scalar_one()
    return _content_to_response(content)


@router.put("/contents/{content_id}", response_model=ContentResponse)
async def update_content(
    content_id: int,
    req: ContentUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Content)
        .options(selectinload(Content.tags).selectinload(ContentTag.tag))
        .where(Content.id == content_id)
    )
    content = r.unique().scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    if req.title is not None:
        content.title = req.title
    if req.source is not None:
        content.source = req.source
    if req.category is not None:
        content.category = req.category
    if req.body is not None:
        content.body = req.body
    if req.notes is not None:
        content.notes = req.notes
    if req.tag_ids is not None:
        existing = (await db.execute(
            select(ContentTag).where(ContentTag.content_id == content_id)
        )).scalars().all()
        for ct in existing:
            await db.delete(ct)
        for tid in req.tag_ids:
            db.add(ContentTag(content_id=content_id, tag_id=tid))

    content.updated_at = datetime.utcnow().isoformat()
    await db.commit()
    await db.refresh(content)
    return _content_to_response(content)


@router.delete("/contents/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_content(
    content_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Content).where(Content.id == content_id))
    content = r.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    await db.delete(content)
    await db.commit()


def _content_to_response(c: Content) -> ContentResponse:
    from app.schemas.content import TagResponse
    return ContentResponse(
        id=c.id,
        title=c.title,
        source=c.source,
        category=c.category,
        body=c.body,
        notes=c.notes,
        created_at=c.created_at,
        updated_at=c.updated_at,
        tags=[TagResponse(id=ct.tag.id, name=ct.tag.name, color=ct.tag.color) for ct in c.tags],
    )
