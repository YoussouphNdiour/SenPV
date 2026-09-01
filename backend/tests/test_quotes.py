import pytest
from httpx import AsyncClient


PROJECT_DATA = {
    "name": "Solar Dakar",
    "address": "123 Rue de la Liberté, Dakar",
    "lat": 14.6928,
    "lon": -17.4467,
}

QUOTE_DATA = {
    "line_items": [
        {"description": "Panneau JA Solar 545W", "quantity": 10, "unit_price_fcfa": 185000},
        {"description": "Onduleur Huawei 5kW", "quantity": 1, "unit_price_fcfa": 650000},
        {"description": "Structure montage", "quantity": 1, "unit_price_fcfa": 350000},
        {"description": "Câblage DC/AC", "quantity": 1, "unit_price_fcfa": 250000},
        {"description": "Main d'œuvre", "quantity": 1, "unit_price_fcfa": 400000},
    ],
    "margin_pct": 15.0,
    "tax_rate_pct": 18.0,
    "payment_terms": "50% à la commande, 50% à la mise en service",
    "validity_days": 30,
}


async def _create_project(client: AsyncClient, headers: dict) -> str:
    res = await client.post("/projects", json=PROJECT_DATA, headers=headers)
    return res.json()["id"]


# --- CRUD Tests ---

@pytest.mark.asyncio
async def test_create_quote(client: AsyncClient, installer_headers: dict):
    project_id = await _create_project(client, installer_headers)
    res = await client.post(
        f"/projects/{project_id}/quotes",
        json=QUOTE_DATA,
        headers=installer_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "draft"
    assert data["reference"].startswith("DEV-")
    assert data["validity_days"] == 30
    assert data["payment_terms"] == QUOTE_DATA["payment_terms"]
    assert len(data["line_items"]) == 5


@pytest.mark.asyncio
async def test_create_quote_calculations(client: AsyncClient, installer_headers: dict):
    """Verify subtotal, margin, tax, and total calculations."""
    project_id = await _create_project(client, installer_headers)
    res = await client.post(
        f"/projects/{project_id}/quotes",
        json=QUOTE_DATA,
        headers=installer_headers,
    )
    data = res.json()

    # subtotal = 10*185000 + 650000 + 350000 + 250000 + 400000 = 3_500_000
    assert data["subtotal_fcfa"] == 3_500_000

    # margin = floor(3_500_000 * 15 / 100) = 525_000
    # total_ht = 3_500_000 + 525_000 = 4_025_000
    # tax = floor(4_025_000 * 18 / 100) = 724_500
    # total = 4_025_000 + 724_500 = 4_749_500
    assert data["tax_amount_fcfa"] == 724_500
    assert data["total_fcfa"] == 4_749_500


@pytest.mark.asyncio
async def test_create_quote_reference_auto_increment(
    client: AsyncClient, installer_headers: dict
):
    project_id = await _create_project(client, installer_headers)

    res1 = await client.post(
        f"/projects/{project_id}/quotes",
        json=QUOTE_DATA,
        headers=installer_headers,
    )
    ref1 = res1.json()["reference"]

    res2 = await client.post(
        f"/projects/{project_id}/quotes",
        json=QUOTE_DATA,
        headers=installer_headers,
    )
    ref2 = res2.json()["reference"]

    # Both should have the same year prefix but different numbers
    assert ref1.endswith("0001")
    assert ref2.endswith("0002")


@pytest.mark.asyncio
async def test_list_quotes(client: AsyncClient, installer_headers: dict):
    project_id = await _create_project(client, installer_headers)
    await client.post(
        f"/projects/{project_id}/quotes",
        json=QUOTE_DATA,
        headers=installer_headers,
    )
    await client.post(
        f"/projects/{project_id}/quotes",
        json=QUOTE_DATA,
        headers=installer_headers,
    )

    res = await client.get(
        f"/projects/{project_id}/quotes",
        headers=installer_headers,
    )
    assert res.status_code == 200
    assert len(res.json()) == 2


@pytest.mark.asyncio
async def test_get_quote(client: AsyncClient, installer_headers: dict):
    project_id = await _create_project(client, installer_headers)
    create_res = await client.post(
        f"/projects/{project_id}/quotes",
        json=QUOTE_DATA,
        headers=installer_headers,
    )
    quote_id = create_res.json()["id"]

    res = await client.get(
        f"/projects/{project_id}/quotes/{quote_id}",
        headers=installer_headers,
    )
    assert res.status_code == 200
    assert res.json()["id"] == quote_id


@pytest.mark.asyncio
async def test_update_quote(client: AsyncClient, installer_headers: dict):
    project_id = await _create_project(client, installer_headers)
    create_res = await client.post(
        f"/projects/{project_id}/quotes",
        json=QUOTE_DATA,
        headers=installer_headers,
    )
    quote_id = create_res.json()["id"]

    updated_items = [
        {"description": "Panneau 545W", "quantity": 12, "unit_price_fcfa": 185000},
    ]
    res = await client.put(
        f"/projects/{project_id}/quotes/{quote_id}",
        json={"line_items": updated_items, "margin_pct": 10},
        headers=installer_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["line_items"]) == 1
    assert data["subtotal_fcfa"] == 12 * 185000  # 2_220_000


@pytest.mark.asyncio
async def test_update_quote_status(client: AsyncClient, installer_headers: dict):
    project_id = await _create_project(client, installer_headers)
    create_res = await client.post(
        f"/projects/{project_id}/quotes",
        json=QUOTE_DATA,
        headers=installer_headers,
    )
    quote_id = create_res.json()["id"]
    assert create_res.json()["status"] == "draft"

    # Change to sent
    res = await client.put(
        f"/projects/{project_id}/quotes/{quote_id}/status",
        json={"status": "sent"},
        headers=installer_headers,
    )
    assert res.status_code == 200
    assert res.json()["status"] == "sent"

    # Change to accepted
    res = await client.put(
        f"/projects/{project_id}/quotes/{quote_id}/status",
        json={"status": "accepted"},
        headers=installer_headers,
    )
    assert res.status_code == 200
    assert res.json()["status"] == "accepted"


@pytest.mark.asyncio
async def test_update_quote_invalid_status(client: AsyncClient, installer_headers: dict):
    project_id = await _create_project(client, installer_headers)
    create_res = await client.post(
        f"/projects/{project_id}/quotes",
        json=QUOTE_DATA,
        headers=installer_headers,
    )
    quote_id = create_res.json()["id"]

    res = await client.put(
        f"/projects/{project_id}/quotes/{quote_id}/status",
        json={"status": "invalid"},
        headers=installer_headers,
    )
    assert res.status_code == 422


# --- Permission Tests ---

@pytest.mark.asyncio
async def test_create_quote_requires_installer(client: AsyncClient, auth_headers: dict):
    """Particular users cannot create quotes."""
    project_id = await _create_project(client, auth_headers)
    res = await client.post(
        f"/projects/{project_id}/quotes",
        json=QUOTE_DATA,
        headers=auth_headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_particular_cannot_update_quote(
    client: AsyncClient, auth_headers: dict, installer_headers: dict
):
    """Particular users cannot update quotes."""
    project_id = await _create_project(client, installer_headers)
    create_res = await client.post(
        f"/projects/{project_id}/quotes",
        json=QUOTE_DATA,
        headers=installer_headers,
    )
    quote_id = create_res.json()["id"]

    # Particular user tries to update — should fail (403 or at least not succeed)
    res = await client.put(
        f"/projects/{project_id}/quotes/{quote_id}",
        json={"margin_pct": 20},
        headers=auth_headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_quote_not_found(client: AsyncClient, installer_headers: dict):
    project_id = await _create_project(client, installer_headers)
    res = await client.get(
        f"/projects/{project_id}/quotes/00000000-0000-0000-0000-000000000000",
        headers=installer_headers,
    )
    assert res.status_code == 404
