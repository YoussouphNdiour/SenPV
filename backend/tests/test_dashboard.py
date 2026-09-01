import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_stats_particular(client: AsyncClient, auth_headers: dict):
    """Particular user gets nb_projects, total_kwc, total_savings."""
    res = await client.get("/dashboard/stats", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "nb_projects" in data
    assert "total_kwc" in data
    assert "total_savings" in data
    assert data["nb_projects"] == 0
    assert data["total_kwc"] == 0


@pytest.mark.asyncio
async def test_stats_installer(client: AsyncClient, installer_headers: dict):
    """Installer user gets nb_clients, nb_projects, total_kwc, ca_devis_accepted, active_projects."""
    res = await client.get("/dashboard/stats", headers=installer_headers)
    assert res.status_code == 200
    data = res.json()
    assert "nb_clients" in data
    assert "nb_projects" in data
    assert "total_kwc" in data
    assert "ca_devis_accepted" in data
    assert "active_projects" in data
    assert data["nb_clients"] == 0
    assert data["nb_projects"] == 0


@pytest.mark.asyncio
async def test_stats_admin(client: AsyncClient, admin_headers: dict):
    """Admin user gets total_users, total_projects, total_kwc, nb_installers."""
    res = await client.get("/dashboard/stats", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_users" in data
    assert "total_projects" in data
    assert "total_kwc" in data
    assert "nb_installers" in data
    # At least 1 user (admin itself)
    assert data["total_users"] >= 1


@pytest.mark.asyncio
async def test_stats_unauthenticated(client: AsyncClient):
    """Unauthenticated user gets 401."""
    res = await client.get("/dashboard/stats")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_recent_projects_empty(client: AsyncClient, auth_headers: dict):
    """Recent projects returns empty list when no projects exist."""
    res = await client.get("/dashboard/recent-projects", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []


@pytest.mark.asyncio
async def test_recent_projects_with_data(client: AsyncClient, auth_headers: dict):
    """Recent projects returns created projects."""
    # Create a project first
    await client.post(
        "/projects",
        headers=auth_headers,
        json={
            "name": "Test Dashboard Project",
            "address": "Dakar",
            "lat": 14.6928,
            "lon": -17.4467,
        },
    )
    res = await client.get("/dashboard/recent-projects", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["name"] == "Test Dashboard Project"
    assert data[0]["status"] == "draft"
    assert "peak_power_kwc" in data[0]
    assert "quote_total_fcfa" in data[0]


@pytest.mark.asyncio
async def test_recent_projects_limit(client: AsyncClient, auth_headers: dict):
    """Recent projects returns at most 5 items."""
    for i in range(7):
        await client.post(
            "/projects",
            headers=auth_headers,
            json={
                "name": f"Project {i}",
                "address": "Dakar",
                "lat": 14.6928,
                "lon": -17.4467,
            },
        )
    res = await client.get("/dashboard/recent-projects", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) == 5


@pytest.mark.asyncio
async def test_pipeline_particular_forbidden(client: AsyncClient, auth_headers: dict):
    """Pipeline is forbidden for particular users."""
    res = await client.get("/dashboard/pipeline", headers=auth_headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_pipeline_installer(client: AsyncClient, installer_headers: dict):
    """Installer can access pipeline grouped by status."""
    res = await client.get("/dashboard/pipeline", headers=installer_headers)
    assert res.status_code == 200
    data = res.json()
    assert "draft" in data
    assert "study" in data
    assert "quote" in data
    assert "signed" in data
    assert "installed" in data


@pytest.mark.asyncio
async def test_pipeline_with_projects(client: AsyncClient, installer_headers: dict):
    """Pipeline groups projects by status correctly."""
    # Create projects with different statuses
    p1 = await client.post(
        "/projects",
        headers=installer_headers,
        json={"name": "Draft Project", "lat": 14.69, "lon": -17.44},
    )
    p2 = await client.post(
        "/projects",
        headers=installer_headers,
        json={"name": "Study Project", "lat": 14.69, "lon": -17.44},
    )
    # Update second project to study status
    p2_id = p2.json()["id"]
    await client.put(
        f"/projects/{p2_id}",
        headers=installer_headers,
        json={"status": "study"},
    )

    res = await client.get("/dashboard/pipeline", headers=installer_headers)
    data = res.json()
    assert len(data["draft"]) == 1
    assert len(data["study"]) == 1
    assert data["draft"][0]["name"] == "Draft Project"
    assert data["study"][0]["name"] == "Study Project"


@pytest.mark.asyncio
async def test_charts_particular(client: AsyncClient, auth_headers: dict):
    """Particular user gets projects_by_month in charts."""
    res = await client.get("/dashboard/charts", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "projects_by_month" in data
    assert "registrations_by_month" not in data


@pytest.mark.asyncio
async def test_charts_admin(client: AsyncClient, admin_headers: dict):
    """Admin user gets both projects_by_month and registrations_by_month."""
    res = await client.get("/dashboard/charts", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "projects_by_month" in data
    assert "registrations_by_month" in data


@pytest.mark.asyncio
async def test_stats_with_project(client: AsyncClient, auth_headers: dict):
    """Stats count projects after creation."""
    await client.post(
        "/projects",
        headers=auth_headers,
        json={"name": "Test Project", "lat": 14.69, "lon": -17.44},
    )
    res = await client.get("/dashboard/stats", headers=auth_headers)
    data = res.json()
    assert data["nb_projects"] == 1
