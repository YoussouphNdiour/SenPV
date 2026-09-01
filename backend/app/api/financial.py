"""Financial analysis API endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.financial import FinancialAnalysis
from app.models.project import Project
from app.models.simulation import Simulation
from app.services.financial import calculate_financial_analysis

router = APIRouter(prefix="/projects/{project_id}", tags=["financial"])


class FinancialRequest(BaseModel):
    total_cost_fcfa: int = Field(..., gt=0, description="Total installation cost in FCFA")
    annual_savings_fcfa: int = Field(..., gt=0, description="Annual savings in FCFA from SENELEC")
    maintenance_annual_fcfa: int = Field(0, ge=0, description="Annual maintenance cost in FCFA")
    degradation_rate_pct: float = Field(0.5, ge=0, le=5, description="Annual degradation rate (%)")
    discount_rate_pct: float = Field(8.0, ge=0, le=30, description="Discount rate for NPV (%)")
    inflation_rate_pct: float = Field(2.0, ge=0, le=20, description="Annual tariff inflation rate (%)")


@router.post("/financial", status_code=status.HTTP_201_CREATED)
async def create_financial_analysis(
    project_id: uuid.UUID,
    body: FinancialRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Run a financial analysis for a project based on its latest simulation."""
    # Verify project ownership
    proj_result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    # Load latest simulation
    sim_result = await db.execute(
        select(Simulation)
        .where(Simulation.project_id == project_id)
        .order_by(Simulation.created_at.desc())
        .limit(1)
    )
    simulation = sim_result.scalar_one_or_none()
    if not simulation:
        raise HTTPException(
            status_code=400,
            detail="No simulation found for this project. Run a simulation first.",
        )

    annual_production_kwh = float(simulation.annual_kwh)

    # Calculate
    result = calculate_financial_analysis(
        total_cost_fcfa=body.total_cost_fcfa,
        annual_production_kwh=annual_production_kwh,
        annual_savings_fcfa=body.annual_savings_fcfa,
        degradation_rate_pct=body.degradation_rate_pct,
        discount_rate_pct=body.discount_rate_pct,
        inflation_rate_pct=body.inflation_rate_pct,
        maintenance_annual_fcfa=body.maintenance_annual_fcfa,
    )

    # Save to DB
    analysis = FinancialAnalysis(
        simulation_id=simulation.id,
        total_cost_fcfa=body.total_cost_fcfa,
        annual_savings_fcfa=body.annual_savings_fcfa,
        npv_fcfa=result["npv_fcfa"],
        irr_pct=result["irr_pct"],
        payback_years=result["payback_years"],
        cashflow_25y=result["cashflow_25y"],
        degradation_rate_pct=body.degradation_rate_pct,
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    return {
        "id": str(analysis.id),
        "simulation_id": str(simulation.id),
        **result,
    }


@router.get("/financial")
async def get_financial_analysis(
    project_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Get the latest financial analysis for a project."""
    # Verify project ownership
    proj_result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    # Find latest financial analysis for this project via simulation
    result = await db.execute(
        select(FinancialAnalysis)
        .join(Simulation, FinancialAnalysis.simulation_id == Simulation.id)
        .where(Simulation.project_id == project_id)
        .order_by(FinancialAnalysis.created_at.desc())
        .limit(1)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="No financial analysis found")

    return {
        "id": str(analysis.id),
        "simulation_id": str(analysis.simulation_id),
        "total_cost_fcfa": analysis.total_cost_fcfa,
        "annual_savings_fcfa": analysis.annual_savings_fcfa,
        "npv_fcfa": analysis.npv_fcfa,
        "irr_pct": float(analysis.irr_pct) if analysis.irr_pct is not None else None,
        "payback_years": float(analysis.payback_years) if analysis.payback_years is not None else None,
        "cashflow_25y": analysis.cashflow_25y,
        "degradation_rate_pct": float(analysis.degradation_rate_pct),
    }
