import pytest
from httpx import AsyncClient


PROJECT_DATA = {
    "name": "Solar Dakar",
    "address": "123 Rue de la Liberté, Dakar",
    "lat": 14.6928,
    "lon": -17.4467,
    "notes": "Test project",
}


@pytest.mark.asyncio
async def test_create_project(client: AsyncClient, auth_headers: dict):
    res = await client.post("/projects", json=PROJECT_DATA, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Solar Dakar"
    assert data["status"] == "draft"
    assert data["lat"] == 14.6928
    assert data["lon"] == -17.4467


@pytest.mark.asyncio
async def test_create_project_unauthenticated(client: AsyncClient):
    res = await client.post("/projects", json=PROJECT_DATA)
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_list_projects(client: AsyncClient, auth_headers: dict):
    await client.post("/projects", json=PROJECT_DATA, headers=auth_headers)
    await client.post(
        "/projects",
        json={**PROJECT_DATA, "name": "Solar Thiès"},
        headers=auth_headers,
    )
    res = await client.get("/projects", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_list_projects_ownership(
    client: AsyncClient, auth_headers: dict, installer_headers: dict
):
    """A user should only see their own projects."""
    await client.post("/projects", json=PROJECT_DATA, headers=auth_headers)
    await client.post(
        "/projects",
        json={**PROJECT_DATA, "name": "Installer Project"},
        headers=installer_headers,
    )

    # Particular user sees only their project
    res = await client.get("/projects", headers=auth_headers)
    assert len(res.json()) == 1
    assert res.json()[0]["name"] == "Solar Dakar"

    # Installer sees only their project
    res = await client.get("/projects", headers=installer_headers)
    assert len(res.json()) == 1
    assert res.json()[0]["name"] == "Installer Project"


@pytest.mark.asyncio
async def test_admin_sees_all_projects(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    """Admin should see all projects."""
    await client.post("/projects", json=PROJECT_DATA, headers=auth_headers)
    res = await client.get("/projects", headers=admin_headers)
    assert res.status_code == 200
    assert len(res.json()) >= 1


@pytest.mark.asyncio
async def test_list_projects_filter_status(client: AsyncClient, auth_headers: dict):
    await client.post("/projects", json=PROJECT_DATA, headers=auth_headers)
    res = await client.get("/projects?status=draft", headers=auth_headers)
    assert res.status_code == 200
    assert all(p["status"] == "draft" for p in res.json())


@pytest.mark.asyncio
async def test_list_projects_search(client: AsyncClient, auth_headers: dict):
    await client.post("/projects", json=PROJECT_DATA, headers=auth_headers)
    await client.post(
        "/projects",
        json={**PROJECT_DATA, "name": "Solar Saint-Louis"},
        headers=auth_headers,
    )
    res = await client.get("/projects?search=Saint", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["name"] == "Solar Saint-Louis"


@pytest.mark.asyncio
async def test_get_project(client: AsyncClient, auth_headers: dict):
    create_res = await client.post("/projects", json=PROJECT_DATA, headers=auth_headers)
    project_id = create_res.json()["id"]

    res = await client.get(f"/projects/{project_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Solar Dakar"


@pytest.mark.asyncio
async def test_get_project_not_owner(
    client: AsyncClient, auth_headers: dict, installer_headers: dict
):
    create_res = await client.post("/projects", json=PROJECT_DATA, headers=auth_headers)
    project_id = create_res.json()["id"]

    res = await client.get(f"/projects/{project_id}", headers=installer_headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_update_project(client: AsyncClient, auth_headers: dict):
    create_res = await client.post("/projects", json=PROJECT_DATA, headers=auth_headers)
    project_id = create_res.json()["id"]

    res = await client.put(
        f"/projects/{project_id}",
        json={"name": "Updated Name", "status": "study"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Updated Name"
    assert res.json()["status"] == "study"


@pytest.mark.asyncio
async def test_update_project_not_owner(
    client: AsyncClient, auth_headers: dict, installer_headers: dict
):
    create_res = await client.post("/projects", json=PROJECT_DATA, headers=auth_headers)
    project_id = create_res.json()["id"]

    res = await client.put(
        f"/projects/{project_id}",
        json={"name": "Hacked"},
        headers=installer_headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_delete_project(client: AsyncClient, auth_headers: dict):
    create_res = await client.post("/projects", json=PROJECT_DATA, headers=auth_headers)
    project_id = create_res.json()["id"]

    res = await client.delete(f"/projects/{project_id}", headers=auth_headers)
    assert res.status_code == 204

    # Verify it's gone
    res = await client.get(f"/projects/{project_id}", headers=auth_headers)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_delete_project_not_owner(
    client: AsyncClient, auth_headers: dict, installer_headers: dict
):
    create_res = await client.post("/projects", json=PROJECT_DATA, headers=auth_headers)
    project_id = create_res.json()["id"]

    res = await client.delete(f"/projects/{project_id}", headers=installer_headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_create_project_with_client(
    client: AsyncClient, installer_headers: dict
):
    """Installer can create a project linked to their client."""
    # Create a client first
    client_res = await client.post(
        "/clients",
        json={"name": "Client Test"},
        headers=installer_headers,
    )
    client_id = client_res.json()["id"]

    res = await client.post(
        "/projects",
        json={**PROJECT_DATA, "client_id": client_id},
        headers=installer_headers,
    )
    assert res.status_code == 201
    assert res.json()["client_id"] == client_id


@pytest.mark.asyncio
async def test_get_project_not_found(client: AsyncClient, auth_headers: dict):
    res = await client.get(
        "/projects/00000000-0000-0000-0000-000000000000",
        headers=auth_headers,
    )
    assert res.status_code == 404
