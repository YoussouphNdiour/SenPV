import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Quote(Base):
    __tablename__ = "quotes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    installer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    reference: Mapped[str | None] = mapped_column(String(50), nullable=True)
    line_items: Mapped[dict] = mapped_column(JSONB, nullable=False)
    subtotal_fcfa: Mapped[int] = mapped_column(BigInteger, nullable=False)
    margin_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    tax_rate_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=18.0)
    tax_amount_fcfa: Mapped[int] = mapped_column(BigInteger, nullable=False)
    total_fcfa: Mapped[int] = mapped_column(BigInteger, nullable=False)
    payment_terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    validity_days: Mapped[int] = mapped_column(Integer, default=30)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    project: Mapped["Project"] = relationship(back_populates="quotes")  # noqa: F821
    installer: Mapped["User"] = relationship()  # noqa: F821
