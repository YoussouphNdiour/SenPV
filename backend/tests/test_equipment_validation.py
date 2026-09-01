"""Tests for equipment spec validation."""

import pytest
from httpx import AsyncClient

from tests.test_equipment_crud import PANEL_DATA, INVERTER_DATA


@pytest.mark.asyncio
async def test_invalid_type(client: AsyncClient, installer_headers: dict):
    """Type must be 'panel' or 'inverter'."""
    data = {**PANEL_DATA, "type": "battery"}
    res = await client.post("/equipment", json=data, headers=installer_headers)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_panel_vmp_greater_than_voc(client: AsyncClient, installer_headers: dict):
    """Vmp must be less than Voc."""
    specs = {**PANEL_DATA["specs"], "vmp_v": 50.0, "voc_v": 45.0}
    data = {**PANEL_DATA, "specs": specs}
    res = await client.post("/equipment", json=data, headers=installer_headers)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_panel_vmp_equal_voc(client: AsyncClient, installer_headers: dict):
    """Vmp equal to Voc should also fail."""
    specs = {**PANEL_DATA["specs"], "vmp_v": 45.0, "voc_v": 45.0}
    data = {**PANEL_DATA, "specs": specs}
    res = await client.post("/equipment", json=data, headers=installer_headers)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_panel_imp_greater_than_isc(client: AsyncClient, installer_headers: dict):
    """Imp must be less than Isc."""
    specs = {**PANEL_DATA["specs"], "imp_a": 12.0, "isc_a": 11.0}
    data = {**PANEL_DATA, "specs": specs}
    res = await client.post("/equipment", json=data, headers=installer_headers)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_panel_negative_pmax(client: AsyncClient, installer_headers: dict):
    """Pmax must be positive."""
    specs = {**PANEL_DATA["specs"], "pmax_w": -100}
    data = {**PANEL_DATA, "specs": specs}
    res = await client.post("/equipment", json=data, headers=installer_headers)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_panel_pmax_over_limit(client: AsyncClient, installer_headers: dict):
    """Pmax must be <= 1000W."""
    specs = {**PANEL_DATA["specs"], "pmax_w": 1500}
    data = {**PANEL_DATA, "specs": specs}
    res = await client.post("/equipment", json=data, headers=installer_headers)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_panel_efficiency_over_limit(client: AsyncClient, installer_headers: dict):
    """Efficiency must be <= 30%."""
    specs = {**PANEL_DATA["specs"], "efficiency_pct": 35}
    data = {**PANEL_DATA, "specs": specs}
    res = await client.post("/equipment", json=data, headers=installer_headers)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_panel_missing_required_field(client: AsyncClient, installer_headers: dict):
    """Missing required spec field should fail."""
    specs = {**PANEL_DATA["specs"]}
    del specs["pmax_w"]
    data = {**PANEL_DATA, "specs": specs}
    res = await client.post("/equipment", json=data, headers=installer_headers)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_inverter_negative_power(client: AsyncClient, installer_headers: dict):
    """Inverter power must be positive."""
    specs = {**INVERTER_DATA["specs"], "rated_ac_power_kw": -5}
    data = {**INVERTER_DATA, "specs": specs}
    res = await client.post("/equipment", json=data, headers=installer_headers)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_inverter_efficiency_over_100(client: AsyncClient, installer_headers: dict):
    """Max efficiency must be <= 100%."""
    specs = {**INVERTER_DATA["specs"], "max_efficiency_pct": 105}
    data = {**INVERTER_DATA, "specs": specs}
    res = await client.post("/equipment", json=data, headers=installer_headers)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_inverter_thdi_over_limit(client: AsyncClient, installer_headers: dict):
    """THDi must be <= 10%."""
    specs = {**INVERTER_DATA["specs"], "thdi_pct": 15}
    data = {**INVERTER_DATA, "specs": specs}
    res = await client.post("/equipment", json=data, headers=installer_headers)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_inverter_valid_data(client: AsyncClient, installer_headers: dict):
    """Valid inverter data should pass validation."""
    res = await client.post("/equipment", json=INVERTER_DATA, headers=installer_headers)
    assert res.status_code == 201


@pytest.mark.asyncio
async def test_panel_valid_data(client: AsyncClient, installer_headers: dict):
    """Valid panel data should pass validation."""
    res = await client.post("/equipment", json=PANEL_DATA, headers=installer_headers)
    assert res.status_code == 201
