"""Seed global equipment catalog from default_equipment.json."""

import json
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.equipment import Equipment


async def seed_equipment(db: AsyncSession) -> None:
    """Load default equipment if no global equipment exists."""
    result = await db.execute(
        select(func.count()).where(Equipment.is_global.is_(True))
    )
    count = result.scalar() or 0
    if count > 0:
        print(f"Global equipment already seeded ({count} items), skipping.")
        return

    data_path = Path(__file__).parent.parent / "data" / "default_equipment.json"
    if not data_path.exists():
        print(f"Seed file not found: {data_path}")
        return

    with open(data_path) as f:
        data = json.load(f)

    created = 0
    for panel in data.get("panels", []):
        equipment = Equipment(
            type="panel",
            manufacturer=panel["manufacturer"],
            model=panel["model"],
            specs=panel["specs"],
            is_global=True,
            owner_id=None,
        )
        db.add(equipment)
        created += 1

    for inverter in data.get("inverters", []):
        equipment = Equipment(
            type="inverter",
            manufacturer=inverter["manufacturer"],
            model=inverter["model"],
            specs=inverter["specs"],
            is_global=True,
            owner_id=None,
        )
        db.add(equipment)
        created += 1

    await db.commit()
    print(f"Seeded {created} global equipment items.")
