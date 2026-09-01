import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import RequireInstaller
from app.models.client import Client
from app.models.project import Project
from app.models.user import User
from app.schemas.client import ClientCreate, ClientRead, ClientUpdate

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("", response_model=list[ClientRead])
async def list_clients(
    user: Annotated[User, RequireInstaller],
    db: AsyncSession = Depends(get_db),
    search: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    query = select(Client)

    # Non-admin sees only their own clients
    if user.role != "admin":
        query = query.where(Client.installer_id == user.id)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            Client.name.ilike(pattern)
            | Client.email.ilike(pattern)
            | Client.phone.ilike(pattern)
        )

    query = query.order_by(Client.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    clients = result.scalars().all()

    # Add project count
    items = []
    for c in clients:
        data = ClientRead.model_validate(c).model_dump()
        count_q = select(func.count()).select_from(Project).where(
            Project.client_id == c.id
        )
        count_result = await db.execute(count_q)
        data["project_count"] = count_result.scalar() or 0
        items.append(data)

    return items


@router.post("", response_model=ClientRead, status_code=status.HTTP_201_CREATED)
async def create_client(
    body: ClientCreate,
    user: Annotated[User, RequireInstaller],
    db: AsyncSession = Depends(get_db),
):
    client = Client(
        installer_id=user.id,
        name=body.name,
        address=body.address,
        phone=body.phone,
        email=body.email,
        monthly_kwh=body.monthly_kwh,
        senelec_tariff_tier=body.senelec_tariff_tier,
        notes=body.notes,
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


@router.get("/{client_id}", response_model=ClientRead)
async def get_client(
    client_id: uuid.UUID,
    user: Annotated[User, RequireInstaller],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Client).where(Client.id == client_id)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if client.installer_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    return client


@router.put("/{client_id}", response_model=ClientRead)
async def update_client(
    client_id: uuid.UUID,
    body: ClientUpdate,
    user: Annotated[User, RequireInstaller],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Client).where(Client.id == client_id)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if client.installer_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(client, key, value)

    await db.commit()
    await db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: uuid.UUID,
    user: Annotated[User, RequireInstaller],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Client).where(Client.id == client_id)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if client.installer_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    await db.delete(client)
    await db.commit()
