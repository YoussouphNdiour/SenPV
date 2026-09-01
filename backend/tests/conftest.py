import asyncio
import os
import tempfile
from collections.abc import AsyncGenerator

# Set upload_dir before importing app to avoid /data mount issues
os.environ.setdefault("UPLOAD_DIR", os.path.join(tempfile.gettempdir(), "senpv_test_uploads"))

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.main import app

# Register JSONB and UUID compilation for SQLite
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(UUID, "sqlite")
def compile_uuid_sqlite(type_, compiler, **kw):
    return "VARCHAR(36)"

# Use SQLite for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# Tables that use PostGIS types — skip these in SQLite tests
SKIP_TABLES = {"roof_zones"}


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    def create_tables(conn):
        tables = [t for t in Base.metadata.sorted_tables if t.name not in SKIP_TABLES]
        Base.metadata.create_all(conn, tables=tables)

    def drop_tables(conn):
        tables = [t for t in Base.metadata.sorted_tables if t.name not in SKIP_TABLES]
        Base.metadata.drop_all(conn, tables=tables)

    async with engine.begin() as conn:
        await conn.run_sync(create_tables)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(drop_tables)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    """Register a test user and return auth headers."""
    await client.post(
        "/auth/register",
        json={
            "email": "test@example.com",
            "name": "Test User",
            "password": "testpass123",
            "role": "particular",
        },
    )
    res = await client.post(
        "/auth/login",
        json={"email": "test@example.com", "password": "testpass123"},
    )
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def installer_headers(client: AsyncClient) -> dict[str, str]:
    """Register an installer user and return auth headers."""
    await client.post(
        "/auth/register",
        json={
            "email": "installer@example.com",
            "name": "Installer User",
            "password": "testpass123",
            "role": "installer",
            "company_name": "Solar Pro SARL",
            "phone": "+221770001234",
        },
    )
    res = await client.post(
        "/auth/login",
        json={"email": "installer@example.com", "password": "testpass123"},
    )
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def admin_headers(client: AsyncClient) -> dict[str, str]:
    """Create an admin user directly in DB and return auth headers."""
    import bcrypt

    from app.models.user import User

    async with TestSessionLocal() as db:
        admin = User(
            email="admin@test.com",
            name="Admin User",
            password_hash=bcrypt.hashpw(b"adminpass123", bcrypt.gensalt()).decode(),
            role="admin",
        )
        db.add(admin)
        await db.commit()

    res = await client.post(
        "/auth/login",
        json={"email": "admin@test.com", "password": "adminpass123"},
    )
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
