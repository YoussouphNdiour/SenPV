import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class FinancialAnalysisCreate(BaseModel):
    simulation_id: uuid.UUID
    total_cost_fcfa: int
    annual_savings_fcfa: int
    senelec_tariff_applied: dict | None = None
    npv_fcfa: int | None = None
    irr_pct: Decimal | None = None
    payback_years: Decimal | None = None
    cashflow_25y: dict | None = None
    degradation_rate_pct: Decimal = Decimal("0.5")


class FinancialAnalysisRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    simulation_id: uuid.UUID
    total_cost_fcfa: int
    annual_savings_fcfa: int
    senelec_tariff_applied: dict | None = None
    npv_fcfa: int | None = None
    irr_pct: Decimal | None = None
    payback_years: Decimal | None = None
    cashflow_25y: dict | None = None
    degradation_rate_pct: Decimal
    created_at: datetime
