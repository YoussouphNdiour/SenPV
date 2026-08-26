import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class SimulateRequest(BaseModel):
    """Optional body for POST /projects/{id}/simulate."""
    panel_layout_id: uuid.UUID | None = None
    losses_pct: float = Field(default=14.0, ge=0, le=50)
    albedo: float = Field(default=0.2, ge=0, le=1.0)


class SimulationCreate(BaseModel):
    project_id: uuid.UUID
    panel_layout_id: uuid.UUID
    params: dict
    monthly_production: dict
    annual_kwh: Decimal
    specific_yield: Decimal | None = None
    peak_power_kwc: Decimal | None = None
    performance_ratio: Decimal | None = None


class SimulationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    panel_layout_id: uuid.UUID
    params: dict
    monthly_production: dict
    annual_kwh: Decimal
    specific_yield: Decimal | None = None
    peak_power_kwc: Decimal | None = None
    performance_ratio: Decimal | None = None
    created_at: datetime
