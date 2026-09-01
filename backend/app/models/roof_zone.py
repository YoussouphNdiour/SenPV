import uuid
from datetime import datetime, timezone
from decimal import Decimal

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RoofZone(Base):
    __tablename__ = "roof_zones"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    polygon = mapped_column(Geometry("POLYGON", srid=4326), nullable=True)
    orientation_deg: Mapped[Decimal | None] = mapped_column(Numeric(5, 1), nullable=True)
    tilt_deg: Mapped[Decimal | None] = mapped_column(Numeric(4, 1), nullable=True)
    roof_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    area_m2: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    zone_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    project: Mapped["Project"] = relationship(back_populates="roof_zones")  # noqa: F821
    panel_layouts: Mapped[list["PanelLayout"]] = relationship(  # noqa: F821
        back_populates="roof_zone", cascade="all, delete-orphan"
    )
