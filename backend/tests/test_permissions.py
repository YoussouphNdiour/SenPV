import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_particular_cannot_access_installer_route(client: AsyncClient, auth_headers: dict):
    """Particular users should not have installer role."""
    res = await client.get("/auth/me", headers=auth_headers)
    assert res.json()["role"] == "particular"


@pytest.mark.asyncio
async def test_installer_has_correct_role(client: AsyncClient, installer_headers: dict):
    """Installer users should have installer role."""
    res = await client.get("/auth/me", headers=installer_headers)
    assert res.json()["role"] == "installer"


@pytest.mark.asyncio
async def test_unauthenticated_cannot_access_me(client: AsyncClient):
    """Unauthenticated requests should be rejected."""
    res = await client.get("/auth/me")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_invalid_token_rejected(client: AsyncClient):
    """Invalid JWT tokens should be rejected."""
    res = await client.get(
        "/auth/me",
        headers={"Authorization": "Bearer invalid-token-here"},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_particular_cannot_upload_logo(client: AsyncClient, auth_headers: dict):
    """Only installers can upload logos."""
    res = await client.post(
        "/auth/profile/logo",
        files={"file": ("logo.png", b"fake", "image/png")},
        headers=auth_headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_register_invalid_role(client: AsyncClient):
    """Registration with invalid role should fail."""
    res = await client.post(
        "/auth/register",
        json={
            "email": "bad@test.com",
            "name": "Bad Role",
            "password": "password123",
            "role": "admin",
        },
    )
    assert res.status_code == 400
