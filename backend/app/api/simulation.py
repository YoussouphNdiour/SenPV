import hashlib
import json
import logging
import uuid

import redis
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.dependencies import CurrentUser
from app.models.equipment import Equipment
from app.models.panel_layout import PanelLayout
from app.models.project import Project
from app.models.roof_zone import RoofZone
from app.models.simulation import Simulation
from app.schemas.simulation import SimulateRequest, SimulationRead
from app.services.pvlib_service import optimize_tilt_azimuth, simulate_pv

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}", tags=["simulation"])

CACHE_TTL = 86400  # 24h


def _get_redis():
    """Get a Redis connection. Returns None if Redis is unavailable."""
    try:
        r = redis.from_url(settings.redis_url, decode_responses=True)
        r.ping()
        return r
    except Exception:
        logger.warning("Redis unavailable, skipping cache")
        return None


def _cache_key(lat, lon, tilt, azimuth, panel_model_id, num_panels, num_strings):
    raw = f"{lat}:{lon}:{tilt}:{azimuth}:{panel_model_id}:{num_panels}:{num_strings}"
    return f"sim:{hashlib.sha256(raw.encode()).hexdigest()[:16]}"


async def _load_layout_with_equipment(
    db: AsyncSession,
    project_id: uuid.UUID,
    panel_layout_id: uuid.UUID | None,
):
    """Load the panel layout and its related roof zone + equipment."""
    if panel_layout_id:
        result = await db.execute(
            select(PanelLayout)
            .options(selectinload(PanelLayout.roof_zone))
            .where(PanelLayout.id == panel_layout_id)
        )
        layout = result.scalar_one_or_none()
        if not layout:
            raise HTTPException(status_code=404, detail="Panel layout not found")
    else:
        # Find first layout for this project
        result = await db.execute(
            select(PanelLayout)
            .join(RoofZone, PanelLayout.roof_zone_id == RoofZone.id)
            .options(selectinload(PanelLayout.roof_zone))
            .where(RoofZone.project_id == project_id)
            .limit(1)
        )
        layout = result.scalar_one_or_none()
        if not layout:
            raise HTTPException(status_code=404, detail="No panel layout found for this project")

    # Load panel specs
    panel_result = await db.execute(
        select(Equipment).where(Equipment.id == layout.panel_model_id)
    )
    panel = panel_result.scalar_one_or_none()
    if not panel:
        raise HTTPException(status_code=404, detail="Panel model not found")

    # Load inverter specs (optional)
    inverter_specs = None
    if layout.inverter_model_id:
        inv_result = await db.execute(
            select(Equipment).where(Equipment.id == layout.inverter_model_id)
        )
        inverter = inv_result.scalar_one_or_none()
        if inverter:
            inverter_specs = inverter.specs

    return layout, panel.specs, inverter_specs


@router.post("/simulate", response_model=SimulationRead, status_code=status.HTTP_201_CREATED)
async def run_simulation(
    project_id: uuid.UUID,
    user: CurrentUser,
    body: SimulateRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Run a PV simulation for a project."""
    if body is None:
        body = SimulateRequest()

    # Verify project ownership
    proj_result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    layout, panel_specs, inverter_specs = await _load_layout_with_equipment(
        db, project_id, body.panel_layout_id,
    )
    zone = layout.roof_zone
    tilt = float(zone.tilt_deg) if zone.tilt_deg is not None else 15.0
    azimuth = float(zone.orientation_deg) if zone.orientation_deg is not None else 180.0

    # Check cache
    cache_k = _cache_key(
        project.lat, project.lon, tilt, azimuth,
        str(layout.panel_model_id), layout.num_panels, layout.num_strings,
    )
    r = _get_redis()
    if r:
        cached = r.get(cache_k)
        if cached:
            sim_result = json.loads(cached)
            logger.info("Cache hit for simulation %s", cache_k)
        else:
            sim_result = simulate_pv(
                lat=project.lat, lon=project.lon,
                tilt=tilt, azimuth=azimuth,
                panel_specs=panel_specs,
                num_panels=layout.num_panels,
                num_strings=layout.num_strings,
                panels_per_string=layout.panels_per_string,
                inverter_specs=inverter_specs,
                losses_pct=body.losses_pct,
                albedo=body.albedo,
            )
            r.setex(cache_k, CACHE_TTL, json.dumps(sim_result))
    else:
        sim_result = simulate_pv(
            lat=project.lat, lon=project.lon,
            tilt=tilt, azimuth=azimuth,
            panel_specs=panel_specs,
            num_panels=layout.num_panels,
            num_strings=layout.num_strings,
            panels_per_string=layout.panels_per_string,
            inverter_specs=inverter_specs,
            losses_pct=body.losses_pct,
            albedo=body.albedo,
        )

    # Save to DB
    simulation = Simulation(
        project_id=project_id,
        panel_layout_id=layout.id,
        params={
            "lat": project.lat,
            "lon": project.lon,
            "tilt": tilt,
            "azimuth": azimuth,
            "num_panels": layout.num_panels,
            "num_strings": layout.num_strings,
            "panels_per_string": layout.panels_per_string,
            "losses_pct": body.losses_pct,
            "albedo": body.albedo,
        },
        monthly_production=sim_result["monthly_production"],
        annual_kwh=sim_result["annual_kwh"],
        specific_yield=sim_result.get("specific_yield"),
        peak_power_kwc=sim_result.get("peak_power_kwc"),
        performance_ratio=sim_result.get("performance_ratio"),
    )
    db.add(simulation)
    await db.commit()
    await db.refresh(simulation)
    return simulation


@router.get("/simulations", response_model=list[SimulationRead])
async def list_simulations(
    project_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Get simulation history for a project."""
    proj_result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(Simulation)
        .where(Simulation.project_id == project_id)
        .order_by(Simulation.created_at.desc())
    )
    return result.scalars().all()


@router.post("/optimize")
async def optimize(
    project_id: uuid.UUID,
    user: CurrentUser,
    body: SimulateRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Find optimal tilt and azimuth for this project's location."""
    if body is None:
        body = SimulateRequest()

    proj_result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    layout, panel_specs, inverter_specs = await _load_layout_with_equipment(
        db, project_id, body.panel_layout_id,
    )

    # Check cache for optimization result
    opt_cache_key = f"opt:{project.lat}:{project.lon}:{layout.panel_model_id}:{layout.num_panels}"
    r = _get_redis()
    if r:
        cached = r.get(opt_cache_key)
        if cached:
            return json.loads(cached)

    result = optimize_tilt_azimuth(
        lat=project.lat, lon=project.lon,
        panel_specs=panel_specs,
        num_panels=layout.num_panels,
        num_strings=layout.num_strings,
        panels_per_string=layout.panels_per_string,
        inverter_specs=inverter_specs,
    )

    if r:
        r.setex(opt_cache_key, CACHE_TTL, json.dumps(result))

    return result
