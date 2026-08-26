from celery import Celery

from app.config import settings
from app.services.pvlib_service import simulate_pv, optimize_tilt_azimuth

celery_app = Celery("senpv", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"


@celery_app.task(name="simulate_pv_task")
def run_simulation_task(
    lat: float, lon: float, tilt: float, azimuth: float,
    panel_specs: dict, num_panels: int, num_strings: int,
    panels_per_string: int, inverter_specs: dict | None = None,
    losses_pct: float = 14.0, albedo: float = 0.2,
) -> dict:
    return simulate_pv(
        lat, lon, tilt, azimuth, panel_specs, num_panels,
        num_strings, panels_per_string, inverter_specs, losses_pct, albedo,
    )


@celery_app.task(name="optimize_pv_task")
def run_optimize_task(
    lat: float, lon: float,
    panel_specs: dict, num_panels: int, num_strings: int,
    panels_per_string: int, inverter_specs: dict | None = None,
) -> dict:
    return optimize_tilt_azimuth(
        lat, lon, panel_specs, num_panels, num_strings,
        panels_per_string, inverter_specs,
    )
