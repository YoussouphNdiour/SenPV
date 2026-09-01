import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete as sa_delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.client import Client
from app.models.panel_layout import PanelLayout
from app.models.project import Project
from app.models.roof_zone import RoofZone
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    sort_by: str = Query("created_at"),
    order: str = Query("desc"),
):
    query = select(Project).options(selectinload(Project.client))

    # Ownership filter: non-admin sees only their own
    if user.role != "admin":
        query = query.where(Project.user_id == user.id)

    if status_filter:
        query = query.where(Project.status == status_filter)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            Project.name.ilike(pattern) | Project.address.ilike(pattern)
        )

    # Sorting
    sort_col = getattr(Project, sort_by, Project.created_at)
    query = query.order_by(sort_col.desc() if order == "desc" else sort_col.asc())

    # Pagination
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    projects = result.scalars().all()

    # Build response with panel count and power
    items = []
    for p in projects:
        data = ProjectRead.model_validate(p).model_dump()
        # Compute panel count and total kWc from roof_zones -> panel_layouts
        layout_q = (
            select(
                func.coalesce(func.sum(PanelLayout.num_panels), 0).label("panel_count"),
            )
            .join(RoofZone, PanelLayout.roof_zone_id == RoofZone.id)
            .where(RoofZone.project_id == p.id)
        )
        layout_result = await db.execute(layout_q)
        row = layout_result.one()
        data["panel_count"] = int(row.panel_count)
        if p.client:
            data["client_name"] = p.client.name
        items.append(data)

    return items


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    # If client_id is provided, verify ownership
    if body.client_id:
        result = await db.execute(
            select(Client).where(Client.id == body.client_id)
        )
        client = result.scalar_one_or_none()
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        if client.installer_id != user.id and user.role != "admin":
            raise HTTPException(status_code=403, detail="Client does not belong to you")

    project = Project(
        user_id=user.id,
        name=body.name,
        address=body.address,
        lat=body.lat,
        lon=body.lon,
        client_id=body.client_id,
        notes=body.notes,
        status="draft",
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project)
        .options(
            selectinload(Project.client),
            selectinload(Project.simulations),
            selectinload(Project.quotes),
        )
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    return project


@router.put("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdate,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    # If updating client_id, verify ownership
    if body.client_id is not None:
        client_result = await db.execute(
            select(Client).where(Client.id == body.client_id)
        )
        client = client_result.scalar_one_or_none()
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        if client.installer_id != user.id and user.role != "admin":
            raise HTTPException(status_code=403, detail="Client does not belong to you")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)

    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    # Use SQL-level delete to let DB handle cascades via ON DELETE CASCADE
    await db.execute(sa_delete(Project).where(Project.id == project_id))
    await db.commit()
