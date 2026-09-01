"""SENELEC billing calculation service.

Computes electricity bills using SENELEC's progressive tariff system
and calculates savings from PV installations.
"""

import json
import math
from pathlib import Path

_TARIFF_FILE = Path(__file__).resolve().parent.parent / "data" / "senelec_tariffs.json"

_tariff_data: dict | None = None


def _load_tariffs() -> dict:
    global _tariff_data
    if _tariff_data is None:
        with open(_TARIFF_FILE) as f:
            _tariff_data = json.load(f)
    return _tariff_data


def _auto_tier(monthly_kwh: float) -> str:
    """Determine the tariff tier automatically based on consumption."""
    if monthly_kwh <= 150:
        return "DPP"
    elif monthly_kwh <= 250:
        return "DMP"
    else:
        return "DGP"


def calculate_bill(monthly_kwh: float, tariff_tier: str | None = None) -> dict:
    """Calculate the monthly SENELEC bill with progressive tariff tiers.

    For domestic customers (DPP/DMP/DGP), billing is progressive:
    - First 150 kWh at DPP rate
    - Next 100 kWh (151-250) at DMP rate
    - Above 250 kWh at DGP rate

    For professional customers (PP), a flat rate applies.
    """
    data = _load_tariffs()
    tariffs = {t["tier"]: t for t in data["tariffs"]}
    tva_pct = data["taxes"]["tva_pct"]
    redevance = data["taxes"]["redevance_mensuelle_fcfa"]

    if tariff_tier is None:
        tariff_tier = _auto_tier(monthly_kwh)

    breakdown = []
    remaining = monthly_kwh

    if tariff_tier == "PP":
        # Professional: flat rate
        pp = tariffs["PP"]
        amount = math.floor(remaining * pp["price_per_kwh"])
        breakdown.append({
            "tier": "PP",
            "kwh": remaining,
            "rate": pp["price_per_kwh"],
            "amount": amount,
        })
    else:
        # Domestic: progressive tiers
        domestic_tiers = [
            ("DPP", 150),
            ("DMP", 100),  # 151-250 = 100 kWh
            ("DGP", None),  # unlimited
        ]
        for tier_name, tier_limit in domestic_tiers:
            if remaining <= 0:
                break
            tier_info = tariffs[tier_name]
            kwh_in_tier = min(remaining, tier_limit) if tier_limit else remaining
            amount = math.floor(kwh_in_tier * tier_info["price_per_kwh"])
            breakdown.append({
                "tier": tier_name,
                "kwh": kwh_in_tier,
                "rate": tier_info["price_per_kwh"],
                "amount": amount,
            })
            remaining -= kwh_in_tier

    subtotal = sum(b["amount"] for b in breakdown)
    tva_amount = math.floor(subtotal * tva_pct / 100)
    total_monthly = subtotal + redevance + tva_amount
    total_annual = total_monthly * 12

    return {
        "monthly_kwh": monthly_kwh,
        "tariff_tier": tariff_tier,
        "breakdown": breakdown,
        "subtotal_fcfa": subtotal,
        "redevance_fcfa": redevance,
        "tva_pct": tva_pct,
        "tva_amount_fcfa": tva_amount,
        "total_monthly_fcfa": total_monthly,
        "total_annual_fcfa": total_annual,
    }


def calculate_savings(
    monthly_kwh: float,
    tariff_tier: str | None,
    annual_production_kwh: float,
) -> dict:
    """Calculate savings from a PV installation.

    The PV production reduces grid consumption. Excess production
    is NOT valued (no SENELEC buyback for residential customers).
    """
    bill_without = calculate_bill(monthly_kwh, tariff_tier)

    # Monthly PV production (assumed uniform distribution)
    monthly_pv = annual_production_kwh / 12.0

    # Reduced grid consumption (can't go below 0)
    reduced_kwh = max(0, monthly_kwh - monthly_pv)

    bill_with = calculate_bill(reduced_kwh, tariff_tier)

    monthly_savings = bill_without["total_monthly_fcfa"] - bill_with["total_monthly_fcfa"]
    annual_savings = monthly_savings * 12

    # Self-consumption: how much of the PV production is actually used
    actual_self_consumed = min(monthly_pv, monthly_kwh)
    self_consumption_pct = (
        round(actual_self_consumed / monthly_pv * 100, 1)
        if monthly_pv > 0
        else 0.0
    )

    # Grid reduction: how much the grid bill is reduced
    grid_reduction_pct = (
        round((1 - bill_with["total_monthly_fcfa"] / bill_without["total_monthly_fcfa"]) * 100, 1)
        if bill_without["total_monthly_fcfa"] > 0
        else 0.0
    )

    return {
        "bill_without_pv": bill_without,
        "bill_with_pv": bill_with,
        "monthly_savings_fcfa": monthly_savings,
        "annual_savings_fcfa": annual_savings,
        "self_consumption_pct": self_consumption_pct,
        "grid_reduction_pct": grid_reduction_pct,
    }
