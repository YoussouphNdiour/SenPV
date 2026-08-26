import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class UserCreate(BaseModel):
    email: str
    name: str
    password: str | None = None
    role: str = "particular"
    locale: str = "fr"


class UserUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    locale: str | None = None
    is_active: bool | None = None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str
    role: str
    locale: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class InstallerProfileCreate(BaseModel):
    company_name: str
    address: str | None = None
    phone: str | None = None
    siret: str | None = None
    logo_path: str | None = None
    payment_terms: str | None = None


class InstallerProfileUpdate(BaseModel):
    company_name: str | None = None
    address: str | None = None
    phone: str | None = None
    siret: str | None = None
    logo_path: str | None = None
    payment_terms: str | None = None


class InstallerProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    company_name: str
    address: str | None = None
    phone: str | None = None
    siret: str | None = None
    logo_path: str | None = None
    payment_terms: str | None = None
    created_at: datetime
    updated_at: datetime
