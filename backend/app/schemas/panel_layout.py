import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict


class PanelLayoutCreate(BaseModel):
    """Request body for POST /projects/{id}/layouts (auto-calpinage)."""
    roof_zone_id: uuid.UUID
    panel_model_id: uuid.UUID
    inverter_model_id: uuid.UUID | None = None
    spacing_x: Decimal = Decimal("0.02")
    spacing_y: Decimal = Decimal("0.02")


class PanelLayoutUpdate(BaseModel):
    """Request body for PUT /projects/{id}/layouts/{lid}."""
    panel_model_id: uuid.UUID | None = None
    inverter_model_id: uuid.UUID | None = None
    num_panels: int | None = None
    num_strings: int | None = None
    panels_per_string: int | None = None
    spacing_x: Decimal | None = None
    spacing_y: Decimal | None = None
    layout_geojson: dict | None = None


class AddPanelRequest(BaseModel):
    """Request body for POST add-panel."""
    lat: float
    lon: float


class PanelLayoutRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    roof_zone_id: uuid.UUID
    panel_model_id: uuid.UUID
    inverter_model_id: uuid.UUID | None = None
    num_panels: int
    num_strings: int
    panels_per_string: int
    spacing_x: Decimal
    spacing_y: Decimal
    layout_geojson: dict | None = None
    created_at: datetime
    updated_at: datetime
