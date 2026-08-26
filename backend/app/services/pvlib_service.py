import logging

import pvlib
from pvlib.modelchain import ModelChain
from pvlib.pvsystem import PVSystem
from pvlib.location import Location
from pvlib.temperature import TEMPERATURE_MODEL_PARAMETERS

logger = logging.getLogger(__name__)

# Dakar average irradiation: ~2000 kWh/m²/year
DAKAR_SPECIFIC_YIELD = 1650  # kWh/kWc
# Monthly distribution weights for Dakar (approximate solar resource profile)
MONTHLY_WEIGHTS = [7.5, 7.8, 8.8, 8.8, 8.8, 8.2, 7.5, 7.5, 7.8, 8.8, 8.8, 9.7]


def simulate_pv(
    lat: float,
    lon: float,
    tilt: float,
    azimuth: float,
    panel_specs: dict,
    num_panels: int,
    num_strings: int,
    panels_per_string: int,
    inverter_specs: dict | None = None,
    losses_pct: float = 14.0,
    albedo: float = 0.2,
) -> dict:
    """
    Simulate annual PV production with pvlib.

    Returns dict with monthly_production, annual_kwh, specific_yield,
    peak_power_kwc, and performance_ratio.
    """
    peak_kwc = panel_specs["pmax_w"] * num_panels / 1000

    try:
        return _simulate_with_pvlib(
            lat, lon, tilt, azimuth, panel_specs, num_panels,
            num_strings, panels_per_string, inverter_specs, peak_kwc,
        )
    except Exception as exc:
        logger.warning("pvlib simulation failed, using fallback: %s", exc)
        return fallback_estimate(peak_kwc, losses_pct)


def _simulate_with_pvlib(
    lat: float,
    lon: float,
    tilt: float,
    azimuth: float,
    panel_specs: dict,
    num_panels: int,
    num_strings: int,
    panels_per_string: int,
    inverter_specs: dict | None,
    peak_kwc: float,
) -> dict:
    """Run pvlib ModelChain simulation (fetches TMY data from PVGIS)."""
    location = Location(lat, lon, tz="Africa/Dakar", altitude=30)
    tmy_data, _, _, _ = pvlib.iotools.get_pvgis_tmy(lat, lon, map_variables=True)
    return _simulate_with_tmy(
        tmy_data, location, tilt, azimuth, panel_specs, num_panels,
        num_strings, panels_per_string, inverter_specs, peak_kwc,
    )


def _simulate_with_tmy(
    tmy_data,
    location: "Location",
    tilt: float,
    azimuth: float,
    panel_specs: dict,
    num_panels: int,
    num_strings: int,
    panels_per_string: int,
    inverter_specs: dict | None,
    peak_kwc: float,
) -> dict:
    """Run pvlib ModelChain simulation using pre-fetched TMY data."""
    module_parameters = {
        "pdc0": panel_specs["pmax_w"],
        "v_mp": panel_specs["vmp_v"],
        "i_mp": panel_specs["imp_a"],
        "v_oc": panel_specs["voc_v"],
        "i_sc": panel_specs["isc_a"],
        "alpha_sc": panel_specs["temp_coeff_isc_pct_per_c"] / 100 * panel_specs["isc_a"],
        "beta_oc": panel_specs["temp_coeff_voc_pct_per_c"] / 100 * panel_specs["voc_v"],
        # gamma_pdc must be a fraction per °C (not percent), e.g. -0.0035 for -0.35%/°C
        "gamma_pdc": panel_specs["temp_coeff_pmax_pct_per_c"] / 100,
        "cells_in_series": panel_specs.get("cells", 72),
    }

    if inverter_specs:
        inv_parameters = {
            "pdc0": inverter_specs["max_pv_power_kw"] * 1000,
            "eta_inv_nom": inverter_specs["euro_efficiency_pct"] / 100,
        }
    else:
        inv_parameters = {
            "pdc0": panel_specs["pmax_w"] * num_panels * 1.2,
            "eta_inv_nom": 0.97,
        }

    temp_params = TEMPERATURE_MODEL_PARAMETERS["sapm"]["open_rack_glass_glass"]

    system = PVSystem(
        surface_tilt=tilt,
        surface_azimuth=azimuth,
        module_parameters=module_parameters,
        inverter_parameters=inv_parameters,
        strings_per_inverter=num_strings,
        modules_per_string=panels_per_string,
        temperature_model_parameters=temp_params,
    )

    mc = ModelChain(system, location, aoi_model="physical", spectral_model="no_loss")
    mc.run_model(tmy_data)

    ac_power = mc.results.ac
    monthly = ac_power.resample("ME").sum() / 1000  # Wh → kWh
    annual_kwh = float(monthly.sum())
    specific_yield = annual_kwh / peak_kwc if peak_kwc > 0 else 0

    return {
        "monthly_production": [
            {"month": i + 1, "kwh": round(float(monthly.iloc[i]), 1)}
            for i in range(min(12, len(monthly)))
        ],
        "annual_kwh": round(annual_kwh, 1),
        "specific_yield": round(specific_yield, 1),
        "peak_power_kwc": round(peak_kwc, 3),
        "performance_ratio": round(annual_kwh / (peak_kwc * 1800) if peak_kwc > 0 else 0, 3),
    }


def fallback_estimate(peak_kwc: float, losses_pct: float = 14.0) -> dict:
    """
    Simplified estimate based on Dakar's average solar resource.
    Used when PVGIS TMY data is unavailable.
    """
    annual_kwh = peak_kwc * DAKAR_SPECIFIC_YIELD * (1 - losses_pct / 100)
    total_weight = sum(MONTHLY_WEIGHTS)

    return {
        "monthly_production": [
            {"month": i + 1, "kwh": round(annual_kwh * w / total_weight, 1)}
            for i, w in enumerate(MONTHLY_WEIGHTS)
        ],
        "annual_kwh": round(annual_kwh, 1),
        "specific_yield": round(DAKAR_SPECIFIC_YIELD * (1 - losses_pct / 100), 1),
        "peak_power_kwc": round(peak_kwc, 3),
        "performance_ratio": round(
            annual_kwh / (peak_kwc * 1800) if peak_kwc > 0 else 0, 3
        ),
    }


def optimize_tilt_azimuth(
    lat: float,
    lon: float,
    panel_specs: dict,
    num_panels: int,
    num_strings: int,
    panels_per_string: int,
    inverter_specs: dict | None = None,
) -> dict:
    """
    Find the optimal tilt and azimuth for a given location by sweeping
    through combinations and selecting the one that maximizes annual kWh.
    """
    best_kwh = 0
    best_tilt = lat  # rule of thumb: tilt ≈ latitude
    best_azimuth = 180  # south for northern hemisphere

    # Fetch TMY data once — reused across all 70 combinations
    try:
        tmy_data, _, _, _ = pvlib.iotools.get_pvgis_tmy(lat, lon, map_variables=True)
    except Exception as exc:
        logger.warning("TMY fetch failed in optimizer, returning rule-of-thumb defaults: %s", exc)
        return {"optimal_tilt": best_tilt, "optimal_azimuth": best_azimuth, "annual_kwh": 0.0}

    location = Location(lat, lon, tz="Africa/Dakar", altitude=30)
    peak_kwc = panel_specs["pmax_w"] * num_panels / 1000

    # Sweep tilt 0-45° by 5°, azimuth 135-225° by 15°
    for tilt in range(0, 50, 5):
        for azimuth in range(135, 226, 15):
            try:
                result = _simulate_with_tmy(
                    tmy_data, location, float(tilt), float(azimuth),
                    panel_specs, num_panels, num_strings, panels_per_string,
                    inverter_specs, peak_kwc,
                )
                if result["annual_kwh"] > best_kwh:
                    best_kwh = result["annual_kwh"]
                    best_tilt = tilt
                    best_azimuth = azimuth
            except Exception:
                continue

    return {
        "optimal_tilt": best_tilt,
        "optimal_azimuth": best_azimuth,
        "annual_kwh": round(best_kwh, 1),
    }
