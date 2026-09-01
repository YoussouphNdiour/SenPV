"""
Tests for panel layouts CRUD API.

NOTE: Panel layouts depend on RoofZone (PostGIS) and Equipment.
These tests require a PostgreSQL database with PostGIS extension.

To run these tests:
  TEST_DATABASE_URL=postgresql+asyncpg://user:pass@localhost/senpv_test pytest tests/test_panel_layouts.py
"""

import os
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

# Skip entire module if not using PostgreSQL
pytestmark = pytest.mark.skipif(
    "postgresql" not in os.environ.get("TEST_DATABASE_URL", ""),
    reason="Panel layout tests require PostgreSQL with PostGIS",
)


SAMPLE_POLYGON = {
    "type": "Polygon",
    "coordinates": [
        [
            [-17.4440, 14.6937],
            [-17.4436, 14.6937],
            [-17.4436, 14.6940],
            [-17.4440, 14.6940],
            [-17.4440, 14.6937],
        ]
    ],
}


@pytest_asyncio.fixture
async def project_id(client: AsyncClient, auth_headers: dict[str, str]) -> str:
    res = await client.post(
        "/projects",
        json={
            "name": "Layout Test Project",
            "lat": 14.6937,
            "lon": -17.4440,
            "address": "Dakar, Senegal",
        },
        headers=auth_headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


@pytest_asyncio.fixture
async def zone_id(
    client: AsyncClient, auth_headers: dict[str, str], project_id: str
) -> str:
    res = await client.post(
        f"/projects/{project_id}/zones",
        json={
            "polygon": SAMPLE_POLYGON,
            "orientation_deg": 180.0,
            "tilt_deg": 15.0,
            "roof_type": "flat",
        },
        headers=auth_headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


@pytest_asyncio.fixture
async def panel_model_id(client: AsyncClient, installer_headers: dict[str, str]) -> str:
    res = await client.get("/equipment?type=panel&per_page=1", headers=installer_headers)
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) > 0, "No panels in catalog — seed equipment first"
    return items[0]["id"]


class TestCreateLayout:
    async def test_create_layout_auto_calpinage(
        self,
        client: AsyncClient,
        auth_headers: dict,
        project_id: str,
        zone_id: str,
        panel_model_id: str,
    ):
        res = await client.post(
            f"/projects/{project_id}/layouts",
            json={
                "roof_zone_id": zone_id,
                "panel_model_id": panel_model_id,
            },
            headers=auth_headers,
        )
        assert res.status_code == 201
        data = res.json()
        assert data["roof_zone_id"] == zone_id
        assert data["panel_model_id"] == panel_model_id
        assert data["num_panels"] > 0
        assert data["layout_geojson"] is not None
        assert data["layout_geojson"]["type"] == "FeatureCollection"
        assert len(data["layout_geojson"]["features"]) == data["num_panels"]

    async def test_create_layout_nonexistent_zone(
        self,
        client: AsyncClient,
        auth_headers: dict,
        project_id: str,
        panel_model_id: str,
    ):
        res = await client.post(
            f"/projects/{project_id}/layouts",
            json={
                "roof_zone_id": str(uuid.uuid4()),
                "panel_model_id": panel_model_id,
            },
            headers=auth_headers,
        )
        assert res.status_code == 404

    async def test_create_layout_nonexistent_panel(
        self,
        client: AsyncClient,
        auth_headers: dict,
        project_id: str,
        zone_id: str,
    ):
        res = await client.post(
            f"/projects/{project_id}/layouts",
            json={
                "roof_zone_id": zone_id,
                "panel_model_id": str(uuid.uuid4()),
            },
            headers=auth_headers,
        )
        assert res.status_code == 404


class TestListLayouts:
    async def test_list_empty(
        self, client: AsyncClient, auth_headers: dict, project_id: str
    ):
        res = await client.get(
            f"/projects/{project_id}/layouts", headers=auth_headers
        )
        assert res.status_code == 200
        assert res.json() == []

    async def test_list_with_data(
        self,
        client: AsyncClient,
        auth_headers: dict,
        project_id: str,
        zone_id: str,
        panel_model_id: str,
    ):
        await client.post(
            f"/projects/{project_id}/layouts",
            json={"roof_zone_id": zone_id, "panel_model_id": panel_model_id},
            headers=auth_headers,
        )

        res = await client.get(
            f"/projects/{project_id}/layouts", headers=auth_headers
        )
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1


class TestAddRemovePanel:
    async def test_add_panel_inside_zone(
        self,
        client: AsyncClient,
        auth_headers: dict,
        project_id: str,
        zone_id: str,
        panel_model_id: str,
    ):
        create_res = await client.post(
            f"/projects/{project_id}/layouts",
            json={"roof_zone_id": zone_id, "panel_model_id": panel_model_id},
            headers=auth_headers,
        )
        layout_id = create_res.json()["id"]
        original_count = create_res.json()["num_panels"]

        res = await client.post(
            f"/projects/{project_id}/layouts/{layout_id}/add-panel",
            json={"lat": 14.69385, "lon": -17.44380},
            headers=auth_headers,
        )
        assert res.status_code == 200
        assert res.json()["num_panels"] == original_count + 1

    async def test_add_panel_outside_zone(
        self,
        client: AsyncClient,
        auth_headers: dict,
        project_id: str,
        zone_id: str,
        panel_model_id: str,
    ):
        create_res = await client.post(
            f"/projects/{project_id}/layouts",
            json={"roof_zone_id": zone_id, "panel_model_id": panel_model_id},
            headers=auth_headers,
        )
        layout_id = create_res.json()["id"]

        res = await client.post(
            f"/projects/{project_id}/layouts/{layout_id}/add-panel",
            json={"lat": 14.70, "lon": -17.45},
            headers=auth_headers,
        )
        assert res.status_code == 400

    async def test_remove_panel(
        self,
        client: AsyncClient,
        auth_headers: dict,
        project_id: str,
        zone_id: str,
        panel_model_id: str,
    ):
        create_res = await client.post(
            f"/projects/{project_id}/layouts",
            json={"roof_zone_id": zone_id, "panel_model_id": panel_model_id},
            headers=auth_headers,
        )
        layout_id = create_res.json()["id"]
        original_count = create_res.json()["num_panels"]
        assert original_count > 0

        res = await client.delete(
            f"/projects/{project_id}/layouts/{layout_id}/panels/0",
            headers=auth_headers,
        )
        assert res.status_code == 200
        assert res.json()["num_panels"] == original_count - 1

    async def test_remove_panel_invalid_index(
        self,
        client: AsyncClient,
        auth_headers: dict,
        project_id: str,
        zone_id: str,
        panel_model_id: str,
    ):
        create_res = await client.post(
            f"/projects/{project_id}/layouts",
            json={"roof_zone_id": zone_id, "panel_model_id": panel_model_id},
            headers=auth_headers,
        )
        layout_id = create_res.json()["id"]

        res = await client.delete(
            f"/projects/{project_id}/layouts/{layout_id}/panels/999",
            headers=auth_headers,
        )
        assert res.status_code == 404


class TestDeleteLayout:
    async def test_delete_layout(
        self,
        client: AsyncClient,
        auth_headers: dict,
        project_id: str,
        zone_id: str,
        panel_model_id: str,
    ):
        create_res = await client.post(
            f"/projects/{project_id}/layouts",
            json={"roof_zone_id": zone_id, "panel_model_id": panel_model_id},
            headers=auth_headers,
        )
        layout_id = create_res.json()["id"]

        res = await client.delete(
            f"/projects/{project_id}/layouts/{layout_id}",
            headers=auth_headers,
        )
        assert res.status_code == 204

        # Verify deleted
        list_res = await client.get(
            f"/projects/{project_id}/layouts", headers=auth_headers
        )
        assert len(list_res.json()) == 0
