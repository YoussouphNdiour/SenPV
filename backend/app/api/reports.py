"""Report generation and download endpoints."""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.financial import FinancialAnalysis
from app.models.project import Project
from app.models.quote import Quote
from app.models.report import Report
from app.models.schematic import Schematic
from app.models.simulation import Simulation
from app.models.user import User
from app.schemas.report import ReportRead
from app.config import settings

router = APIRouter(prefix="/projects/{project_id}", tags=["reports"])


async def _get_project_or_404(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    user_role: str,
    db: AsyncSession,
) -> Project:
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.client))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != user_id and user_role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    return project


async def _load_simulation_data(db: AsyncSession, project_id: uuid.UUID) -> dict | None:
    """Load the latest simulation and its related equipment info for a project."""
    result = await db.execute(
        select(Simulation)
        .options(selectinload(Simulation.panel_layout))
        .where(Simulation.project_id == project_id)
        .order_by(Simulation.created_at.desc())
        .limit(1)
    )
    sim = result.scalar_one_or_none()
    if not sim:
        return None

    # Build a dict compatible with template rendering
    monthly = sim.monthly_production if isinstance(sim.monthly_production, list) else []
    params = sim.params if isinstance(sim.params, dict) else {}

    data = {
        "annual_kwh": float(sim.annual_kwh) if sim.annual_kwh else 0,
        "specific_yield": float(sim.specific_yield) if sim.specific_yield else 0,
        "peak_power_kwc": float(sim.peak_power_kwc) if sim.peak_power_kwc else 0,
        "performance_ratio": float(sim.performance_ratio) if sim.performance_ratio else 0,
        "monthly_production": monthly,
        "num_panels": params.get("num_panels"),
        "tilt": params.get("tilt"),
        "azimuth": params.get("azimuth"),
        "panel_info": params.get("panel_specs", {}),
        "inverter_info": params.get("inverter_specs"),
    }
    # Add model name from panel_specs if available
    if isinstance(data["panel_info"], dict) and "model" not in data["panel_info"]:
        data["panel_info"]["model"] = data["panel_info"].get("manufacturer", "")

    return data


async def _load_financial_data(db: AsyncSession, project_id: uuid.UUID) -> dict | None:
    """Load the latest financial analysis for a project."""
    result = await db.execute(
        select(FinancialAnalysis)
        .join(Simulation, Simulation.id == FinancialAnalysis.simulation_id)
        .where(Simulation.project_id == project_id)
        .order_by(FinancialAnalysis.created_at.desc())
        .limit(1)
    )
    fa = result.scalar_one_or_none()
    if not fa:
        return None

    return {
        "total_cost_fcfa": fa.total_cost_fcfa,
        "annual_savings_year1_fcfa": fa.annual_savings_fcfa,
        "payback_years": float(fa.payback_years) if fa.payback_years else None,
        "npv_fcfa": fa.npv_fcfa,
        "irr_pct": float(fa.irr_pct) if fa.irr_pct else None,
        "lcoe_fcfa_per_kwh": 0,  # recalculate below if possible
        "cashflow_25y": fa.cashflow_25y if isinstance(fa.cashflow_25y, list) else [],
    }


async def _load_schematic_svg(db: AsyncSession, project_id: uuid.UUID) -> str | None:
    result = await db.execute(
        select(Schematic.svg_snapshot).where(Schematic.project_id == project_id)
    )
    row = result.scalar_one_or_none()
    return row if row else None


async def _load_latest_quote(db: AsyncSession, project_id: uuid.UUID):
    result = await db.execute(
        select(Quote)
        .where(Quote.project_id == project_id)
        .order_by(Quote.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


# ---- POST /projects/{id}/report ---- full report
@router.post("/report", response_model=ReportRead, status_code=status.HTTP_201_CREATED)
async def generate_full_report(
    project_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Generate a full PDF report for the project."""
    project = await _get_project_or_404(project_id, user.id, user.role, db)

    simulation_data = await _load_simulation_data(db, project_id)
    financial_data = await _load_financial_data(db, project_id)
    schematic_svg = await _load_schematic_svg(db, project_id)
    quote = await _load_latest_quote(db, project_id)

    # Load installer profile if quote exists
    installer = None
    if quote:
        inst_result = await db.execute(
            select(User)
            .options(selectinload(User.installer_profile))
            .where(User.id == quote.installer_id)
        )
        installer = inst_result.scalar_one_or_none()

    from app.services.pdf import generate_full_report as gen_report, save_report_pdf

    pdf_bytes = gen_report(
        project=project,
        simulation_data=simulation_data,
        financial_data=financial_data,
        schematic_svg=schematic_svg,
        quote=quote,
        installer=installer,
    )

    file_path = save_report_pdf(str(project_id), pdf_bytes, "full_report")

    report = Report(
        project_id=project_id,
        type="full_report",
        file_path=file_path,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


# ---- POST /projects/{id}/report/quote ---- quote-only PDF
@router.post("/report/quote")
async def generate_quote_report(
    project_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Generate a quote-only PDF and return it directly."""
    project = await _get_project_or_404(project_id, user.id, user.role, db)

    quote = await _load_latest_quote(db, project_id)
    if not quote:
        raise HTTPException(status_code=404, detail="No quote found for this project")

    inst_result = await db.execute(
        select(User)
        .options(selectinload(User.installer_profile))
        .where(User.id == quote.installer_id)
    )
    installer = inst_result.scalar_one_or_none()

    from app.services.pdf import generate_quote_pdf

    pdf_bytes = generate_quote_pdf(quote=quote, project=project, installer=installer)

    filename = f"devis-{quote.reference or str(quote.id)[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---- POST /projects/{id}/report/schematic ---- schematic-only PDF
@router.post("/report/schematic")
async def generate_schematic_report(
    project_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Generate a schematic-only PDF and return it directly."""
    project = await _get_project_or_404(project_id, user.id, user.role, db)

    schematic_svg = await _load_schematic_svg(db, project_id)
    if not schematic_svg:
        raise HTTPException(status_code=404, detail="No schematic found for this project")

    from app.services.pdf import generate_schematic_pdf

    pdf_bytes = generate_schematic_pdf(project=project, schematic_svg=schematic_svg)

    filename = f"schema-{project.name}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---- GET /projects/{id}/reports ---- list history
@router.get("/reports", response_model=list[ReportRead])
async def list_reports(
    project_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """List all generated reports for a project."""
    await _get_project_or_404(project_id, user.id, user.role, db)

    result = await db.execute(
        select(Report)
        .where(Report.project_id == project_id)
        .order_by(Report.generated_at.desc())
    )
    return result.scalars().all()


# ---- GET /reports/{id}/download ---- download PDF
@router.get("/reports/{report_id}/download")
async def download_report(
    project_id: uuid.UUID,
    report_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Download a previously generated report PDF."""
    await _get_project_or_404(project_id, user.id, user.role, db)

    result = await db.execute(
        select(Report).where(
            Report.id == report_id,
            Report.project_id == project_id,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    full_path = Path(settings.upload_dir) / report.file_path
    if not full_path.is_file():
        raise HTTPException(status_code=404, detail="Report file not found on disk")

    return FileResponse(
        path=str(full_path),
        media_type="application/pdf",
        filename=full_path.name,
    )


# ---- DELETE /reports/{id} ---- delete report
@router.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    project_id: uuid.UUID,
    report_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Delete a report record and its file."""
    await _get_project_or_404(project_id, user.id, user.role, db)

    result = await db.execute(
        select(Report).where(
            Report.id == report_id,
            Report.project_id == project_id,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Remove file from disk
    full_path = Path(settings.upload_dir) / report.file_path
    if full_path.is_file():
        full_path.unlink()

    await db.delete(report)
    await db.commit()
