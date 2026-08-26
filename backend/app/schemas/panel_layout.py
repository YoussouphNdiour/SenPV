import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict


class PanelLayoutCreate(BaseModel):
    roof_zone_id: uuid.UUID
    panel_model_id: uuid.UUID
    inverter_model_id: uuid.UUID | None = None
    num_panels: int
    num_strings: int = 1
    panels_per_string: int
    spacing_x: Decimal = Decimal("0.02")
    spacing_y: Decimal = Decimal("0.02")
    layout_geojson: dict | None = None


class PanelLayoutUpdate(BaseModel):
    panel_model_id: uuid.UUID | None = None
    inverter_model_id: uuid.UUID | None = None
    num_panels: int | None = None
    num_strings: int | None = None
    panels_per_string: int | None = None
    spacing_x: Decimal | None = None
    spacing_y: Decimal | None = None
    layout_geojson: dict | None = None


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
