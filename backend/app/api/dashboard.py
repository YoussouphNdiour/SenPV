import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, cast, distinct, extract, func, select, Integer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser, RequireAdmin
from app.models.client import Client
from app.models.financial import FinancialAnalysis
from app.models.project import Project
from app.models.quote import Quote
from app.models.simulation import Simulation
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
async def dashboard_stats(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Return KPI stats based on user role."""

    if user.role == "admin":
        # Admin: total users, total projects, total kWc, nb installers
        total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
        total_projects = (await db.execute(select(func.count(Project.id)))).scalar() or 0

        kwc_result = await db.execute(
            select(func.coalesce(func.sum(Simulation.peak_power_kwc), 0))
        )
        total_kwc = float(kwc_result.scalar() or 0)

        nb_installers = (
            await db.execute(
                select(func.count(User.id)).where(User.role == "installer", User.is_active == True)
            )
        ).scalar() or 0

        return {
            "total_users": total_users,
            "total_projects": total_projects,
            "total_kwc": round(total_kwc, 2),
            "nb_installers": nb_installers,
        }

    elif user.role == "installer":
        # Installer: nb clients, nb projects, total kWc, CA devis acceptés, projets en cours
        nb_clients = (
            await db.execute(
                select(func.count(Client.id)).where(Client.installer_id == user.id)
            )
        ).scalar() or 0

        nb_projects = (
            await db.execute(
                select(func.count(Project.id)).where(Project.user_id == user.id)
            )
        ).scalar() or 0

        kwc_result = await db.execute(
            select(func.coalesce(func.sum(Simulation.peak_power_kwc), 0))
            .join(Project, Simulation.project_id == Project.id)
            .where(Project.user_id == user.id)
        )
        total_kwc = float(kwc_result.scalar() or 0)

        ca_result = await db.execute(
            select(func.coalesce(func.sum(Quote.total_fcfa), 0))
            .where(Quote.installer_id == user.id, Quote.status == "accepted")
        )
        ca_devis = int(ca_result.scalar() or 0)

        active_projects = (
            await db.execute(
                select(func.count(Project.id)).where(
                    Project.user_id == user.id,
                    Project.status.notin_(["draft", "installed"]),
                )
            )
        ).scalar() or 0

        return {
            "nb_clients": nb_clients,
            "nb_projects": nb_projects,
            "total_kwc": round(total_kwc, 2),
            "ca_devis_accepted": ca_devis,
            "active_projects": active_projects,
        }

    else:
        # Particulier: nb projects, total kWc, total savings
        nb_projects = (
            await db.execute(
                select(func.count(Project.id)).where(Project.user_id == user.id)
            )
        ).scalar() or 0

        kwc_result = await db.execute(
            select(func.coalesce(func.sum(Simulation.peak_power_kwc), 0))
            .join(Project, Simulation.project_id == Project.id)
            .where(Project.user_id == user.id)
        )
        total_kwc = float(kwc_result.scalar() or 0)

        savings_result = await db.execute(
            select(func.coalesce(func.sum(FinancialAnalysis.annual_savings_fcfa), 0))
            .join(Simulation, FinancialAnalysis.simulation_id == Simulation.id)
            .join(Project, Simulation.project_id == Project.id)
            .where(Project.user_id == user.id)
        )
        total_savings = int(savings_result.scalar() or 0)

        return {
            "nb_projects": nb_projects,
            "total_kwc": round(total_kwc, 2),
            "total_savings": total_savings,
        }


@router.get("/recent-projects")
async def recent_projects(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Return 5 most recent projects for the user (all for admin)."""
    query = (
        select(Project)
        .order_by(Project.created_at.desc())
        .limit(5)
    )

    if user.role != "admin":
        query = query.where(Project.user_id == user.id)

    result = await db.execute(query)
    projects = result.scalars().all()

    items = []
    for p in projects:
        # Get peak_power_kwc from latest simulation
        sim_result = await db.execute(
            select(Simulation.peak_power_kwc)
            .where(Simulation.project_id == p.id)
            .order_by(Simulation.created_at.desc())
            .limit(1)
        )
        peak_kwc = sim_result.scalar()

        # Get quote total
        quote_result = await db.execute(
            select(Quote.total_fcfa)
            .where(Quote.project_id == p.id)
            .order_by(Quote.created_at.desc())
            .limit(1)
        )
        quote_total = quote_result.scalar()

        # Get client name
        client_name = None
        if p.client_id:
            client_res = await db.execute(
                select(Client.name).where(Client.id == p.client_id)
            )
            client_name = client_res.scalar()

        items.append({
            "id": str(p.id),
            "name": p.name,
            "address": p.address,
            "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "peak_power_kwc": float(peak_kwc) if peak_kwc else None,
            "quote_total_fcfa": int(quote_total) if quote_total else None,
            "client_name": client_name,
        })

    return items


@router.get("/pipeline")
async def pipeline(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Return projects grouped by status for installer pipeline view."""
    if user.role not in ("installer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Pipeline is only available for installers",
        )

    query = select(Project).where(Project.user_id == user.id)
    if user.role == "admin":
        query = select(Project)

    result = await db.execute(query)
    projects = result.scalars().all()

    pipeline_data: dict[str, list] = {
        "draft": [],
        "study": [],
        "quote": [],
        "signed": [],
        "installed": [],
    }

    for p in projects:
        # Get client name
        client_name = None
        if p.client_id:
            client_res = await db.execute(
                select(Client.name).where(Client.id == p.client_id)
            )
            client_name = client_res.scalar()

        # Get peak power
        sim_result = await db.execute(
            select(Simulation.peak_power_kwc)
            .where(Simulation.project_id == p.id)
            .order_by(Simulation.created_at.desc())
            .limit(1)
        )
        peak_kwc = sim_result.scalar()

        # Get quote total
        quote_result = await db.execute(
            select(Quote.total_fcfa)
            .where(Quote.project_id == p.id)
            .order_by(Quote.created_at.desc())
            .limit(1)
        )
        quote_total = quote_result.scalar()

        item = {
            "id": str(p.id),
            "name": p.name,
            "status": p.status,
            "client_name": client_name,
            "peak_power_kwc": float(peak_kwc) if peak_kwc else None,
            "quote_total_fcfa": int(quote_total) if quote_total else None,
        }

        if p.status in pipeline_data:
            pipeline_data[p.status].append(item)

    return pipeline_data


@router.get("/charts")
async def charts(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Return chart data: projects per month (last 6 months), registrations per month (admin)."""
    now = datetime.now(timezone.utc)
    six_months_ago = now - timedelta(days=180)

    # Projects per month
    projects_query = (
        select(
            extract("year", Project.created_at).label("year"),
            extract("month", Project.created_at).label("month"),
            func.count(Project.id).label("count"),
        )
        .where(Project.created_at >= six_months_ago)
        .group_by(
            extract("year", Project.created_at),
            extract("month", Project.created_at),
        )
        .order_by(
            extract("year", Project.created_at),
            extract("month", Project.created_at),
        )
    )

    if user.role != "admin":
        projects_query = projects_query.where(Project.user_id == user.id)

    result = await db.execute(projects_query)
    projects_by_month = [
        {"year": int(r.year), "month": int(r.month), "count": r.count}
        for r in result.all()
    ]

    data = {"projects_by_month": projects_by_month}

    # Admin: registrations per month
    if user.role == "admin":
        reg_query = (
            select(
                extract("year", User.created_at).label("year"),
                extract("month", User.created_at).label("month"),
                func.count(User.id).label("count"),
            )
            .where(User.created_at >= six_months_ago)
            .group_by(
                extract("year", User.created_at),
                extract("month", User.created_at),
            )
            .order_by(
                extract("year", User.created_at),
                extract("month", User.created_at),
            )
        )
        result = await db.execute(reg_query)
        data["registrations_by_month"] = [
            {"year": int(r.year), "month": int(r.month), "count": r.count}
            for r in result.all()
        ]

    return data
