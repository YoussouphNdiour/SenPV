"""Tests for financial analysis service."""

from app.services.financial import calculate_financial_analysis


class TestPaybackCalculation:
    def test_payback_around_10_years(self):
        """Cost 5M FCFA, savings 500k/yr -> payback ~10 years."""
        result = calculate_financial_analysis(
            total_cost_fcfa=5_000_000,
            annual_production_kwh=5000,
            annual_savings_fcfa=500_000,
            degradation_rate_pct=0.5,
            discount_rate_pct=8.0,
            inflation_rate_pct=2.0,
            maintenance_annual_fcfa=0,
        )
        assert result["payback_years"] is not None
        # With 2% inflation, payback should be slightly under 10
        assert 8 <= result["payback_years"] <= 11

    def test_payback_with_maintenance(self):
        """Maintenance extends payback."""
        without_maint = calculate_financial_analysis(
            total_cost_fcfa=5_000_000,
            annual_production_kwh=5000,
            annual_savings_fcfa=500_000,
            maintenance_annual_fcfa=0,
        )
        with_maint = calculate_financial_analysis(
            total_cost_fcfa=5_000_000,
            annual_production_kwh=5000,
            annual_savings_fcfa=500_000,
            maintenance_annual_fcfa=50_000,
        )
        assert with_maint["payback_years"] > without_maint["payback_years"]

    def test_no_payback_when_savings_too_low(self):
        """Very high cost vs low savings -> no payback in 25 years."""
        result = calculate_financial_analysis(
            total_cost_fcfa=50_000_000,
            annual_production_kwh=1000,
            annual_savings_fcfa=100_000,
            maintenance_annual_fcfa=80_000,
        )
        assert result["payback_years"] is None


class TestNpv:
    def test_npv_positive_when_irr_above_discount(self):
        """NPV should be positive when project is profitable."""
        result = calculate_financial_analysis(
            total_cost_fcfa=3_000_000,
            annual_production_kwh=5000,
            annual_savings_fcfa=600_000,
        )
        assert result["npv_fcfa"] > 0

    def test_npv_decreases_with_higher_discount_rate(self):
        """Higher discount rate should reduce NPV."""
        low_discount = calculate_financial_analysis(
            total_cost_fcfa=5_000_000,
            annual_production_kwh=5000,
            annual_savings_fcfa=500_000,
            discount_rate_pct=5.0,
        )
        high_discount = calculate_financial_analysis(
            total_cost_fcfa=5_000_000,
            annual_production_kwh=5000,
            annual_savings_fcfa=500_000,
            discount_rate_pct=15.0,
        )
        assert low_discount["npv_fcfa"] > high_discount["npv_fcfa"]


class TestIrr:
    def test_irr_calculated(self):
        """IRR should be calculated for a standard profitable project."""
        result = calculate_financial_analysis(
            total_cost_fcfa=5_000_000,
            annual_production_kwh=5000,
            annual_savings_fcfa=500_000,
        )
        assert result["irr_pct"] is not None
        assert result["irr_pct"] > 0


class TestDegradation:
    def test_zero_degradation_constant_production(self):
        """0% degradation -> production stays constant over 25 years."""
        result = calculate_financial_analysis(
            total_cost_fcfa=5_000_000,
            annual_production_kwh=5000,
            annual_savings_fcfa=500_000,
            degradation_rate_pct=0.0,
        )
        cashflow = result["cashflow_25y"]
        assert cashflow[1]["production_kwh"] == cashflow[25]["production_kwh"]

    def test_degradation_reduces_production(self):
        """Production in year 25 should be lower than year 1 with degradation."""
        result = calculate_financial_analysis(
            total_cost_fcfa=5_000_000,
            annual_production_kwh=5000,
            annual_savings_fcfa=500_000,
            degradation_rate_pct=0.5,
        )
        cashflow = result["cashflow_25y"]
        assert cashflow[25]["production_kwh"] < cashflow[1]["production_kwh"]


class TestCashflow:
    def test_cashflow_length(self):
        """Cashflow should have 26 entries (year 0 + 25 years)."""
        result = calculate_financial_analysis(
            total_cost_fcfa=5_000_000,
            annual_production_kwh=5000,
            annual_savings_fcfa=500_000,
        )
        assert len(result["cashflow_25y"]) == 26

    def test_year_zero_is_investment(self):
        """Year 0 should be the negative investment."""
        result = calculate_financial_analysis(
            total_cost_fcfa=5_000_000,
            annual_production_kwh=5000,
            annual_savings_fcfa=500_000,
        )
        year0 = result["cashflow_25y"][0]
        assert year0["year"] == 0
        assert year0["net_cashflow_fcfa"] == -5_000_000
        assert year0["cumulative_fcfa"] == -5_000_000
        assert year0["production_kwh"] == 0


class TestLcoe:
    def test_lcoe_calculated(self):
        """LCOE should be positive."""
        result = calculate_financial_analysis(
            total_cost_fcfa=5_000_000,
            annual_production_kwh=5000,
            annual_savings_fcfa=500_000,
        )
        assert result["lcoe_fcfa_per_kwh"] > 0

    def test_lcoe_proportional_to_cost(self):
        """Double the cost -> double the LCOE (same production)."""
        r1 = calculate_financial_analysis(
            total_cost_fcfa=5_000_000,
            annual_production_kwh=5000,
            annual_savings_fcfa=500_000,
        )
        r2 = calculate_financial_analysis(
            total_cost_fcfa=10_000_000,
            annual_production_kwh=5000,
            annual_savings_fcfa=500_000,
        )
        assert abs(r2["lcoe_fcfa_per_kwh"] - 2 * r1["lcoe_fcfa_per_kwh"]) < 1


class TestRoi:
    def test_roi_positive_for_profitable_project(self):
        """ROI should be positive when total savings exceed cost."""
        result = calculate_financial_analysis(
            total_cost_fcfa=3_000_000,
            annual_production_kwh=5000,
            annual_savings_fcfa=600_000,
        )
        assert result["roi_pct"] > 0
