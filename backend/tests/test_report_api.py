"""Tests for report API endpoints."""

import pytest
import pytest_asyncio
from httpx import AsyncClient

# Check if WeasyPrint is functional (avoids segfault on some envs)
_weasyprint_ok = False
try:
    from weasyprint import HTML
    HTML(string="<p>test</p>").write_pdf()
    _weasyprint_ok = True
except Exception:
    pass

needs_weasyprint = pytest.mark.skipif(
    not _weasyprint_ok,
    reason="WeasyPrint not available or non-functional in test env",
)


@pytest_asyncio.fixture
async def project_id(client: AsyncClient, auth_headers: dict[str, str]) -> str:
    """Create a test project and return its ID."""
    res = await client.post(
        "/projects",
        json={
            "name": "Report Test Project",
            "lat": 14.6928,
            "lon": -17.4467,
        },
        headers=auth_headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


@pytest.mark.asyncio
async def test_list_reports_empty(client: AsyncClient, auth_headers: dict, project_id: str):
    """Listing reports for a project with no reports should return empty list."""
    res = await client.get(
        f"/projects/{project_id}/reports",
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json() == []


@needs_weasyprint
@pytest.mark.asyncio
async def test_generate_full_report(client: AsyncClient, auth_headers: dict, project_id: str):
    """Generating a full report should create a report record."""
    res = await client.post(
        f"/projects/{project_id}/report",
        headers=auth_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["type"] == "full_report"
    assert data["project_id"] == project_id
    assert "file_path" in data
    assert "generated_at" in data


@needs_weasyprint
@pytest.mark.asyncio
async def test_generate_and_list_reports(client: AsyncClient, auth_headers: dict, project_id: str):
    """After generating a report, it should appear in the list."""
    res = await client.post(
        f"/projects/{project_id}/report",
        headers=auth_headers,
    )
    assert res.status_code == 201
    report_id = res.json()["id"]

    res = await client.get(
        f"/projects/{project_id}/reports",
        headers=auth_headers,
    )
    assert res.status_code == 200
    reports = res.json()
    assert len(reports) >= 1
    assert any(r["id"] == report_id for r in reports)


@needs_weasyprint
@pytest.mark.asyncio
async def test_download_report(client: AsyncClient, auth_headers: dict, project_id: str):
    """Downloading a generated report should return a PDF."""
    res = await client.post(
        f"/projects/{project_id}/report",
        headers=auth_headers,
    )
    assert res.status_code == 201
    report_id = res.json()["id"]

    res = await client.get(
        f"/projects/{project_id}/reports/{report_id}/download",
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"


@needs_weasyprint
@pytest.mark.asyncio
async def test_delete_report(client: AsyncClient, auth_headers: dict, project_id: str):
    """Deleting a report should remove it."""
    res = await client.post(
        f"/projects/{project_id}/report",
        headers=auth_headers,
    )
    assert res.status_code == 201
    report_id = res.json()["id"]

    res = await client.delete(
        f"/projects/{project_id}/reports/{report_id}",
        headers=auth_headers,
    )
    assert res.status_code == 204

    res = await client.get(
        f"/projects/{project_id}/reports",
        headers=auth_headers,
    )
    reports = res.json()
    assert not any(r["id"] == report_id for r in reports)


@pytest.mark.asyncio
async def test_download_nonexistent_report(client: AsyncClient, auth_headers: dict, project_id: str):
    """Downloading a non-existent report should return 404."""
    res = await client.get(
        f"/projects/{project_id}/reports/00000000-0000-0000-0000-000000000000/download",
        headers=auth_headers,
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_report_quote_no_quote(client: AsyncClient, auth_headers: dict, project_id: str):
    """Generating quote PDF without a quote should return 404."""
    res = await client.post(
        f"/projects/{project_id}/report/quote",
        headers=auth_headers,
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_report_schematic_no_schematic(client: AsyncClient, auth_headers: dict, project_id: str):
    """Generating schematic PDF without a schematic should return 404."""
    res = await client.post(
        f"/projects/{project_id}/report/schematic",
        headers=auth_headers,
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_report_unauthorized(client: AsyncClient, project_id: str):
    """Reports should require authentication."""
    res = await client.get(f"/projects/{project_id}/reports")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_report_wrong_user(client: AsyncClient, auth_headers: dict, project_id: str):
    """A different user should not access another user's project reports."""
    # Register another user
    await client.post(
        "/auth/register",
        json={
            "email": "other@example.com",
            "name": "Other User",
            "password": "otherpass123",
            "role": "particular",
        },
    )
    login_res = await client.post(
        "/auth/login",
        json={"email": "other@example.com", "password": "otherpass123"},
    )
    other_headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

    res = await client.get(
        f"/projects/{project_id}/reports",
        headers=other_headers,
    )
    assert res.status_code == 403
