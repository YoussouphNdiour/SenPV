import uuid
from typing import Any

import networkx as nx
from fastapi import APIRouter, Depends, HTTPException, status
from networkx.readwrite import json_graph
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.equipment import Equipment
from app.models.panel_layout import PanelLayout
from app.models.project import Project
from app.models.roof_zone import RoofZone
from app.models.schematic import Schematic
from app.schemas.schematic import (
    SchematicGenerateResponse,
    SchematicRead,
    SchematicUpdate,
    SchematicValidateResponse,
)
from app.services.schematic_graph import (
    generate_schematic,
    graph_to_reactflow,
    reactflow_to_graph,
    validate_electrical,
)

router = APIRouter(prefix="/projects/{project_id}/schematic", tags=["schematics"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


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


async def _get_first_panel_layout(
    project_id: uuid.UUID, db: AsyncSession
) -> PanelLayout:
    """Find the first panel layout for the given project."""
    zone_result = await db.execute(
        select(RoofZone.id).where(RoofZone.project_id == project_id)
    )
    zone_ids = [row[0] for row in zone_result.all()]

    if not zone_ids:
        raise HTTPException(
            status_code=404,
            detail="No roof zones found for this project",
        )

    layout_result = await db.execute(
        select(PanelLayout).where(PanelLayout.roof_zone_id.in_(zone_ids)).limit(1)
    )
    layout = layout_result.scalar_one_or_none()
    if not layout:
        raise HTTPException(
            status_code=404,
            detail="No panel layout found for this project",
        )
    return layout


async def _load_equipment_specs(
    layout: PanelLayout, db: AsyncSession
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Load panel and inverter specs from Equipment table."""
    panel_result = await db.execute(
        select(Equipment).where(
            Equipment.id == layout.panel_model_id, Equipment.type == "panel"
        )
    )
    panel = panel_result.scalar_one_or_none()
    if not panel:
        raise HTTPException(status_code=404, detail="Panel model not found")

    if not layout.inverter_model_id:
        raise HTTPException(
            status_code=400, detail="Panel layout has no inverter model assigned"
        )

    inv_result = await db.execute(
        select(Equipment).where(
            Equipment.id == layout.inverter_model_id, Equipment.type == "inverter"
        )
    )
    inverter = inv_result.scalar_one_or_none()
    if not inverter:
        raise HTTPException(status_code=404, detail="Inverter model not found")

    return panel.specs, inverter.specs


def _build_panel_layout_dict(layout: PanelLayout) -> dict[str, int]:
    return {
        "num_panels": layout.num_panels,
        "num_strings": layout.num_strings,
        "panels_per_string": layout.panels_per_string,
    }


def _schematic_to_read(schematic: Schematic) -> dict[str, Any]:
    """Convert a Schematic model instance to a dict matching SchematicRead."""
    schema_data = schematic.schema_data or {"nodes": [], "edges": []}
    return {
        "id": schematic.id,
        "project_id": schematic.project_id,
        "nodes": schema_data.get("nodes", []),
        "edges": schema_data.get("edges", []),
        "validation_errors": schematic.validation_errors or [],
        "created_at": schematic.created_at,
        "updated_at": schematic.updated_at,
    }


def _generate_svg(schema_data: dict[str, Any]) -> str:
    """Generate a basic SVG representation from nodes and edges."""
    nodes = schema_data.get("nodes", [])
    edges = schema_data.get("edges", [])

    if not nodes:
        return '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>'

    # Calculate bounding box
    min_x = min(n["position"]["x"] for n in nodes)
    min_y = min(n["position"]["y"] for n in nodes)
    max_x = max(n["position"]["x"] for n in nodes)
    max_y = max(n["position"]["y"] for n in nodes)

    node_w, node_h = 120, 40
    padding = 40

    svg_w = max_x - min_x + node_w + padding * 2
    svg_h = max_y - min_y + node_h + padding * 2

    # Offset so minimum is at padding
    off_x = -min_x + padding
    off_y = -min_y + padding

    # Build node position lookup
    node_positions: dict[str, tuple[float, float]] = {}
    for n in nodes:
        cx = n["position"]["x"] + off_x + node_w / 2
        cy = n["position"]["y"] + off_y + node_h / 2
        node_positions[n["id"]] = (cx, cy)

    parts: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'width="{svg_w:.0f}" height="{svg_h:.0f}" '
        f'viewBox="0 0 {svg_w:.0f} {svg_h:.0f}">',
        '<style>',
        '  rect { fill: #f0f0f0; stroke: #333; stroke-width: 1; }',
        '  text { font-family: sans-serif; font-size: 10px; text-anchor: middle; '
        'dominant-baseline: central; fill: #333; }',
        '  line { stroke: #666; stroke-width: 1; }',
        '</style>',
    ]

    # Draw edges as lines
    for edge in edges:
        src = node_positions.get(edge["source"])
        tgt = node_positions.get(edge["target"])
        if src and tgt:
            cable_type = (edge.get("data") or {}).get("cable_type", "dc")
            color = "#c00" if cable_type == "ac" else (
                "#0a0" if cable_type == "ground" else "#666"
            )
            parts.append(
                f'  <line x1="{src[0]:.1f}" y1="{src[1]:.1f}" '
                f'x2="{tgt[0]:.1f}" y2="{tgt[1]:.1f}" stroke="{color}" />'
            )

    # Draw nodes as rectangles with labels
    for n in nodes:
        x = n["position"]["x"] + off_x
        y = n["position"]["y"] + off_y
        label = (n.get("data") or {}).get("label", n["id"])
        # Truncate long labels
        if len(label) > 16:
            label = label[:14] + ".."
        parts.append(
            f'  <rect x="{x:.1f}" y="{y:.1f}" width="{node_w}" height="{node_h}" rx="4" />'
        )
        parts.append(
            f'  <text x="{x + node_w / 2:.1f}" y="{y + node_h / 2:.1f}">{label}</text>'
        )

    parts.append("</svg>")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/generate", response_model=SchematicGenerateResponse)
async def generate(
    project_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Generate a schematic from the project's panel layout."""
    await _get_project_for_user(project_id, user, db)

    layout = await _get_first_panel_layout(project_id, db)
    panel_specs, inverter_specs = await _load_equipment_specs(layout, db)
    panel_layout_dict = _build_panel_layout_dict(layout)

    # Generate graph, validate, convert to React Flow format
    G = generate_schematic(panel_layout_dict, panel_specs, inverter_specs)
    errors = validate_electrical(G, panel_specs, inverter_specs, panel_layout_dict)
    rf_data = graph_to_reactflow(G)

    # Upsert schematic (project_id is unique)
    result = await db.execute(
        select(Schematic).where(Schematic.project_id == project_id)
    )
    schematic = result.scalar_one_or_none()

    if schematic:
        schematic.schema_data = rf_data
        schematic.networkx_graph = json_graph.node_link_data(G)
        schematic.validation_errors = errors
    else:
        schematic = Schematic(
            project_id=project_id,
            schema_data=rf_data,
            networkx_graph=json_graph.node_link_data(G),
            validation_errors=errors,
        )
        db.add(schematic)

    await db.commit()
    await db.refresh(schematic)

    return {
        "nodes": rf_data["nodes"],
        "edges": rf_data["edges"],
        "validation_errors": errors,
    }


@router.get("", response_model=SchematicRead)
async def get_schematic(
    project_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve the schematic for a project."""
    await _get_project_for_user(project_id, user, db)

    result = await db.execute(
        select(Schematic).where(Schematic.project_id == project_id)
    )
    schematic = result.scalar_one_or_none()
    if not schematic:
        raise HTTPException(status_code=404, detail="Schematic not found")

    return _schematic_to_read(schematic)


@router.put("", response_model=SchematicValidateResponse)
async def update_schematic(
    project_id: uuid.UUID,
    body: SchematicUpdate,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Update schematic nodes/edges, re-validate, and save."""
    await _get_project_for_user(project_id, user, db)

    result = await db.execute(
        select(Schematic).where(Schematic.project_id == project_id)
    )
    schematic = result.scalar_one_or_none()
    if not schematic:
        raise HTTPException(status_code=404, detail="Schematic not found")

    # Convert to networkx for validation
    nodes_dicts = [n.model_dump() for n in body.nodes]
    edges_dicts = [e.model_dump() for e in body.edges]
    G = reactflow_to_graph(nodes_dicts, edges_dicts)

    # Load panel layout + specs for validation
    layout = await _get_first_panel_layout(project_id, db)
    panel_specs, inverter_specs = await _load_equipment_specs(layout, db)
    panel_layout_dict = _build_panel_layout_dict(layout)

    errors = validate_electrical(G, panel_specs, inverter_specs, panel_layout_dict)

    # Update schematic in DB
    schematic.schema_data = {"nodes": nodes_dicts, "edges": edges_dicts}
    schematic.networkx_graph = json_graph.node_link_data(G)
    schematic.validation_errors = errors

    await db.commit()
    await db.refresh(schematic)

    return {"validation_errors": errors}


@router.post("/validate", response_model=SchematicValidateResponse)
async def validate_schematic(
    project_id: uuid.UUID,
    body: SchematicUpdate,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Validate schematic without saving."""
    await _get_project_for_user(project_id, user, db)

    nodes_dicts = [n.model_dump() for n in body.nodes]
    edges_dicts = [e.model_dump() for e in body.edges]
    G = reactflow_to_graph(nodes_dicts, edges_dicts)

    layout = await _get_first_panel_layout(project_id, db)
    panel_specs, inverter_specs = await _load_equipment_specs(layout, db)
    panel_layout_dict = _build_panel_layout_dict(layout)

    errors = validate_electrical(G, panel_specs, inverter_specs, panel_layout_dict)

    return {"validation_errors": errors}


@router.post("/export-svg")
async def export_svg(
    project_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Generate an SVG snapshot of the schematic and save it."""
    await _get_project_for_user(project_id, user, db)

    result = await db.execute(
        select(Schematic).where(Schematic.project_id == project_id)
    )
    schematic = result.scalar_one_or_none()
    if not schematic:
        raise HTTPException(status_code=404, detail="Schematic not found")

    svg_string = _generate_svg(schematic.schema_data or {"nodes": [], "edges": []})
    schematic.svg_snapshot = svg_string

    await db.commit()
    await db.refresh(schematic)

    return {"svg": svg_string}
