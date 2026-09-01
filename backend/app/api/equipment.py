import math
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser, get_current_user, require_role
from app.models.equipment import Equipment
from app.models.user import User
from app.schemas.equipment import (
    EquipmentCreate,
    EquipmentRead,
    EquipmentUpdate,
    InverterSpecs,
    PaginatedEquipmentResponse,
    PanelSpecs,
)

router = APIRouter(prefix="/equipment", tags=["equipment"])

# Optional auth scheme — does not raise 401 when token is missing
oauth2_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


async def get_optional_user(
    token: Annotated[str | None, Depends(oauth2_optional)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User | None:
    """Return current user if authenticated, None otherwise."""
    if token is None:
        return None
    try:
        return await get_current_user(token, db)
    except HTTPException:
        return None


@router.get("", response_model=PaginatedEquipmentResponse)
async def list_equipment(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User | None, Depends(get_optional_user)],
    type: str | None = Query(default=None, pattern=r"^(panel|inverter)$"),
    manufacturer: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
):
    # Base query: global equipment always visible
    conditions = [Equipment.is_global.is_(True)]

    # Installers/admins also see their own equipment
    if user and user.role in ("installer", "admin"):
        conditions = [or_(Equipment.is_global.is_(True), Equipment.owner_id == user.id)]

    query = select(Equipment).where(or_(*conditions))

    # Filters
    if type:
        query = query.where(Equipment.type == type)
    if manufacturer:
        query = query.where(Equipment.manufacturer.ilike(f"%{manufacturer}%"))
    if search:
        query = query.where(
            or_(
                Equipment.manufacturer.ilike(f"%{search}%"),
                Equipment.model.ilike(f"%{search}%"),
            )
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Pagination
    pages = math.ceil(total / per_page) if total > 0 else 1
    offset = (page - 1) * per_page
    query = query.order_by(Equipment.manufacturer, Equipment.model).offset(offset).limit(per_page)

    result = await db.execute(query)
    items = result.scalars().all()

    return PaginatedEquipmentResponse(
        items=[EquipmentRead.model_validate(item) for item in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


@router.post("", response_model=EquipmentRead, status_code=status.HTTP_201_CREATED)
async def create_equipment(
    data: EquipmentCreate,
    user: Annotated[User, require_role(["installer", "admin"])],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Only admin can create global equipment
    is_global = data.is_global and user.role == "admin"

    equipment = Equipment(
        type=data.type,
        manufacturer=data.manufacturer,
        model=data.model,
        specs=data.specs,
        is_global=is_global,
        owner_id=None if is_global else user.id,
    )
    db.add(equipment)
    await db.commit()
    await db.refresh(equipment)
    return EquipmentRead.model_validate(equipment)


@router.put("/{equipment_id}", response_model=EquipmentRead)
async def update_equipment(
    equipment_id: uuid.UUID,
    data: EquipmentUpdate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Equipment).where(Equipment.id == equipment_id))
    equipment = result.scalar_one_or_none()
    if not equipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipment not found")

    # Permission check
    if equipment.is_global and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can modify global equipment",
        )
    if not equipment.is_global and equipment.owner_id != user.id and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only modify your own equipment",
        )

    # Apply updates
    update_data = data.model_dump(exclude_unset=True)

    # If specs are being updated, validate them against the type
    new_type = update_data.get("type", equipment.type)
    if "specs" in update_data:
        if new_type == "panel":
            PanelSpecs(**update_data["specs"])
        elif new_type == "inverter":
            InverterSpecs(**update_data["specs"])

    # Prevent installers from setting is_global
    if "is_global" in update_data and user.role != "admin":
        update_data.pop("is_global")

    for key, value in update_data.items():
        setattr(equipment, key, value)

    await db.commit()
    await db.refresh(equipment)
    return EquipmentRead.model_validate(equipment)


@router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_equipment(
    equipment_id: uuid.UUID,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Equipment).where(Equipment.id == equipment_id))
    equipment = result.scalar_one_or_none()
    if not equipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipment not found")

    # Permission check
    if equipment.is_global and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete global equipment",
        )
    if not equipment.is_global and equipment.owner_id != user.id and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own equipment",
        )

    # TODO: Check panel_layout references when that table exists
    # For now, just delete
    await db.delete(equipment)
    await db.commit()
