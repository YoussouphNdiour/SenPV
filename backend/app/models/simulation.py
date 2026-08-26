import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Simulation(Base):
    __tablename__ = "simulations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default="gen_random_uuid()"
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    panel_layout_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("panel_layouts.id", ondelete="CASCADE"), nullable=False
    )
    params: Mapped[dict] = mapped_column(JSONB, nullable=False)
    monthly_production: Mapped[list] = mapped_column(JSONB, nullable=False)
    annual_kwh: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    specific_yield: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    peak_power_kwc: Mapped[Decimal | None] = mapped_column(Numeric(8, 3), nullable=True)
    performance_ratio: Mapped[Decimal | None] = mapped_column(Numeric(5, 3), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    project: Mapped["Project"] = relationship(back_populates="simulations")  # noqa: F821
    panel_layout: Mapped["PanelLayout"] = relationship(back_populates="simulations")  # noqa: F821
    financial_analysis: Mapped["FinancialAnalysis | None"] = relationship(  # noqa: F821
        back_populates="simulation", cascade="all, delete-orphan", uselist=False
    )
