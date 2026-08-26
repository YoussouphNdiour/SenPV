import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PanelLayout(Base):
    __tablename__ = "panel_layouts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default="gen_random_uuid()"
    )
    roof_zone_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roof_zones.id", ondelete="CASCADE"), nullable=False
    )
    panel_model_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipment.id"), nullable=False
    )
    inverter_model_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipment.id"), nullable=True
    )
    num_panels: Mapped[int] = mapped_column(Integer, nullable=False)
    num_strings: Mapped[int] = mapped_column(Integer, default=1)
    panels_per_string: Mapped[int] = mapped_column(Integer, nullable=False)
    spacing_x: Mapped[Decimal] = mapped_column(Numeric(5, 3), default=0.02)
    spacing_y: Mapped[Decimal] = mapped_column(Numeric(5, 3), default=0.02)
    layout_geojson: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    roof_zone: Mapped["RoofZone"] = relationship(back_populates="panel_layouts")  # noqa: F821
    panel_model: Mapped["Equipment"] = relationship(foreign_keys=[panel_model_id])  # noqa: F821
    inverter_model: Mapped["Equipment | None"] = relationship(foreign_keys=[inverter_model_id])  # noqa: F821
    simulations: Mapped[list["Simulation"]] = relationship(  # noqa: F821
        back_populates="panel_layout", cascade="all, delete-orphan"
    )
