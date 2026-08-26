import pytest
from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np

SAMPLE_PANEL_SPECS = {
    "pmax_w": 545,
    "voc_v": 49.65,
    "vmp_v": 41.65,
    "isc_a": 13.92,
    "imp_a": 13.09,
    "temp_coeff_pmax_pct_per_c": -0.35,
    "temp_coeff_voc_pct_per_c": -0.25,
    "temp_coeff_isc_pct_per_c": 0.04,
    "cells": 72,
    "efficiency_pct": 21.1,
    "noct_c": 45,
}

SAMPLE_INVERTER_SPECS = {
    "max_pv_power_kw": 6.0,
    "euro_efficiency_pct": 97.0,
}


def _make_tmy_dataframe():
    """Create a realistic TMY-like DataFrame for Dakar.

    Uses pvlib solar position to ensure irradiance is correctly distributed
    across sunrise/sunset, which is needed for reliable azimuth optimisation.
    """
    import pvlib as _pvlib

    index = pd.date_range("2005-01-01", periods=8760, freq="h", tz="Africa/Dakar")
    np.random.seed(42)

    # Derive GHI from actual solar zenith angle so the sun path is realistic
    loc = _pvlib.location.Location(14.6928, -17.4467, tz="Africa/Dakar", altitude=30)
    solar_pos = loc.get_solarposition(index)
    cos_z = np.cos(np.radians(solar_pos["apparent_zenith"].values))
    cos_z = np.where(cos_z > 0, cos_z, 0)

    ghi = np.clip(900 * cos_z + np.random.normal(0, 30, 8760), 0, 1200)
    dni = ghi * 0.75
    dhi = ghi * 0.25
    temp_air = 28 + 5 * np.sin(2 * np.pi * (index.dayofyear - 80) / 365) + np.random.normal(0, 2, 8760)
    wind_speed = np.abs(np.random.normal(3, 1.5, 8760))

    return pd.DataFrame({
        "ghi": ghi,
        "dni": dni,
        "dhi": dhi,
        "temp_air": temp_air,
        "wind_speed": wind_speed,
    }, index=index)


class TestSimulatePV:
    """Test simulate_pv with mocked TMY data."""

    @patch("app.services.pvlib_service.pvlib.iotools.get_pvgis_tmy")
    def test_returns_valid_structure(self, mock_pvgis):
        mock_pvgis.return_value = (_make_tmy_dataframe(), None, None, None)

        from app.services.pvlib_service import simulate_pv

        result = simulate_pv(
            lat=14.6928, lon=-17.4467,
            tilt=15.0, azimuth=180.0,
            panel_specs=SAMPLE_PANEL_SPECS,
            num_panels=10,
            num_strings=2,
            panels_per_string=5,
            inverter_specs=SAMPLE_INVERTER_SPECS,
        )

        assert "monthly_production" in result
        assert "annual_kwh" in result
        assert "specific_yield" in result
        assert "peak_power_kwc" in result
        assert "performance_ratio" in result
        assert len(result["monthly_production"]) == 12
        assert all("month" in m and "kwh" in m for m in result["monthly_production"])

    @patch("app.services.pvlib_service.pvlib.iotools.get_pvgis_tmy")
    def test_annual_production_reasonable_range(self, mock_pvgis):
        mock_pvgis.return_value = (_make_tmy_dataframe(), None, None, None)

        from app.services.pvlib_service import simulate_pv

        result = simulate_pv(
            lat=14.6928, lon=-17.4467,
            tilt=15.0, azimuth=180.0,
            panel_specs=SAMPLE_PANEL_SPECS,
            num_panels=10,
            num_strings=2,
            panels_per_string=5,
        )

        # 10 panels × 545W = 5.45 kWc → expect ~7000-10000 kWh/year for Dakar
        assert result["annual_kwh"] > 3000
        assert result["annual_kwh"] < 15000
        assert result["peak_power_kwc"] == pytest.approx(5.45, abs=0.01)

    @patch("app.services.pvlib_service.pvlib.iotools.get_pvgis_tmy")
    def test_specific_yield_reasonable(self, mock_pvgis):
        mock_pvgis.return_value = (_make_tmy_dataframe(), None, None, None)

        from app.services.pvlib_service import simulate_pv

        result = simulate_pv(
            lat=14.6928, lon=-17.4467,
            tilt=15.0, azimuth=180.0,
            panel_specs=SAMPLE_PANEL_SPECS,
            num_panels=10,
            num_strings=2,
            panels_per_string=5,
        )

        # Specific yield for Dakar: ~1400-2000 kWh/kWc
        assert result["specific_yield"] > 500
        assert result["specific_yield"] < 2500


class TestFallbackEstimate:
    def test_returns_valid_structure(self):
        from app.services.pvlib_service import fallback_estimate

        result = fallback_estimate(peak_kwc=5.45, losses_pct=14.0)

        assert "monthly_production" in result
        assert len(result["monthly_production"]) == 12
        assert result["annual_kwh"] > 0
        assert result["peak_power_kwc"] == pytest.approx(5.45, abs=0.01)

    def test_annual_production_matches_formula(self):
        from app.services.pvlib_service import fallback_estimate

        result = fallback_estimate(peak_kwc=5.45, losses_pct=14.0)

        expected = 5.45 * 1650 * (1 - 14.0 / 100)
        assert result["annual_kwh"] == pytest.approx(expected, rel=0.01)


class TestOptimizeTiltAzimuth:
    @patch("app.services.pvlib_service.pvlib.iotools.get_pvgis_tmy")
    def test_optimal_values_for_dakar(self, mock_pvgis):
        mock_pvgis.return_value = (_make_tmy_dataframe(), None, None, None)

        from app.services.pvlib_service import optimize_tilt_azimuth

        result = optimize_tilt_azimuth(
            lat=14.6928, lon=-17.4467,
            panel_specs=SAMPLE_PANEL_SPECS,
            num_panels=10,
            num_strings=2,
            panels_per_string=5,
        )

        assert "optimal_tilt" in result
        assert "optimal_azimuth" in result
        assert "annual_kwh" in result
        # For Dakar (14°N), optimal tilt ~10-20°, azimuth ~180° (south)
        assert 5 <= result["optimal_tilt"] <= 30
        assert 150 <= result["optimal_azimuth"] <= 210
