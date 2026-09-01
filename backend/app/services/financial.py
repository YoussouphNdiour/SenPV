"""Financial analysis service — 25-year NPV, IRR, payback, cashflow."""

import numpy_financial as npf


def calculate_financial_analysis(
    total_cost_fcfa: int,
    annual_production_kwh: float,
    annual_savings_fcfa: int,
    degradation_rate_pct: float = 0.5,
    discount_rate_pct: float = 8.0,
    inflation_rate_pct: float = 2.0,
    maintenance_annual_fcfa: int = 0,
    project_lifetime_years: int = 25,
) -> dict:
    """
    Full financial analysis over the project lifetime.

    - Production decreases each year (degradation: -0.5%/yr default)
    - SENELEC tariffs increase (inflation: +2%/yr default)
    - Optional annual maintenance cost

    Returns dict with total_cost, payback_years, npv, irr, roi, lcoe,
    and a year-by-year cashflow array.
    """
    cashflow = []
    cumulative = -total_cost_fcfa

    # Year 0: initial investment
    cashflow.append({
        "year": 0,
        "production_kwh": 0,
        "savings_fcfa": 0,
        "maintenance_fcfa": 0,
        "net_cashflow_fcfa": -total_cost_fcfa,
        "cumulative_fcfa": cumulative,
    })

    payback_year = None
    net_cashflows = [-total_cost_fcfa]

    for year in range(1, project_lifetime_years + 1):
        # Degraded production
        prod = annual_production_kwh * (1 - degradation_rate_pct / 100) ** (year - 1)

        # Savings with tariff inflation
        savings = annual_savings_fcfa * (1 + inflation_rate_pct / 100) ** (year - 1)

        maint = maintenance_annual_fcfa
        net = savings - maint
        cumulative += net
        net_cashflows.append(net)

        cashflow.append({
            "year": year,
            "production_kwh": round(prod, 1),
            "savings_fcfa": round(savings),
            "maintenance_fcfa": maint,
            "net_cashflow_fcfa": round(net),
            "cumulative_fcfa": round(cumulative),
        })

        if payback_year is None and cumulative >= 0:
            prev_cumulative = cashflow[-2]["cumulative_fcfa"]
            payback_year = round(year - 1 + abs(prev_cumulative) / net, 1)

    # NPV (Net Present Value)
    npv = sum(
        cf / (1 + discount_rate_pct / 100) ** y
        for y, cf in enumerate(net_cashflows)
    )

    # IRR (Internal Rate of Return)
    try:
        irr = npf.irr(net_cashflows) * 100
        if irr != irr:  # NaN check
            irr = None
    except Exception:
        irr = None

    # LCOE (Levelized Cost of Energy)
    total_production = sum(
        annual_production_kwh * (1 - degradation_rate_pct / 100) ** (y - 1)
        for y in range(1, project_lifetime_years + 1)
    )
    lcoe = total_cost_fcfa / total_production if total_production > 0 else 0

    # ROI
    total_savings = sum(cf["savings_fcfa"] for cf in cashflow[1:])
    roi = ((total_savings - total_cost_fcfa) / total_cost_fcfa) * 100 if total_cost_fcfa > 0 else 0

    return {
        "total_cost_fcfa": total_cost_fcfa,
        "annual_savings_year1_fcfa": annual_savings_fcfa,
        "payback_years": payback_year,
        "npv_fcfa": round(npv),
        "irr_pct": round(irr, 1) if irr is not None else None,
        "roi_pct": round(roi, 1),
        "lcoe_fcfa_per_kwh": round(lcoe, 1),
        "cashflow_25y": cashflow,
    }
