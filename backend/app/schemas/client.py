import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class ClientCreate(BaseModel):
    name: str
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    monthly_kwh: Decimal | None = None
    senelec_tariff_tier: str | None = None
    notes: str | None = None


class ClientUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    monthly_kwh: Decimal | None = None
    senelec_tariff_tier: str | None = None
    notes: str | None = None


class ClientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    installer_id: uuid.UUID
    name: str
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    monthly_kwh: Decimal | None = None
    senelec_tariff_tier: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    project_count: int = 0
