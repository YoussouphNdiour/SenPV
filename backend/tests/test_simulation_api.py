"""Smoke test for simulation API router registration."""
from app.main import app


def test_simulation_routes_registered():
    """Verify the simulation routes exist in the app."""
    routes = [route.path for route in app.routes]
    assert "/projects/{project_id}/simulate" in routes
    assert "/projects/{project_id}/simulations" in routes
    assert "/projects/{project_id}/optimize" in routes
