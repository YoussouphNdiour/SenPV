"""Tests for SENELEC billing service and API."""

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.services.senelec import calculate_bill, calculate_savings


# ── Service unit tests ──────────────────────────────────────────────


class TestCalculateBill:
    def test_100_kwh_single_tier(self):
        """100 kWh uses only DPP tier."""
        result = calculate_bill(100)
        assert result["tariff_tier"] == "DPP"
        assert len(result["breakdown"]) == 1
        assert result["breakdown"][0]["tier"] == "DPP"
        assert result["breakdown"][0]["kwh"] == 100
        assert result["breakdown"][0]["rate"] == 90.47
        # 100 * 90.47 = 9047
        assert result["subtotal_fcfa"] == 9047
        # TVA 18%: floor(9047 * 0.18) = 1628
        assert result["tva_amount_fcfa"] == 1628
        # Redevance 872
        assert result["redevance_fcfa"] == 872
        # Total: 9047 + 872 + 1628 = 11547
        assert result["total_monthly_fcfa"] == 11547
        assert result["total_annual_fcfa"] == 11547 * 12

    def test_200_kwh_two_tiers(self):
        """200 kWh spans DPP (150) + DMP (50)."""
        result = calculate_bill(200)
        assert len(result["breakdown"]) == 2

        dpp = result["breakdown"][0]
        assert dpp["tier"] == "DPP"
        assert dpp["kwh"] == 150
        # 150 * 90.47 = 13570 (floor)
        assert dpp["amount"] == 13570

        dmp = result["breakdown"][1]
        assert dmp["tier"] == "DMP"
        assert dmp["kwh"] == 50
        # 50 * 101.64 = 5082
        assert dmp["amount"] == 5082

        assert result["subtotal_fcfa"] == 13570 + 5082

    def test_350_kwh_three_tiers(self):
        """350 kWh spans all three domestic tiers."""
        result = calculate_bill(350)
        assert len(result["breakdown"]) == 3

        assert result["breakdown"][0]["tier"] == "DPP"
        assert result["breakdown"][0]["kwh"] == 150

        assert result["breakdown"][1]["tier"] == "DMP"
        assert result["breakdown"][1]["kwh"] == 100

        assert result["breakdown"][2]["tier"] == "DGP"
        assert result["breakdown"][2]["kwh"] == 100

        # Verify amounts
        subtotal = (
            150 * 90.47   # 13570
            + 100 * 101.64  # 10164
            + 100 * 112.65  # 11265
        )
        # floor each
        expected_subtotal = 13570 + 10164 + 11265
        assert result["subtotal_fcfa"] == expected_subtotal

    def test_professional_flat_rate(self):
        """Professional tier uses flat rate."""
        result = calculate_bill(500, tariff_tier="PP")
        assert result["tariff_tier"] == "PP"
        assert len(result["breakdown"]) == 1
        assert result["breakdown"][0]["tier"] == "PP"
        assert result["breakdown"][0]["kwh"] == 500
        assert result["breakdown"][0]["rate"] == 118.00
        # 500 * 118 = 59000
        assert result["subtotal_fcfa"] == 59000

    def test_tva_applied(self):
        """TVA 18% is correctly applied."""
        result = calculate_bill(100)
        expected_tva = int(result["subtotal_fcfa"] * 18 / 100)
        assert result["tva_amount_fcfa"] == expected_tva
        assert result["tva_pct"] == 18.0

    def test_redevance_added(self):
        """Redevance 872 FCFA is added."""
        result = calculate_bill(100)
        assert result["redevance_fcfa"] == 872

    def test_auto_tier_selection(self):
        """Tier is auto-selected based on kWh."""
        assert calculate_bill(100)["tariff_tier"] == "DPP"
        assert calculate_bill(200)["tariff_tier"] == "DMP"
        assert calculate_bill(300)["tariff_tier"] == "DGP"


class TestCalculateSavings:
    def test_savings_50pct_production(self):
        """PV production = 50% of consumption."""
        result = calculate_savings(
            monthly_kwh=300,
            tariff_tier=None,
            annual_production_kwh=300 * 6,  # 150 kWh/month = 50%
        )
        assert result["monthly_savings_fcfa"] > 0
        assert result["annual_savings_fcfa"] == result["monthly_savings_fcfa"] * 12
        assert result["self_consumption_pct"] == 100.0  # all PV used
        assert result["grid_reduction_pct"] > 0

    def test_production_exceeds_consumption(self):
        """Excess production is not valued (no negative bill)."""
        result = calculate_savings(
            monthly_kwh=100,
            tariff_tier=None,
            annual_production_kwh=200 * 12,  # 200 kWh/month > 100 kWh
        )
        # Bill with PV should have 0 kWh consumption (only redevance + TVA on 0)
        assert result["bill_with_pv"]["monthly_kwh"] == 0
        assert result["bill_with_pv"]["subtotal_fcfa"] == 0
        # Savings should not exceed the original bill
        assert result["monthly_savings_fcfa"] <= result["bill_without_pv"]["total_monthly_fcfa"]
        # Self-consumption < 100% because excess is wasted
        assert result["self_consumption_pct"] == 50.0

    def test_no_production(self):
        """Zero annual production means zero savings."""
        # This test validates edge case handling
        result = calculate_savings(
            monthly_kwh=300,
            tariff_tier=None,
            annual_production_kwh=0.01,  # near-zero
        )
        assert result["monthly_savings_fcfa"] == 0
        assert result["grid_reduction_pct"] == 0.0


# ── API integration tests ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_tariffs(client: AsyncClient):
    """GET /senelec/tariffs returns the tariff grid."""
    res = await client.get("/senelec/tariffs")
    assert res.status_code == 200
    data = res.json()
    assert "tariffs" in data
    assert "taxes" in data
    assert len(data["tariffs"]) == 4
    assert data["taxes"]["tva_pct"] == 18.0
    assert data["taxes"]["redevance_mensuelle_fcfa"] == 872


@pytest.mark.asyncio
async def test_post_bill(client: AsyncClient):
    """POST /senelec/bill calculates a bill."""
    res = await client.post("/senelec/bill", json={"monthly_kwh": 350})
    assert res.status_code == 200
    data = res.json()
    assert data["monthly_kwh"] == 350
    assert len(data["breakdown"]) == 3
    assert data["total_monthly_fcfa"] > 0
    assert data["tva_amount_fcfa"] > 0


@pytest.mark.asyncio
async def test_post_bill_with_tier(client: AsyncClient):
    """POST /senelec/bill with explicit tier."""
    res = await client.post(
        "/senelec/bill",
        json={"monthly_kwh": 500, "tariff_tier": "PP"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["tariff_tier"] == "PP"
    assert len(data["breakdown"]) == 1


@pytest.mark.asyncio
async def test_post_bill_invalid_tier(client: AsyncClient):
    """POST /senelec/bill with invalid tier returns 400."""
    res = await client.post(
        "/senelec/bill",
        json={"monthly_kwh": 100, "tariff_tier": "INVALID"},
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_post_savings(client: AsyncClient):
    """POST /senelec/savings calculates savings."""
    res = await client.post(
        "/senelec/savings",
        json={"monthly_kwh": 300, "annual_production_kwh": 1800},
    )
    assert res.status_code == 200
    data = res.json()
    assert "bill_without_pv" in data
    assert "bill_with_pv" in data
    assert data["monthly_savings_fcfa"] > 0
    assert data["annual_savings_fcfa"] > 0
    assert 0 <= data["self_consumption_pct"] <= 100
    assert 0 <= data["grid_reduction_pct"] <= 100
