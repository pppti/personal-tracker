from pydantic import BaseModel


class GenerateMessageRequest(BaseModel):
    period_days: int = 7


class MessageResponse(BaseModel):
    id: int
    title: str | None = None
    body: str
    period_start: str | None = None
    period_end: str | None = None
    is_read: bool
    generated_at: str


class MessageListResponse(BaseModel):
    items: list[MessageResponse]
