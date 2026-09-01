"""
Tests for roof zones CRUD API.

NOTE: RoofZone uses PostGIS Geometry columns which are incompatible with SQLite.
These tests require a PostgreSQL database with PostGIS extension.
They are skipped when running with the default SQLite test database.

To run these tests:
  TEST_DATABASE_URL=postgresql+asyncpg://user:pass@localhost/senpv_test pytest tests/test_roof_zones.py
"""

import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Skip entire module if not using PostgreSQL
pytestmark = pytest.mark.skipif(
    "postgresql" not in os.environ.get("TEST_DATABASE_URL", ""),
    reason="Roof zone tests require PostgreSQL with PostGIS (Geometry columns unsupported in SQLite)",
)


SAMPLE_POLYGON = {
    "type": "Polygon",
    "coordinates": [
        [
            [-17.4440, 14.6937],
            [-17.4438, 14.6937],
            [-17.4438, 14.6935],
            [-17.4440, 14.6935],
            [-17.4440, 14.6937],
        ]
    ],
}

SAMPLE_POLYGON_2 = {
    "type": "Polygon",
    "coordinates": [
        [
            [-17.4445, 14.6940],
            [-17.4443, 14.6940],
            [-17.4443, 14.6938],
            [-17.4445, 14.6938],
            [-17.4445, 14.6940],
        ]
    ],
}


@pytest_asyncio.fixture
async def project_id(client: AsyncClient, auth_headers: dict[str, str]) -> str:
    """Create a test project and return its ID."""
    res = await client.post(
        "/projects",
        json={
            "name": "Test Roof Project",
            "lat": 14.6937,
            "lon": -17.4440,
            "address": "Dakar, Sénégal",
        },
        headers=auth_headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


class TestCreateZone:
    async def test_create_zone_with_polygon(
        self, client: AsyncClient, auth_headers: dict, project_id: str
    ):
        res = await client.post(
            f"/projects/{project_id}/zones",
            json={"polygon": SAMPLE_POLYGON},
            headers=auth_headers,
        )
        assert res.status_code == 201
        data = res.json()
        assert data["project_id"] == project_id
        assert data["polygon"]["type"] == "Polygon"
        assert data["zone_index"] == 0
        assert data["area_m2"] is not None
        assert float(data["area_m2"]) > 0

    async def test_create_zone_increments_index(
        self, client: AsyncClient, auth_headers: dict, project_id: str
    ):
        res1 = await client.post(
            f"/projects/{project_id}/zones",
            json={"polygon": SAMPLE_POLYGON},
            headers=auth_headers,
        )
        assert res1.json()["zone_index"] == 0

        res2 = await client.post(
            f"/projects/{project_id}/zones",
            json={"polygon": SAMPLE_POLYGON_2},
            headers=auth_headers,
        )
        assert res2.json()["zone_index"] == 1

    async def test_create_zone_not_found_project(
        self, client: AsyncClient, auth_headers: dict
    ):
        fake_id = str(uuid.uuid4())
        res = await client.post(
            f"/projects/{fake_id}/zones",
            json={"polygon": SAMPLE_POLYGON},
            headers=auth_headers,
        )
        assert res.status_code == 404


class TestListZones:
    async def test_list_zones_empty(
        self, client: AsyncClient, auth_headers: dict, project_id: str
    ):
        res = await client.get(
            f"/projects/{project_id}/zones",
            headers=auth_headers,
        )
        assert res.status_code == 200
        assert res.json() == []

    async def test_list_zones_with_data(
        self, client: AsyncClient, auth_headers: dict, project_id: str
    ):
        await client.post(
            f"/projects/{project_id}/zones",
            json={"polygon": SAMPLE_POLYGON},
            headers=auth_headers,
        )
        await client.post(
            f"/projects/{project_id}/zones",
            json={"polygon": SAMPLE_POLYGON_2},
            headers=auth_headers,
        )

        res = await client.get(
            f"/projects/{project_id}/zones",
            headers=auth_headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 2
        assert data[0]["zone_index"] == 0
        assert data[1]["zone_index"] == 1


class TestUpdateZone:
    async def test_update_zone_properties(
        self, client: AsyncClient, auth_headers: dict, project_id: str
    ):
        create_res = await client.post(
            f"/projects/{project_id}/zones",
            json={"polygon": SAMPLE_POLYGON},
            headers=auth_headers,
        )
        zone_id = create_res.json()["id"]

        res = await client.put(
            f"/projects/{project_id}/zones/{zone_id}",
            json={
                "orientation_deg": 180.0,
                "tilt_deg": 15.0,
                "roof_type": "flat",
            },
            headers=auth_headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert float(data["orientation_deg"]) == 180.0
        assert float(data["tilt_deg"]) == 15.0
        assert data["roof_type"] == "flat"

    async def test_update_zone_polygon_recalculates_area(
        self, client: AsyncClient, auth_headers: dict, project_id: str
    ):
        create_res = await client.post(
            f"/projects/{project_id}/zones",
            json={"polygon": SAMPLE_POLYGON},
            headers=auth_headers,
        )
        zone_id = create_res.json()["id"]
        original_area = float(create_res.json()["area_m2"])

        # Update with a larger polygon
        larger_polygon = {
            "type": "Polygon",
            "coordinates": [
                [
                    [-17.4440, 14.6937],
                    [-17.4435, 14.6937],
                    [-17.4435, 14.6932],
                    [-17.4440, 14.6932],
                    [-17.4440, 14.6937],
                ]
            ],
        }
        res = await client.put(
            f"/projects/{project_id}/zones/{zone_id}",
            json={"polygon": larger_polygon},
            headers=auth_headers,
        )
        assert res.status_code == 200
        new_area = float(res.json()["area_m2"])
        assert new_area > original_area

    async def test_update_nonexistent_zone(
        self, client: AsyncClient, auth_headers: dict, project_id: str
    ):
        fake_id = str(uuid.uuid4())
        res = await client.put(
            f"/projects/{project_id}/zones/{fake_id}",
            json={"orientation_deg": 90.0},
            headers=auth_headers,
        )
        assert res.status_code == 404


class TestDeleteZone:
    async def test_delete_zone(
        self, client: AsyncClient, auth_headers: dict, project_id: str
    ):
        create_res = await client.post(
            f"/projects/{project_id}/zones",
            json={"polygon": SAMPLE_POLYGON},
            headers=auth_headers,
        )
        zone_id = create_res.json()["id"]

        res = await client.delete(
            f"/projects/{project_id}/zones/{zone_id}",
            headers=auth_headers,
        )
        assert res.status_code == 204

        # Verify deleted
        list_res = await client.get(
            f"/projects/{project_id}/zones",
            headers=auth_headers,
        )
        assert len(list_res.json()) == 0

    async def test_delete_nonexistent_zone(
        self, client: AsyncClient, auth_headers: dict, project_id: str
    ):
        fake_id = str(uuid.uuid4())
        res = await client.delete(
            f"/projects/{project_id}/zones/{fake_id}",
            headers=auth_headers,
        )
        assert res.status_code == 404


class TestZoneGeoJSON:
    async def test_polygon_returned_as_geojson(
        self, client: AsyncClient, auth_headers: dict, project_id: str
    ):
        res = await client.post(
            f"/projects/{project_id}/zones",
            json={"polygon": SAMPLE_POLYGON},
            headers=auth_headers,
        )
        data = res.json()
        assert data["polygon"]["type"] == "Polygon"
        assert len(data["polygon"]["coordinates"]) == 1
        assert len(data["polygon"]["coordinates"][0]) >= 4  # closed ring

    async def test_area_computed_in_m2(
        self, client: AsyncClient, auth_headers: dict, project_id: str
    ):
        res = await client.post(
            f"/projects/{project_id}/zones",
            json={"polygon": SAMPLE_POLYGON},
            headers=auth_headers,
        )
        area = float(res.json()["area_m2"])
        # The sample polygon is roughly 20m x 20m = ~400-600 m²
        assert 100 < area < 2000
