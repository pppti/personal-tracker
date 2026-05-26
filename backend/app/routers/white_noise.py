import os
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import AUDIO_DIR
from app.database import get_db
from app.models.user import User
from app.models.white_noise import WhiteNoiseTrack
from app.schemas.white_noise import WhiteNoiseTrackResponse
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/white-noise", tags=["white_noise"])


@router.get("/tracks", response_model=list[WhiteNoiseTrackResponse])
async def list_tracks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(WhiteNoiseTrack).order_by(WhiteNoiseTrack.category, WhiteNoiseTrack.name))
    tracks = result.scalars().all()
    return [
        WhiteNoiseTrackResponse(
            id=t.id,
            name=t.name,
            name_cn=t.name_cn,
            category=t.category,
            file_path=t.file_path,
            duration_s=t.duration_s,
            is_builtin=bool(t.is_builtin),
        )
        for t in tracks
    ]


@router.get("/stream/{track_id}")
async def stream_track(
    track_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(WhiteNoiseTrack).where(WhiteNoiseTrack.id == track_id))
    track = result.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found")

    file_path = os.path.join(AUDIO_DIR, track.file_path)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio file not found")

    file_size = os.path.getsize(file_path)

    async def file_iterator():
        chunk_size = 64 * 1024
        with open(file_path, "rb") as f:
            while chunk := f.read(chunk_size):
                yield chunk

    return StreamingResponse(
        file_iterator(),
        media_type="audio/mpeg",
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Cache-Control": "public, max-age=86400",
        },
    )
