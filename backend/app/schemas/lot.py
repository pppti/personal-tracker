from pydantic import BaseModel


class LotResponse(BaseModel):
    id: int
    number: int | None = None
    title: str
    body: str
    explanation: str | None = None
    source: str | None = None
    category: str


class LotDrawResponse(BaseModel):
    id: int
    lot: LotResponse
    drawn_at: str


class LotDrawListResponse(BaseModel):
    items: list[LotDrawResponse]
