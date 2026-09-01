"""Celery task for background PDF report generation."""

from app.tasks.simulation_task import celery_app


@celery_app.task(name="generate_report_task", bind=True)
def generate_report_task(self, project_id: str, report_type: str = "full_report") -> dict:
    """
    Generate a PDF report in background.

    Note: For now, report generation is done synchronously in the API endpoint
    since WeasyPrint is fast enough for single reports. This task is available
    for future use when batch generation or very large reports are needed.
    """
    from app.services.pdf import save_report_pdf

    # This task would need a sync DB session to load data.
    # For now, return a placeholder — the API handles generation directly.
    return {
        "project_id": project_id,
        "report_type": report_type,
        "status": "completed",
    }
