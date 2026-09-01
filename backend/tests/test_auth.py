import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_particular(client: AsyncClient):
    res = await client.post(
        "/auth/register",
        json={
            "email": "user1@test.com",
            "name": "User One",
            "password": "password123",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "user1@test.com"
    assert data["user"]["role"] == "particular"


@pytest.mark.asyncio
async def test_register_installer(client: AsyncClient):
    res = await client.post(
        "/auth/register",
        json={
            "email": "inst1@test.com",
            "name": "Installer One",
            "password": "password123",
            "role": "installer",
            "company_name": "Solar SARL",
            "phone": "+221770000000",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["user"]["role"] == "installer"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    await client.post(
        "/auth/register",
        json={
            "email": "dup@test.com",
            "name": "First",
            "password": "password123",
        },
    )
    res = await client.post(
        "/auth/register",
        json={
            "email": "dup@test.com",
            "name": "Second",
            "password": "password123",
        },
    )
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    await client.post(
        "/auth/register",
        json={
            "email": "login@test.com",
            "name": "Login User",
            "password": "password123",
        },
    )
    res = await client.post(
        "/auth/login",
        json={"email": "login@test.com", "password": "password123"},
    )
    assert res.status_code == 200
    assert "access_token" in res.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    await client.post(
        "/auth/register",
        json={
            "email": "wrong@test.com",
            "name": "Wrong Pass",
            "password": "password123",
        },
    )
    res = await client.post(
        "/auth/login",
        json={"email": "wrong@test.com", "password": "wrongpass"},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_me_endpoint(client: AsyncClient, auth_headers: dict):
    res = await client.get("/auth/me", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "test@example.com"
    assert data["role"] == "particular"


@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient):
    res = await client.get("/auth/me")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_profile_update(client: AsyncClient, auth_headers: dict):
    res = await client.put(
        "/auth/profile",
        json={"name": "Updated Name", "locale": "en"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Updated Name"
    assert res.json()["locale"] == "en"


@pytest.mark.asyncio
async def test_installer_profile_update(client: AsyncClient, installer_headers: dict):
    res = await client.put(
        "/auth/profile",
        json={"company_name": "New Company Name", "siret": "12345678901234"},
        headers=installer_headers,
    )
    assert res.status_code == 200
    profile = res.json()["installer_profile"]
    assert profile["company_name"] == "New Company Name"
    assert profile["siret"] == "12345678901234"


@pytest.mark.asyncio
async def test_installer_me_includes_profile(client: AsyncClient, installer_headers: dict):
    res = await client.get("/auth/me", headers=installer_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "installer"
    assert data["installer_profile"] is not None
    assert data["installer_profile"]["company_name"] == "Solar Pro SARL"


@pytest.mark.asyncio
async def test_logo_upload_not_installer(client: AsyncClient, auth_headers: dict):
    res = await client.post(
        "/auth/profile/logo",
        files={"file": ("logo.png", b"fake-png-content", "image/png")},
        headers=auth_headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_logo_upload_bad_extension(client: AsyncClient, installer_headers: dict):
    res = await client.post(
        "/auth/profile/logo",
        files={"file": ("logo.exe", b"fake-content", "application/octet-stream")},
        headers=installer_headers,
    )
    assert res.status_code == 400
