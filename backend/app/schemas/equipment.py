import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class EquipmentCreate(BaseModel):
    type: str
    manufacturer: str
    model: str
    specs: dict
    is_global: bool = False


class EquipmentUpdate(BaseModel):
    type: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    specs: dict | None = None
    is_global: bool | None = None


class EquipmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID | None = None
    type: str
    manufacturer: str
    model: str
    specs: dict
    is_global: bool
    created_at: datetime
    updated_at: datetime
