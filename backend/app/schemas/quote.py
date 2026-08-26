import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class QuoteCreate(BaseModel):
    project_id: uuid.UUID
    reference: str | None = None
    line_items: dict
    subtotal_fcfa: int
    margin_pct: Decimal | None = None
    tax_rate_pct: Decimal = Decimal("18.0")
    tax_amount_fcfa: int
    total_fcfa: int
    payment_terms: str | None = None
    validity_days: int = 30
    status: str = "draft"


class QuoteUpdate(BaseModel):
    reference: str | None = None
    line_items: dict | None = None
    subtotal_fcfa: int | None = None
    margin_pct: Decimal | None = None
    tax_rate_pct: Decimal | None = None
    tax_amount_fcfa: int | None = None
    total_fcfa: int | None = None
    payment_terms: str | None = None
    validity_days: int | None = None
    status: str | None = None


class QuoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    installer_id: uuid.UUID
    reference: str | None = None
    line_items: dict
    subtotal_fcfa: int
    margin_pct: Decimal | None = None
    tax_rate_pct: Decimal
    tax_amount_fcfa: int
    total_fcfa: int
    payment_terms: str | None = None
    validity_days: int
    status: str
    created_at: datetime
    updated_at: datetime
