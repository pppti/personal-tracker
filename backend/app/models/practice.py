from datetime import datetime, date
from sqlalchemy import String, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class PracticeRecord(Base):
    __tablename__ = "practice_record"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str | None] = mapped_column(String(500))
    body: Mapped[str] = mapped_column(nullable=False)
    mood: Mapped[str | None] = mapped_column(String(50))
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    practice_date: Mapped[str] = mapped_column(String(10), default=lambda: date.today().isoformat())
    created_at: Mapped[str] = mapped_column(String(25), default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String(25), default=lambda: datetime.utcnow().isoformat())

    linked_contents: Mapped[list["PracticeContent"]] = relationship(
        back_populates="practice_record", cascade="all, delete-orphan"
    )


class PracticeContent(Base):
    __tablename__ = "practice_content"

    practice_id: Mapped[int] = mapped_column(ForeignKey("practice_record.id", ondelete="CASCADE"), primary_key=True)
    content_id: Mapped[int] = mapped_column(ForeignKey("content.id", ondelete="CASCADE"), primary_key=True)

    practice_record: Mapped["PracticeRecord"] = relationship(back_populates="linked_contents")
    content: Mapped["Content"] = relationship()
