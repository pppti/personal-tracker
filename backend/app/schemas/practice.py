from pydantic import BaseModel
from .content import ContentResponse


class PracticeCreate(BaseModel):
    title: str | None = None
    body: str
    mood: str | None = None
    duration_minutes: int | None = None
    practice_date: str | None = None
    content_ids: list[int] = []


class PracticeUpdate(BaseModel):
    title: str | None = None
    body: str | None = None
    mood: str | None = None
    duration_minutes: int | None = None
    practice_date: str | None = None
    content_ids: list[int] | None = None


class PracticeResponse(BaseModel):
    id: int
    title: str | None = None
    body: str
    mood: str | None = None
    duration_minutes: int | None = None
    practice_date: str
    created_at: str
    updated_at: str
    linked_contents: list[ContentResponse] = []


class PracticeListResponse(BaseModel):
    items: list[PracticeResponse]
    total: int
    page: int
    limit: int


class PracticeStats(BaseModel):
    total_entries: int
    total_minutes: int
    current_streak: int
    mood_distribution: dict[str, int]
