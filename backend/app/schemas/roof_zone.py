import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict


class RoofZoneCreate(BaseModel):
    polygon: Any | None = None
    orientation_deg: Decimal | None = None
    tilt_deg: Decimal | None = None
    roof_type: str | None = None
    area_m2: Decimal | None = None
    zone_index: int = 0


class RoofZoneUpdate(BaseModel):
    polygon: Any | None = None
    orientation_deg: Decimal | None = None
    tilt_deg: Decimal | None = None
    roof_type: str | None = None
    area_m2: Decimal | None = None
    zone_index: int | None = None


class RoofZoneRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    orientation_deg: Decimal | None = None
    tilt_deg: Decimal | None = None
    roof_type: str | None = None
    area_m2: Decimal | None = None
    zone_index: int
    created_at: datetime
