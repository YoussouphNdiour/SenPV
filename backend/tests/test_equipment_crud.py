"""Tests for equipment CRUD operations."""

import pytest
from httpx import AsyncClient

PANEL_DATA = {
    "type": "panel",
    "manufacturer": "Test Solar",
    "model": "TS-400",
    "specs": {
        "pmax_w": 400,
        "voc_v": 45.0,
        "vmp_v": 38.0,
        "isc_a": 11.0,
        "imp_a": 10.5,
        "efficiency_pct": 20.5,
        "temp_coeff_pmax_pct_per_c": -0.35,
        "temp_coeff_voc_pct_per_c": -0.27,
        "temp_coeff_isc_pct_per_c": 0.05,
        "noct_c": 45,
        "cells": 72,
        "cell_type": "mono-PERC",
        "dimensions_mm": {"length": 2000, "width": 1000, "height": 35},
        "weight_kg": 22.0,
        "warranty_years": 25,
    },
}

INVERTER_DATA = {
    "type": "inverter",
    "manufacturer": "Test Inverter Co",
    "model": "TI-5000",
    "specs": {
        "max_pv_power_kw": 6.5,
        "max_pv_voltage_v": 550,
        "startup_voltage_v": 80,
        "mppt_voltage_range_v": "80-500",
        "rated_pv_voltage_v": 360,
        "max_input_current_a": 12.5,
        "max_short_circuit_current_a": 18.75,
        "num_mppt": 2,
        "strings_per_mppt": 1,
        "rated_ac_power_kw": 5.0,
        "max_ac_apparent_kva": 5.5,
        "rated_ac_current_a": 22.7,
        "max_ac_current_a": 25.0,
        "rated_output_voltage_v": 230,
        "rated_output_freq_hz": 50,
        "output_freq_range_hz": "45-55",
        "power_factor_range": "0.8 leading - 0.8 lagging",
        "thdi_pct": 3.0,
        "dc_injection_ma": 10,
        "max_efficiency_pct": 97.5,
        "euro_efficiency_pct": 97.0,
        "mppt_efficiency_pct": 99.9,
        "dimensions_mm": {"width": 350, "height": 400, "depth": 180},
        "weight_kg": 15.0,
        "ip_rating": "IP65",
        "warranty_years": 10,
    },
}


@pytest.mark.asyncio
async def test_create_panel(client: AsyncClient, installer_headers: dict):
    res = await client.post("/equipment", json=PANEL_DATA, headers=installer_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["manufacturer"] == "Test Solar"
    assert data["model"] == "TS-400"
    assert data["type"] == "panel"
    assert data["is_global"] is False
    assert data["owner_id"] is not None


@pytest.mark.asyncio
async def test_create_inverter(client: AsyncClient, installer_headers: dict):
    res = await client.post("/equipment", json=INVERTER_DATA, headers=installer_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["type"] == "inverter"
    assert data["is_global"] is False


@pytest.mark.asyncio
async def test_list_equipment(client: AsyncClient, installer_headers: dict):
    # Create a panel
    await client.post("/equipment", json=PANEL_DATA, headers=installer_headers)

    # List without auth — should still work (global only)
    res = await client.get("/equipment")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "pages" in data

    # List with auth — should include personal equipment
    res = await client.get("/equipment", headers=installer_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1


@pytest.mark.asyncio
async def test_list_equipment_filter_by_type(client: AsyncClient, installer_headers: dict):
    await client.post("/equipment", json=PANEL_DATA, headers=installer_headers)
    await client.post("/equipment", json=INVERTER_DATA, headers=installer_headers)

    res = await client.get("/equipment?type=panel", headers=installer_headers)
    assert res.status_code == 200
    for item in res.json()["items"]:
        assert item["type"] == "panel"


@pytest.mark.asyncio
async def test_list_equipment_search(client: AsyncClient, installer_headers: dict):
    await client.post("/equipment", json=PANEL_DATA, headers=installer_headers)

    res = await client.get("/equipment?search=Test+Solar", headers=installer_headers)
    assert res.status_code == 200
    assert res.json()["total"] >= 1


@pytest.mark.asyncio
async def test_update_equipment(client: AsyncClient, installer_headers: dict):
    create_res = await client.post("/equipment", json=PANEL_DATA, headers=installer_headers)
    eq_id = create_res.json()["id"]

    res = await client.put(
        f"/equipment/{eq_id}",
        json={"manufacturer": "Updated Solar"},
        headers=installer_headers,
    )
    assert res.status_code == 200
    assert res.json()["manufacturer"] == "Updated Solar"


@pytest.mark.asyncio
async def test_delete_equipment(client: AsyncClient, installer_headers: dict):
    create_res = await client.post("/equipment", json=PANEL_DATA, headers=installer_headers)
    eq_id = create_res.json()["id"]

    res = await client.delete(f"/equipment/{eq_id}", headers=installer_headers)
    assert res.status_code == 204

    # Verify it's gone
    res = await client.get("/equipment", headers=installer_headers)
    ids = [item["id"] for item in res.json()["items"]]
    assert eq_id not in ids


@pytest.mark.asyncio
async def test_pagination(client: AsyncClient, installer_headers: dict):
    # Create multiple items
    for i in range(5):
        data = {**PANEL_DATA, "model": f"TS-{400 + i}"}
        await client.post("/equipment", json=data, headers=installer_headers)

    res = await client.get("/equipment?per_page=2&page=1", headers=installer_headers)
    data = res.json()
    assert len(data["items"]) == 2
    assert data["per_page"] == 2
    assert data["page"] == 1
    assert data["total"] >= 5
