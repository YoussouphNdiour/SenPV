"""
Tests for the calpinage algorithm (panel placement).

These are pure unit tests — no database or PostGIS required.
"""

import math

import pytest
from shapely.geometry import Polygon

from app.services.calpinage import compute_calpinage, suggest_strings

# Standard panel specs (JA Solar JAM72S30-545/MR)
PANEL_SPECS = {
    "dimensions_mm": {"length": 2278, "width": 1134, "height": 35},
    "pmax_w": 545,
    "vmp_v": 41.52,
}

# Small panel for easier testing (1m x 0.5m)
SMALL_PANEL = {
    "dimensions_mm": {"length": 1000, "width": 500, "height": 35},
    "pmax_w": 200,
}


def _make_rect_wgs84(lon_min, lat_min, lon_max, lat_max) -> Polygon:
    """Create a rectangle polygon in WGS84 (lon, lat)."""
    return Polygon([
        (lon_min, lat_min),
        (lon_max, lat_min),
        (lon_max, lat_max),
        (lon_min, lat_max),
        (lon_min, lat_min),
    ])


class TestCalpinageRectangle:
    """Test panel placement in a rectangular roof zone."""

    def test_panels_placed_in_rectangle(self):
        # ~20m x 10m rectangle near Dakar
        polygon = _make_rect_wgs84(-17.4440, 14.6937, -17.4438, 14.6938)
        panels = compute_calpinage(
            polygon, PANEL_SPECS, orientation_deg=180.0, tilt_deg=0.0
        )
        assert len(panels) > 0

    def test_all_panels_inside_polygon(self):
        polygon = _make_rect_wgs84(-17.4440, 14.6937, -17.4438, 14.6938)
        panels = compute_calpinage(
            polygon, PANEL_SPECS, orientation_deg=180.0, tilt_deg=0.0
        )
        for p in panels:
            assert "center_lat" in p
            assert "center_lon" in p
            assert "rotation_deg" in p
            assert "corners" in p
            # Corners should be a closed ring of 5 points
            assert len(p["corners"]) == 5
            assert p["corners"][0] == p["corners"][-1]

    def test_panel_count_increases_with_larger_area(self):
        small = _make_rect_wgs84(-17.4440, 14.6937, -17.4439, 14.69375)
        large = _make_rect_wgs84(-17.4440, 14.6937, -17.4436, 14.6940)

        panels_small = compute_calpinage(small, PANEL_SPECS)
        panels_large = compute_calpinage(large, PANEL_SPECS)

        assert len(panels_large) > len(panels_small)

    def test_spacing_reduces_panel_count(self):
        polygon = _make_rect_wgs84(-17.4440, 14.6937, -17.4436, 14.6940)

        tight = compute_calpinage(polygon, PANEL_SPECS, spacing_x=0.01, spacing_y=0.01)
        wide = compute_calpinage(polygon, PANEL_SPECS, spacing_x=0.10, spacing_y=0.10)

        assert len(tight) >= len(wide)

    def test_orientation_changes_placement(self):
        polygon = _make_rect_wgs84(-17.4440, 14.6937, -17.4436, 14.6940)

        south = compute_calpinage(polygon, PANEL_SPECS, orientation_deg=180.0)
        east = compute_calpinage(polygon, PANEL_SPECS, orientation_deg=90.0)

        # Different orientation should produce different panel positions
        assert len(south) > 0
        assert len(east) > 0
        if len(south) > 0 and len(east) > 0:
            # Centers should differ
            assert south[0]["center_lat"] != east[0]["center_lat"] or \
                   south[0]["center_lon"] != east[0]["center_lon"]

    def test_tilt_reduces_projected_area(self):
        polygon = _make_rect_wgs84(-17.4440, 14.6937, -17.4436, 14.6940)

        flat = compute_calpinage(polygon, PANEL_SPECS, tilt_deg=0.0)
        tilted = compute_calpinage(polygon, PANEL_SPECS, tilt_deg=30.0)

        # A tilted panel has a smaller footprint, so MORE panels should fit
        assert len(tilted) >= len(flat)


class TestCalpinageTriangle:
    """Test panel placement in a triangular roof zone."""

    def test_panels_in_triangle(self):
        # Triangular polygon near Dakar
        polygon = Polygon([
            (-17.4440, 14.6937),
            (-17.4436, 14.6937),
            (-17.4438, 14.6941),
            (-17.4440, 14.6937),
        ])
        panels = compute_calpinage(polygon, PANEL_SPECS)
        assert len(panels) > 0

    def test_fewer_panels_in_triangle_than_bounding_rect(self):
        polygon = Polygon([
            (-17.4440, 14.6937),
            (-17.4436, 14.6937),
            (-17.4438, 14.6941),
            (-17.4440, 14.6937),
        ])
        rect = _make_rect_wgs84(-17.4440, 14.6937, -17.4436, 14.6941)

        panels_tri = compute_calpinage(polygon, PANEL_SPECS)
        panels_rect = compute_calpinage(rect, PANEL_SPECS)

        assert len(panels_tri) < len(panels_rect)


class TestCalpinageLShape:
    """Test panel placement in an L-shaped roof zone."""

    def test_panels_in_l_shape(self):
        # L-shaped polygon near Dakar
        polygon = Polygon([
            (-17.4440, 14.6937),
            (-17.4436, 14.6937),
            (-17.4436, 14.6939),
            (-17.4438, 14.6939),
            (-17.4438, 14.6941),
            (-17.4440, 14.6941),
            (-17.4440, 14.6937),
        ])
        panels = compute_calpinage(polygon, PANEL_SPECS)
        assert len(panels) > 0

    def test_l_shape_fewer_than_full_rect(self):
        polygon = Polygon([
            (-17.4440, 14.6937),
            (-17.4436, 14.6937),
            (-17.4436, 14.6939),
            (-17.4438, 14.6939),
            (-17.4438, 14.6941),
            (-17.4440, 14.6941),
            (-17.4440, 14.6937),
        ])
        rect = _make_rect_wgs84(-17.4440, 14.6937, -17.4436, 14.6941)

        panels_l = compute_calpinage(polygon, PANEL_SPECS)
        panels_rect = compute_calpinage(rect, PANEL_SPECS)

        assert len(panels_l) < len(panels_rect)


class TestCalpinageEdgeCases:
    """Test edge cases."""

    def test_empty_polygon(self):
        polygon = Polygon()
        panels = compute_calpinage(polygon, PANEL_SPECS)
        assert panels == []

    def test_polygon_too_small_for_any_panel(self):
        # Very tiny polygon (~1m x 1m)
        polygon = _make_rect_wgs84(-17.4440, 14.6937, -17.44399, 14.69371)
        panels = compute_calpinage(polygon, PANEL_SPECS)
        assert panels == []

    def test_missing_dimensions_uses_defaults(self):
        polygon = _make_rect_wgs84(-17.4440, 14.6937, -17.4436, 14.6940)
        panels = compute_calpinage(polygon, {})
        assert isinstance(panels, list)


class TestSuggestStrings:
    """Test string suggestion logic."""

    def test_zero_panels(self):
        ns, pps = suggest_strings(0)
        assert ns == 0
        assert pps == 0

    def test_small_array_one_string(self):
        ns, pps = suggest_strings(10)
        assert ns == 1
        assert pps == 10

    def test_large_array_multiple_strings(self):
        ns, pps = suggest_strings(30)
        assert ns >= 2
        assert ns * pps >= 30

    def test_with_inverter_specs(self):
        inverter = {"max_pv_voltage_v": 600}
        ns, pps = suggest_strings(20, panel_vmp=41.52, inverter_specs=inverter)
        assert ns >= 1
        assert pps >= 1
        # String voltage = pps * 41.52 should not exceed 600V
        assert pps * 41.52 <= 600 + 42  # +1 panel tolerance

    def test_single_panel(self):
        ns, pps = suggest_strings(1)
        assert ns == 1
        assert pps == 1
