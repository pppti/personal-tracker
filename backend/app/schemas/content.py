from pydantic import BaseModel


class TagCreate(BaseModel):
    name: str
    color: str | None = None


class TagResponse(BaseModel):
    id: int
    name: str
    color: str | None = None


class ContentCreate(BaseModel):
    title: str
    source: str | None = None
    category: str = "quote"
    body: str
    notes: str | None = None
    tag_ids: list[int] = []


class ContentUpdate(BaseModel):
    title: str | None = None
    source: str | None = None
    category: str | None = None
    body: str | None = None
    notes: str | None = None
    tag_ids: list[int] | None = None


class ContentResponse(BaseModel):
    id: int
    title: str
    source: str | None = None
    category: str
    body: str
    notes: str | None = None
    created_at: str
    updated_at: str
    tags: list[TagResponse] = []


class ContentListResponse(BaseModel):
    items: list[ContentResponse]
    total: int
    page: int
    limit: int
