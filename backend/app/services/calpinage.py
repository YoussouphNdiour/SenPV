"""
Algorithme de calpinage — placement automatique de panneaux PV dans un polygone de toit.

Projette le polygone en UTM zone 28N (EPSG:32628) pour travailler en metres,
genere une grille de rectangles alignee sur l'orientation du toit,
filtre les panneaux entierement a l'interieur du polygone,
puis re-projette les centres en WGS84.
"""

import logging
import math

import numpy as np

logger = logging.getLogger("senpv.calpinage")
from pyproj import Transformer
from shapely.affinity import rotate, translate
from shapely.geometry import Polygon, box
from shapely.ops import transform as shapely_transform

# Transformers WGS84 <-> UTM zone 28N (Senegal)
_to_utm = Transformer.from_crs("EPSG:4326", "EPSG:32628", always_xy=True)
_to_wgs = Transformer.from_crs("EPSG:32628", "EPSG:4326", always_xy=True)


def _project(geom: Polygon, transformer: Transformer) -> Polygon:
    return shapely_transform(transformer.transform, geom)


def _panel_corners_wgs84(
    center_x_utm: float,
    center_y_utm: float,
    half_w: float,
    half_h: float,
    rotation_deg: float,
) -> list[list[float]]:
    """Return the 4 corners of a panel rectangle in WGS84 [lon, lat]."""
    rect = box(
        center_x_utm - half_w,
        center_y_utm - half_h,
        center_x_utm + half_w,
        center_y_utm + half_h,
    )
    if rotation_deg != 0:
        rect = rotate(rect, rotation_deg, origin=(center_x_utm, center_y_utm))

    coords_utm = list(rect.exterior.coords)
    corners = []
    for x, y in coords_utm[:4]:
        lon, lat = _to_wgs.transform(x, y)
        corners.append([lon, lat])
    # Close the ring
    corners.append(corners[0])
    return corners


def compute_calpinage(
    polygon_wgs84: Polygon,
    panel_specs: dict,
    orientation_deg: float = 180.0,
    tilt_deg: float = 0.0,
    spacing_x: float = 0.02,
    spacing_y: float = 0.02,
) -> list[dict]:
    """
    Place les panneaux dans le polygone de toit.

    Args:
        polygon_wgs84: Shapely Polygon en WGS84 (lon, lat)
        panel_specs: dict avec dimensions_mm {length, width}
        orientation_deg: azimuth du toit (0=Nord, 180=Sud)
        tilt_deg: inclinaison du toit en degres
        spacing_x: espacement horizontal entre panneaux en metres
        spacing_y: espacement vertical entre panneaux en metres

    Returns:
        list[dict]: positions des panneaux [
            {center_lat, center_lon, rotation_deg, corners}, ...
        ]
    """
    logger.info("compute_calpinage called — specs: %s, orientation: %s, tilt: %s", panel_specs, orientation_deg, tilt_deg)
    logger.info("polygon WGS84 bounds: %s, area: %s", polygon_wgs84.bounds, polygon_wgs84.area)

    dims = panel_specs.get("dimensions_mm", {})
    panel_length_m = dims.get("length", 2000) / 1000.0  # long side
    panel_width_m = dims.get("width", 1000) / 1000.0  # short side

    logger.info("panel dimensions: %.3fm x %.3fm", panel_length_m, panel_width_m)

    # On a tilted roof, the projected height (vertical footprint) is reduced
    tilt_rad = math.radians(tilt_deg)
    projected_width = panel_width_m * math.cos(tilt_rad)

    # Cell dimensions including spacing
    cell_w = panel_length_m + spacing_x
    cell_h = projected_width + spacing_y

    logger.info("cell: %.3f x %.3f, spacing: %.3f x %.3f", cell_w, cell_h, spacing_x, spacing_y)

    if cell_w <= 0 or cell_h <= 0:
        logger.warning("cell dimensions <= 0, returning empty")
        return []

    # 1. Project polygon to UTM
    poly_utm = _project(polygon_wgs84, _to_utm)

    logger.info("polygon UTM bounds: %s, area: %.2f m²", poly_utm.bounds, poly_utm.area)

    if poly_utm.is_empty or not poly_utm.is_valid:
        logger.warning("polygon UTM is empty or invalid")
        return []

    # 2. Compute bounding box center for rotation origin
    minx, miny, maxx, maxy = poly_utm.bounds
    cx = (minx + maxx) / 2
    cy = (miny + maxy) / 2

    bbox_w = maxx - minx
    bbox_h = maxy - miny
    logger.info("UTM bbox: %.2fm x %.2fm, center: (%.2f, %.2f)", bbox_w, bbox_h, cx, cy)

    # 3. Rotation angle: we rotate the polygon OPPOSITE to the orientation
    # so we can place a regular grid, then rotate results back.
    # Orientation 0 = North, 180 = South.
    # In UTM, Y points north. Shapely rotate is counter-clockwise.
    # We want panels aligned with the roof orientation.
    rot_angle = -orientation_deg  # degrees to rotate polygon for grid alignment

    # Rotate polygon to align with grid axes
    poly_rotated = rotate(poly_utm, rot_angle, origin=(cx, cy))
    rminx, rminy, rmaxx, rmaxy = poly_rotated.bounds

    # 4. Generate grid of panel centers in the rotated frame
    half_w = panel_length_m / 2
    half_h = projected_width / 2

    # Start positions: offset by half-panel from the bounding box edge
    start_x = rminx + half_w
    start_y = rminy + half_h

    nx = int((rmaxx - start_x - half_w) / cell_w) + 1
    ny = int((rmaxy - start_y - half_h) / cell_h) + 1

    logger.info("grid: nx=%d, ny=%d (rotated bbox: %.2f x %.2f)", nx, ny, rmaxx - rminx, rmaxy - rminy)

    if nx <= 0 or ny <= 0:
        logger.warning("grid dimensions <= 0 (nx=%d, ny=%d), returning empty", nx, ny)
        return []

    # Generate candidate centers
    xs = start_x + np.arange(nx) * cell_w
    ys = start_y + np.arange(ny) * cell_h

    panels = []
    candidates = 0
    for x in xs:
        for y in ys:
            candidates += 1
            # Create panel rectangle in rotated frame
            panel_rect = box(x - half_w, y - half_h, x + half_w, y + half_h)

            # Check if panel is ENTIRELY inside the rotated polygon
            if poly_rotated.contains(panel_rect):
                # Rotate center back to UTM
                # Reverse rotation: rotate point (x, y) around (cx, cy) by +orientation_deg
                angle_rad = math.radians(orientation_deg)
                dx = x - cx
                dy = y - cy
                utm_x = cx + dx * math.cos(angle_rad) - dy * math.sin(angle_rad)
                utm_y = cy + dx * math.sin(angle_rad) + dy * math.cos(angle_rad)

                # Convert center to WGS84
                center_lon, center_lat = _to_wgs.transform(utm_x, utm_y)

                # Compute corner coordinates in WGS84
                corners = _panel_corners_wgs84(
                    utm_x, utm_y, half_w, half_h, orientation_deg
                )

                panels.append(
                    {
                        "center_lat": center_lat,
                        "center_lon": center_lon,
                        "rotation_deg": orientation_deg,
                        "corners": corners,
                    }
                )

    logger.info("calpinage result: %d panels placed out of %d candidates", len(panels), candidates)
    return panels


def suggest_strings(
    num_panels: int,
    panel_vmp: float | None = None,
    inverter_specs: dict | None = None,
) -> tuple[int, int]:
    """
    Suggest number of strings and panels per string.

    If inverter specs are available, calculates based on MPPT voltage range.
    Otherwise, defaults to reasonable values.

    Returns:
        (num_strings, panels_per_string)
    """
    if num_panels == 0:
        return 0, 0

    if inverter_specs and panel_vmp:
        mppt_max_v = inverter_specs.get("max_pv_voltage_v", 600)
        panels_per_string = max(1, int(mppt_max_v / panel_vmp))
        # Don't exceed actual panel count
        panels_per_string = min(panels_per_string, num_panels)
        num_strings = max(1, math.ceil(num_panels / panels_per_string))
        # Adjust panels_per_string to be even
        panels_per_string = math.ceil(num_panels / num_strings)
    else:
        # Default: strings of ~10-15 panels
        if num_panels <= 15:
            num_strings = 1
            panels_per_string = num_panels
        else:
            panels_per_string = min(15, num_panels)
            num_strings = math.ceil(num_panels / panels_per_string)
            panels_per_string = math.ceil(num_panels / num_strings)

    return num_strings, panels_per_string
