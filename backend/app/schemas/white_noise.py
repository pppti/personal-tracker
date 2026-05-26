from pydantic import BaseModel


class WhiteNoiseTrackResponse(BaseModel):
    id: int
    name: str
    name_cn: str | None = None
    category: str
    file_path: str
    duration_s: int | None = None
    is_builtin: bool
