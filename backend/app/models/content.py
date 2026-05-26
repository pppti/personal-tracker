from datetime import datetime
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Content(Base):
    __tablename__ = "content"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    source: Mapped[str | None] = mapped_column(String(500))
    category: Mapped[str] = mapped_column(String(20), default="quote")
    body: Mapped[str] = mapped_column(nullable=False)
    notes: Mapped[str | None] = mapped_column()
    created_at: Mapped[str] = mapped_column(String(25), default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String(25), default=lambda: datetime.utcnow().isoformat())

    tags: Mapped[list["ContentTag"]] = relationship(back_populates="content", cascade="all, delete-orphan")


class Tag(Base):
    __tablename__ = "tag"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    color: Mapped[str | None] = mapped_column(String(7))


class ContentTag(Base):
    __tablename__ = "content_tag"

    content_id: Mapped[int] = mapped_column(ForeignKey("content.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tag.id", ondelete="CASCADE"), primary_key=True)

    content: Mapped["Content"] = relationship(back_populates="tags")
    tag: Mapped["Tag"] = relationship()
