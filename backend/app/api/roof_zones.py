import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from geoalchemy2.functions import ST_Area, ST_AsGeoJSON, ST_GeomFromGeoJSON
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.project import Project
from app.models.roof_zone import RoofZone
from app.schemas.roof_zone import RoofZoneCreate, RoofZoneRead, RoofZoneUpdate

router = APIRouter(prefix="/projects/{project_id}/zones", tags=["roof-zones"])


async def _get_project_for_user(
    project_id: uuid.UUID, user: CurrentUser, db: AsyncSession
) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    return project


def _zone_to_dict(zone: RoofZone, polygon_geojson: str | None) -> dict:
    data = {
        "id": zone.id,
        "project_id": zone.project_id,
        "orientation_deg": zone.orientation_deg,
        "tilt_deg": zone.tilt_deg,
        "roof_type": zone.roof_type,
        "area_m2": zone.area_m2,
        "zone_index": zone.zone_index,
        "created_at": zone.created_at,
    }
    if polygon_geojson:
        data["polygon"] = json.loads(polygon_geojson)
    return data


@router.get("", response_model=list[RoofZoneRead])
async def list_zones(
    project_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_for_user(project_id, user, db)

    result = await db.execute(
        select(
            RoofZone,
            ST_AsGeoJSON(RoofZone.polygon).label("polygon_geojson"),
        )
        .where(RoofZone.project_id == project_id)
        .order_by(RoofZone.zone_index)
    )
    rows = result.all()
    return [_zone_to_dict(row[0], row[1]) for row in rows]


@router.post("", response_model=RoofZoneRead, status_code=status.HTTP_201_CREATED)
async def create_zone(
    project_id: uuid.UUID,
    body: RoofZoneCreate,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_for_user(project_id, user, db)

    # Determine next zone_index
    result = await db.execute(
        select(func.coalesce(func.max(RoofZone.zone_index), -1))
        .where(RoofZone.project_id == project_id)
    )
    next_index = result.scalar() + 1

    zone = RoofZone(
        project_id=project_id,
        orientation_deg=body.orientation_deg,
        tilt_deg=body.tilt_deg,
        roof_type=body.roof_type,
        zone_index=next_index,
    )

    # Convert GeoJSON polygon to PostGIS geometry and compute area
    if body.polygon:
        geojson_str = json.dumps(body.polygon) if isinstance(body.polygon, dict) else str(body.polygon)
        zone.polygon = ST_GeomFromGeoJSON(geojson_str)

    db.add(zone)
    await db.flush()

    # Compute area using geography cast for m² result
    if body.polygon:
        area_result = await db.execute(
            select(ST_Area(RoofZone.polygon.cast_to_geography())).where(RoofZone.id == zone.id)
        )
        area_m2 = area_result.scalar()
        zone.area_m2 = round(area_m2, 2) if area_m2 else None

    await db.commit()
    await db.refresh(zone)

    # Re-read with GeoJSON
    result = await db.execute(
        select(
            RoofZone,
            ST_AsGeoJSON(RoofZone.polygon).label("polygon_geojson"),
        ).where(RoofZone.id == zone.id)
    )
    row = result.one()
    return _zone_to_dict(row[0], row[1])


@router.put("/{zone_id}", response_model=RoofZoneRead)
async def update_zone(
    project_id: uuid.UUID,
    zone_id: uuid.UUID,
    body: RoofZoneUpdate,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_for_user(project_id, user, db)

    result = await db.execute(
        select(RoofZone).where(RoofZone.id == zone_id, RoofZone.project_id == project_id)
    )
    zone = result.scalar_one_or_none()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    update_data = body.model_dump(exclude_unset=True)

    polygon_changed = False
    if "polygon" in update_data and update_data["polygon"] is not None:
        geojson_str = json.dumps(update_data.pop("polygon"))
        zone.polygon = ST_GeomFromGeoJSON(geojson_str)
        polygon_changed = True
    else:
        update_data.pop("polygon", None)

    for key, value in update_data.items():
        setattr(zone, key, value)

    await db.flush()

    # Recompute area if polygon changed
    if polygon_changed:
        area_result = await db.execute(
            select(ST_Area(RoofZone.polygon.cast_to_geography())).where(RoofZone.id == zone.id)
        )
        area_m2 = area_result.scalar()
        zone.area_m2 = round(area_m2, 2) if area_m2 else None

    await db.commit()
    await db.refresh(zone)

    result = await db.execute(
        select(
            RoofZone,
            ST_AsGeoJSON(RoofZone.polygon).label("polygon_geojson"),
        ).where(RoofZone.id == zone.id)
    )
    row = result.one()
    return _zone_to_dict(row[0], row[1])


@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_zone(
    project_id: uuid.UUID,
    zone_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_for_user(project_id, user, db)

    result = await db.execute(
        select(RoofZone).where(RoofZone.id == zone_id, RoofZone.project_id == project_id)
    )
    zone = result.scalar_one_or_none()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    await db.delete(zone)
    await db.commit()
