"""SENELEC billing API endpoints."""

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.senelec import calculate_bill, calculate_savings

router = APIRouter(prefix="/senelec", tags=["senelec"])

_TARIFF_FILE = Path(__file__).resolve().parent.parent / "data" / "senelec_tariffs.json"


class BillRequest(BaseModel):
    monthly_kwh: float = Field(..., gt=0, description="Monthly consumption in kWh")
    tariff_tier: str | None = Field(None, description="Tariff tier (DPP/DMP/DGP/PP)")


class SavingsRequest(BaseModel):
    monthly_kwh: float = Field(..., gt=0, description="Monthly consumption in kWh")
    tariff_tier: str | None = Field(None, description="Tariff tier (DPP/DMP/DGP/PP)")
    annual_production_kwh: float = Field(..., gt=0, description="Annual PV production in kWh")


@router.get("/tariffs")
async def get_tariffs():
    """Return the complete SENELEC tariff grid."""
    with open(_TARIFF_FILE) as f:
        return json.load(f)


@router.post("/bill")
async def compute_bill(body: BillRequest):
    """Calculate a detailed monthly SENELEC bill."""
    if body.tariff_tier and body.tariff_tier not in ("DPP", "DMP", "DGP", "PP"):
        raise HTTPException(status_code=400, detail="Invalid tariff tier")
    return calculate_bill(body.monthly_kwh, body.tariff_tier)


@router.post("/savings")
async def compute_savings(body: SavingsRequest):
    """Calculate savings with a PV installation."""
    if body.tariff_tier and body.tariff_tier not in ("DPP", "DMP", "DGP", "PP"):
        raise HTTPException(status_code=400, detail="Invalid tariff tier")
    return calculate_savings(body.monthly_kwh, body.tariff_tier, body.annual_production_kwh)
