import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProjectCreate(BaseModel):
    name: str
    client_id: uuid.UUID | None = None
    address: str | None = None
    lat: float
    lon: float
    status: str = "draft"
    notes: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    client_id: uuid.UUID | None = None
    address: str | None = None
    lat: float | None = None
    lon: float | None = None
    status: str | None = None
    notes: str | None = None


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    client_id: uuid.UUID | None = None
    name: str
    address: str | None = None
    lat: float
    lon: float
    status: str
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    client_name: str | None = None
    panel_count: int = 0
