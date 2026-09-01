import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import BigInteger, DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FinancialAnalysis(Base):
    __tablename__ = "financial_analyses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    simulation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("simulations.id", ondelete="CASCADE"), nullable=False
    )
    total_cost_fcfa: Mapped[int] = mapped_column(BigInteger, nullable=False)
    annual_savings_fcfa: Mapped[int] = mapped_column(BigInteger, nullable=False)
    senelec_tariff_applied: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    npv_fcfa: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    irr_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    payback_years: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    cashflow_25y: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    degradation_rate_pct: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=0.5)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    simulation: Mapped["Simulation"] = relationship(back_populates="financial_analysis")  # noqa: F821
