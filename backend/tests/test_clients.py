import pytest
from httpx import AsyncClient


CLIENT_DATA = {
    "name": "Moussa Diop",
    "address": "45 Avenue Bourguiba, Dakar",
    "phone": "+221770001234",
    "email": "moussa@example.com",
    "monthly_kwh": 350,
    "senelec_tariff_tier": "DMP",
}


@pytest.mark.asyncio
async def test_create_client(client: AsyncClient, installer_headers: dict):
    res = await client.post("/clients", json=CLIENT_DATA, headers=installer_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Moussa Diop"
    assert data["phone"] == "+221770001234"


@pytest.mark.asyncio
async def test_create_client_particular_forbidden(
    client: AsyncClient, auth_headers: dict
):
    """Particular users cannot create clients."""
    res = await client.post("/clients", json=CLIENT_DATA, headers=auth_headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_create_client_unauthenticated(client: AsyncClient):
    res = await client.post("/clients", json=CLIENT_DATA)
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_list_clients(client: AsyncClient, installer_headers: dict):
    await client.post("/clients", json=CLIENT_DATA, headers=installer_headers)
    await client.post(
        "/clients",
        json={**CLIENT_DATA, "name": "Fatou Sall", "email": "fatou@example.com"},
        headers=installer_headers,
    )
    res = await client.get("/clients", headers=installer_headers)
    assert res.status_code == 200
    assert len(res.json()) == 2


@pytest.mark.asyncio
async def test_list_clients_particular_forbidden(
    client: AsyncClient, auth_headers: dict
):
    res = await client.get("/clients", headers=auth_headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_list_clients_search(client: AsyncClient, installer_headers: dict):
    await client.post("/clients", json=CLIENT_DATA, headers=installer_headers)
    await client.post(
        "/clients",
        json={**CLIENT_DATA, "name": "Fatou Sall", "email": "fatou@example.com"},
        headers=installer_headers,
    )
    res = await client.get("/clients?search=Fatou", headers=installer_headers)
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["name"] == "Fatou Sall"


@pytest.mark.asyncio
async def test_get_client(client: AsyncClient, installer_headers: dict):
    create_res = await client.post(
        "/clients", json=CLIENT_DATA, headers=installer_headers
    )
    client_id = create_res.json()["id"]

    res = await client.get(f"/clients/{client_id}", headers=installer_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Moussa Diop"


@pytest.mark.asyncio
async def test_update_client(client: AsyncClient, installer_headers: dict):
    create_res = await client.post(
        "/clients", json=CLIENT_DATA, headers=installer_headers
    )
    client_id = create_res.json()["id"]

    res = await client.put(
        f"/clients/{client_id}",
        json={"name": "Moussa Diop Updated", "monthly_kwh": 500},
        headers=installer_headers,
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Moussa Diop Updated"
    assert float(res.json()["monthly_kwh"]) == 500


@pytest.mark.asyncio
async def test_delete_client(client: AsyncClient, installer_headers: dict):
    create_res = await client.post(
        "/clients", json=CLIENT_DATA, headers=installer_headers
    )
    client_id = create_res.json()["id"]

    res = await client.delete(f"/clients/{client_id}", headers=installer_headers)
    assert res.status_code == 204

    # Verify it's gone
    res = await client.get(f"/clients/{client_id}", headers=installer_headers)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_client_ownership(client: AsyncClient, installer_headers: dict):
    """Create a second installer and verify they can't see the first's clients."""
    # Create client with first installer
    await client.post("/clients", json=CLIENT_DATA, headers=installer_headers)

    # Register second installer
    await client.post(
        "/auth/register",
        json={
            "email": "installer2@example.com",
            "name": "Installer Two",
            "password": "testpass123",
            "role": "installer",
            "company_name": "Solar Two SARL",
            "phone": "+221770005678",
        },
    )
    login_res = await client.post(
        "/auth/login",
        json={"email": "installer2@example.com", "password": "testpass123"},
    )
    installer2_headers = {
        "Authorization": f"Bearer {login_res.json()['access_token']}"
    }

    # Second installer sees no clients
    res = await client.get("/clients", headers=installer2_headers)
    assert res.status_code == 200
    assert len(res.json()) == 0


@pytest.mark.asyncio
async def test_client_with_project_count(client: AsyncClient, installer_headers: dict):
    """Client list should include project_count."""
    create_res = await client.post(
        "/clients", json=CLIENT_DATA, headers=installer_headers
    )
    client_id = create_res.json()["id"]

    # Create a project linked to this client
    await client.post(
        "/projects",
        json={
            "name": "Client Project",
            "lat": 14.6928,
            "lon": -17.4467,
            "client_id": client_id,
        },
        headers=installer_headers,
    )

    res = await client.get("/clients", headers=installer_headers)
    assert res.status_code == 200
    found = [c for c in res.json() if c["id"] == client_id]
    assert len(found) == 1
    assert found[0]["project_count"] == 1


@pytest.mark.asyncio
async def test_admin_sees_all_clients(
    client: AsyncClient, installer_headers: dict, admin_headers: dict
):
    await client.post("/clients", json=CLIENT_DATA, headers=installer_headers)
    res = await client.get("/clients", headers=admin_headers)
    assert res.status_code == 200
    assert len(res.json()) >= 1
