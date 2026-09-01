"""Tests for equipment role-based access control."""

import pytest
from httpx import AsyncClient

from tests.test_equipment_crud import PANEL_DATA


@pytest.mark.asyncio
async def test_particular_cannot_create(client: AsyncClient, auth_headers: dict):
    """A particular user cannot create equipment."""
    res = await client.post("/equipment", json=PANEL_DATA, headers=auth_headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_unauthenticated_cannot_create(client: AsyncClient):
    """An unauthenticated user cannot create equipment."""
    res = await client.post("/equipment", json=PANEL_DATA)
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_installer_cannot_create_global(client: AsyncClient, installer_headers: dict):
    """An installer cannot create global equipment — is_global is ignored."""
    data = {**PANEL_DATA, "is_global": True}
    res = await client.post("/equipment", json=data, headers=installer_headers)
    assert res.status_code == 201
    assert res.json()["is_global"] is False


@pytest.mark.asyncio
async def test_installer_cannot_modify_global(client: AsyncClient, installer_headers: dict, admin_headers: dict):
    """An installer cannot modify a global equipment item."""
    # Admin creates global equipment
    create_res = await client.post(
        "/equipment",
        json={**PANEL_DATA, "is_global": True},
        headers=admin_headers,
    )
    eq_id = create_res.json()["id"]

    # Installer tries to modify it
    res = await client.put(
        f"/equipment/{eq_id}",
        json={"manufacturer": "Hacked"},
        headers=installer_headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_installer_cannot_delete_global(client: AsyncClient, installer_headers: dict, admin_headers: dict):
    """An installer cannot delete a global equipment item."""
    create_res = await client.post(
        "/equipment",
        json={**PANEL_DATA, "is_global": True},
        headers=admin_headers,
    )
    eq_id = create_res.json()["id"]

    res = await client.delete(f"/equipment/{eq_id}", headers=installer_headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_installer_can_only_modify_own(client: AsyncClient, installer_headers: dict):
    """An installer can modify their own equipment."""
    create_res = await client.post("/equipment", json=PANEL_DATA, headers=installer_headers)
    eq_id = create_res.json()["id"]

    res = await client.put(
        f"/equipment/{eq_id}",
        json={"manufacturer": "My Updated Brand"},
        headers=installer_headers,
    )
    assert res.status_code == 200
    assert res.json()["manufacturer"] == "My Updated Brand"


@pytest.mark.asyncio
async def test_admin_can_modify_any(client: AsyncClient, installer_headers: dict, admin_headers: dict):
    """An admin can modify any equipment."""
    create_res = await client.post("/equipment", json=PANEL_DATA, headers=installer_headers)
    eq_id = create_res.json()["id"]

    res = await client.put(
        f"/equipment/{eq_id}",
        json={"manufacturer": "Admin Override"},
        headers=admin_headers,
    )
    assert res.status_code == 200
    assert res.json()["manufacturer"] == "Admin Override"


@pytest.mark.asyncio
async def test_admin_can_create_global(client: AsyncClient, admin_headers: dict):
    """An admin can create global equipment."""
    data = {**PANEL_DATA, "is_global": True}
    res = await client.post("/equipment", json=data, headers=admin_headers)
    assert res.status_code == 201
    assert res.json()["is_global"] is True
    assert res.json()["owner_id"] is None


@pytest.mark.asyncio
async def test_particular_sees_only_global(client: AsyncClient, auth_headers: dict, installer_headers: dict, admin_headers: dict):
    """A particular user sees only global equipment, not installer's personal items."""
    # Admin creates global
    await client.post(
        "/equipment",
        json={**PANEL_DATA, "is_global": True, "model": "Global-Panel"},
        headers=admin_headers,
    )

    # Installer creates personal
    await client.post(
        "/equipment",
        json={**PANEL_DATA, "model": "Personal-Panel"},
        headers=installer_headers,
    )

    # Particular user lists — should only see global
    res = await client.get("/equipment", headers=auth_headers)
    assert res.status_code == 200
    models = [item["model"] for item in res.json()["items"]]
    assert "Global-Panel" in models
    assert "Personal-Panel" not in models
