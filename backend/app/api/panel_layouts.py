import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from geoalchemy2.functions import ST_AsGeoJSON, ST_Contains, ST_GeomFromText
from shapely.geometry import Polygon as ShapelyPolygon
from shapely.geometry import shape
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.equipment import Equipment
from app.models.panel_layout import PanelLayout
from app.models.project import Project
from app.models.roof_zone import RoofZone
from app.schemas.panel_layout import (
    AddPanelRequest,
    PanelLayoutCreate,
    PanelLayoutRead,
    PanelLayoutUpdate,
)
from app.services.calpinage import compute_calpinage, suggest_strings

router = APIRouter(prefix="/projects/{project_id}/layouts", tags=["panel-layouts"])


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


def _layout_to_dict(layout: PanelLayout) -> dict:
    return {
        "id": layout.id,
        "roof_zone_id": layout.roof_zone_id,
        "panel_model_id": layout.panel_model_id,
        "inverter_model_id": layout.inverter_model_id,
        "num_panels": layout.num_panels,
        "num_strings": layout.num_strings,
        "panels_per_string": layout.panels_per_string,
        "spacing_x": layout.spacing_x,
        "spacing_y": layout.spacing_y,
        "layout_geojson": layout.layout_geojson,
        "created_at": layout.created_at,
        "updated_at": layout.updated_at,
    }


@router.get("", response_model=list[PanelLayoutRead])
async def list_layouts(
    project_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_for_user(project_id, user, db)

    # Get all zones for this project, then their layouts
    zone_result = await db.execute(
        select(RoofZone.id).where(RoofZone.project_id == project_id)
    )
    zone_ids = [row[0] for row in zone_result.all()]

    if not zone_ids:
        return []

    result = await db.execute(
        select(PanelLayout).where(PanelLayout.roof_zone_id.in_(zone_ids))
    )
    layouts = result.scalars().all()
    return [_layout_to_dict(l) for l in layouts]


@router.post("", response_model=PanelLayoutRead, status_code=status.HTTP_201_CREATED)
async def create_layout(
    project_id: uuid.UUID,
    body: PanelLayoutCreate,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_for_user(project_id, user, db)

    # Load roof zone with polygon
    zone_result = await db.execute(
        select(
            RoofZone,
            ST_AsGeoJSON(RoofZone.polygon).label("polygon_geojson"),
        ).where(RoofZone.id == body.roof_zone_id, RoofZone.project_id == project_id)
    )
    row = zone_result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Roof zone not found")

    zone, polygon_geojson = row
    if not polygon_geojson:
        raise HTTPException(status_code=400, detail="Roof zone has no polygon")

    # Load panel model
    panel_result = await db.execute(
        select(Equipment).where(Equipment.id == body.panel_model_id, Equipment.type == "panel")
    )
    panel = panel_result.scalar_one_or_none()
    if not panel:
        raise HTTPException(status_code=404, detail="Panel model not found")

    # Load inverter model (optional)
    inverter_specs = None
    if body.inverter_model_id:
        inv_result = await db.execute(
            select(Equipment).where(
                Equipment.id == body.inverter_model_id, Equipment.type == "inverter"
            )
        )
        inverter = inv_result.scalar_one_or_none()
        if not inverter:
            raise HTTPException(status_code=404, detail="Inverter model not found")
        inverter_specs = inverter.specs

    # Parse polygon GeoJSON to Shapely
    geojson = json.loads(polygon_geojson)
    polygon_shapely = shape(geojson)

    orientation = float(zone.orientation_deg) if zone.orientation_deg is not None else 180.0
    tilt = float(zone.tilt_deg) if zone.tilt_deg is not None else 0.0

    # Run calpinage
    panel_positions = compute_calpinage(
        polygon_wgs84=polygon_shapely,
        panel_specs=panel.specs,
        orientation_deg=orientation,
        tilt_deg=tilt,
        spacing_x=float(body.spacing_x),
        spacing_y=float(body.spacing_y),
    )

    num_panels = len(panel_positions)
    panel_vmp = panel.specs.get("vmp_v") if isinstance(panel.specs, dict) else None
    num_strings, panels_per_string = suggest_strings(num_panels, panel_vmp, inverter_specs)

    # Build GeoJSON FeatureCollection for storage
    layout_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "index": i,
                    "rotation_deg": p["rotation_deg"],
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [p["corners"]],
                },
            }
            for i, p in enumerate(panel_positions)
        ],
    }

    layout = PanelLayout(
        roof_zone_id=body.roof_zone_id,
        panel_model_id=body.panel_model_id,
        inverter_model_id=body.inverter_model_id,
        num_panels=num_panels,
        num_strings=num_strings,
        panels_per_string=panels_per_string,
        spacing_x=body.spacing_x,
        spacing_y=body.spacing_y,
        layout_geojson=layout_geojson,
    )

    db.add(layout)
    await db.commit()
    await db.refresh(layout)

    return _layout_to_dict(layout)


@router.put("/{layout_id}", response_model=PanelLayoutRead)
async def update_layout(
    project_id: uuid.UUID,
    layout_id: uuid.UUID,
    body: PanelLayoutUpdate,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_for_user(project_id, user, db)

    result = await db.execute(select(PanelLayout).where(PanelLayout.id == layout_id))
    layout = result.scalar_one_or_none()
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")

    # Verify layout belongs to this project
    zone_result = await db.execute(
        select(RoofZone).where(
            RoofZone.id == layout.roof_zone_id, RoofZone.project_id == project_id
        )
    )
    if not zone_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Layout not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(layout, key, value)

    await db.commit()
    await db.refresh(layout)
    return _layout_to_dict(layout)


@router.post("/{layout_id}/add-panel", response_model=PanelLayoutRead)
async def add_panel(
    project_id: uuid.UUID,
    layout_id: uuid.UUID,
    body: AddPanelRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_for_user(project_id, user, db)

    result = await db.execute(select(PanelLayout).where(PanelLayout.id == layout_id))
    layout = result.scalar_one_or_none()
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")

    # Get the zone and verify it belongs to this project
    zone_result = await db.execute(
        select(
            RoofZone,
            ST_AsGeoJSON(RoofZone.polygon).label("polygon_geojson"),
        ).where(RoofZone.id == layout.roof_zone_id, RoofZone.project_id == project_id)
    )
    row = zone_result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Layout not found")

    zone, polygon_geojson = row

    # Check that the point is inside the zone polygon
    if polygon_geojson:
        from shapely.geometry import Point, shape as shapely_shape

        zone_polygon = shapely_shape(json.loads(polygon_geojson))
        point = Point(body.lon, body.lat)
        if not zone_polygon.contains(point):
            raise HTTPException(
                status_code=400, detail="Point is outside the roof zone"
            )

    # Load panel model for dimensions
    panel_result = await db.execute(
        select(Equipment).where(Equipment.id == layout.panel_model_id)
    )
    panel = panel_result.scalar_one_or_none()
    if not panel:
        raise HTTPException(status_code=404, detail="Panel model not found")

    # Create panel rectangle corners from center point
    from app.services.calpinage import _panel_corners_wgs84, _to_utm, _to_wgs

    dims = panel.specs.get("dimensions_mm", {}) if isinstance(panel.specs, dict) else {}
    panel_length_m = dims.get("length", 2000) / 1000.0
    panel_width_m = dims.get("width", 1000) / 1000.0
    tilt = float(zone.tilt_deg) if zone.tilt_deg is not None else 0.0
    import math

    projected_width = panel_width_m * math.cos(math.radians(tilt))
    orientation = float(zone.orientation_deg) if zone.orientation_deg is not None else 180.0

    utm_x, utm_y = _to_utm.transform(body.lon, body.lat)
    corners = _panel_corners_wgs84(
        utm_x, utm_y, panel_length_m / 2, projected_width / 2, orientation
    )

    # Add panel to layout_geojson
    geojson = layout.layout_geojson or {"type": "FeatureCollection", "features": []}
    features = geojson.get("features", [])
    new_index = len(features)

    features.append(
        {
            "type": "Feature",
            "properties": {"index": new_index, "rotation_deg": orientation},
            "geometry": {"type": "Polygon", "coordinates": [corners]},
        }
    )

    layout.layout_geojson = {"type": "FeatureCollection", "features": features}
    layout.num_panels = len(features)

    # Recalculate strings
    panel_vmp = panel.specs.get("vmp_v") if isinstance(panel.specs, dict) else None
    inverter_specs = None
    if layout.inverter_model_id:
        inv_result = await db.execute(
            select(Equipment).where(Equipment.id == layout.inverter_model_id)
        )
        inv = inv_result.scalar_one_or_none()
        if inv:
            inverter_specs = inv.specs

    from app.services.calpinage import suggest_strings

    num_strings, panels_per_string = suggest_strings(
        layout.num_panels, panel_vmp, inverter_specs
    )
    layout.num_strings = num_strings
    layout.panels_per_string = panels_per_string

    await db.commit()
    await db.refresh(layout)
    return _layout_to_dict(layout)


@router.delete("/{layout_id}/panels/{panel_index}", response_model=PanelLayoutRead)
async def remove_panel(
    project_id: uuid.UUID,
    layout_id: uuid.UUID,
    panel_index: int,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_for_user(project_id, user, db)

    result = await db.execute(select(PanelLayout).where(PanelLayout.id == layout_id))
    layout = result.scalar_one_or_none()
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")

    # Verify layout belongs to this project
    zone_result = await db.execute(
        select(RoofZone).where(
            RoofZone.id == layout.roof_zone_id, RoofZone.project_id == project_id
        )
    )
    if not zone_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Layout not found")

    geojson = layout.layout_geojson or {"type": "FeatureCollection", "features": []}
    features = geojson.get("features", [])

    if panel_index < 0 or panel_index >= len(features):
        raise HTTPException(status_code=404, detail="Panel index out of range")

    features.pop(panel_index)

    # Re-index remaining features
    for i, f in enumerate(features):
        f["properties"]["index"] = i

    layout.layout_geojson = {"type": "FeatureCollection", "features": features}
    layout.num_panels = len(features)

    # Recalculate strings
    panel_result = await db.execute(
        select(Equipment).where(Equipment.id == layout.panel_model_id)
    )
    panel = panel_result.scalar_one_or_none()
    panel_vmp = None
    inverter_specs = None
    if panel and isinstance(panel.specs, dict):
        panel_vmp = panel.specs.get("vmp_v")
    if layout.inverter_model_id:
        inv_result = await db.execute(
            select(Equipment).where(Equipment.id == layout.inverter_model_id)
        )
        inv = inv_result.scalar_one_or_none()
        if inv:
            inverter_specs = inv.specs

    num_strings, panels_per_string = suggest_strings(
        layout.num_panels, panel_vmp, inverter_specs
    )
    layout.num_strings = num_strings
    layout.panels_per_string = panels_per_string

    await db.commit()
    await db.refresh(layout)
    return _layout_to_dict(layout)


@router.delete("/{layout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_layout(
    project_id: uuid.UUID,
    layout_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_for_user(project_id, user, db)

    result = await db.execute(select(PanelLayout).where(PanelLayout.id == layout_id))
    layout = result.scalar_one_or_none()
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")

    # Verify layout belongs to this project
    zone_result = await db.execute(
        select(RoofZone).where(
            RoofZone.id == layout.roof_zone_id, RoofZone.project_id == project_id
        )
    )
    if not zone_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Layout not found")

    await db.delete(layout)
    await db.commit()
