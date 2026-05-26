from datetime import datetime
from sqlalchemy import String, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Lot(Base):
    __tablename__ = "lot"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    number: Mapped[int | None] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str] = mapped_column(nullable=False)
    explanation: Mapped[str | None] = mapped_column()
    source: Mapped[str | None] = mapped_column(String(500))
    category: Mapped[str] = mapped_column(String(20), default="general")
    created_at: Mapped[str] = mapped_column(String(25), default=lambda: datetime.utcnow().isoformat())


class LotDraw(Base):
    __tablename__ = "lot_draw"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    lot_id: Mapped[int] = mapped_column(ForeignKey("lot.id"), nullable=False)
    drawn_at: Mapped[str] = mapped_column(String(25), default=lambda: datetime.utcnow().isoformat())

    lot: Mapped["Lot"] = relationship()
