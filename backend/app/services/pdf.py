"""PDF generation service using Jinja2 + WeasyPrint."""

import base64
import io
import math
import os
from datetime import datetime, timezone
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from app.config import settings

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"

_jinja_env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)), autoescape=True)


def _format_fcfa(amount) -> str:
    """Format integer as FCFA with space thousands separator."""
    return "{:,.0f}".format(int(amount)).replace(",", " ")


def _load_logo_base64(logo_path: str | None) -> str | None:
    """Load an installer logo from disk and return base64-encoded data."""
    if not logo_path:
        return None
    full_path = Path(settings.upload_dir) / logo_path
    if not full_path.is_file():
        return None
    return base64.b64encode(full_path.read_bytes()).decode("utf-8")


def generate_quote_pdf(quote, project, installer) -> bytes:
    """Render a quote as a PDF and return the bytes."""
    from weasyprint import HTML

    profile = installer.installer_profile if installer else None

    line_items = quote.line_items if isinstance(quote.line_items, list) else []

    subtotal = quote.subtotal_fcfa
    margin_pct = float(quote.margin_pct) if quote.margin_pct else 0
    margin_amount = math.floor(subtotal * margin_pct / 100)
    total_ht = subtotal + margin_amount
    tax_rate_pct = float(quote.tax_rate_pct)

    client = project.client

    logo_base64 = _load_logo_base64(profile.logo_path if profile else None)

    template = _jinja_env.get_template("quote.html")
    html_str = template.render(
        # Installer
        logo_base64=logo_base64,
        installer_company=profile.company_name if profile else (installer.name if installer else ""),
        installer_address=profile.address if profile else None,
        installer_phone=profile.phone if profile else None,
        # Quote meta
        reference=quote.reference or str(quote.id)[:8],
        date=quote.created_at.strftime("%d/%m/%Y"),
        validity_days=quote.validity_days,
        # Client
        client_name=client.name if client else None,
        client_address=client.address if client else None,
        client_phone=client.phone if client else None,
        client_email=client.email if client else None,
        # Project
        project_name=project.name,
        project_address=project.address,
        # Line items
        line_items=line_items,
        # Totals
        subtotal=_format_fcfa(subtotal),
        margin_pct=margin_pct if margin_pct > 0 else None,
        margin_amount=_format_fcfa(margin_amount),
        total_ht=_format_fcfa(total_ht),
        tax_rate_pct=tax_rate_pct,
        tax_amount=_format_fcfa(quote.tax_amount_fcfa),
        total_ttc=_format_fcfa(quote.total_fcfa),
        # Payment
        payment_terms=quote.payment_terms,
    )

    pdf_bytes = HTML(string=html_str).write_pdf()
    return pdf_bytes


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

MONTH_NAMES_FR = [
    "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
    "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
]


def _generate_chart_images(simulation_data: dict, financial_data: dict | None) -> dict:
    """Generate SVG chart images for embedding in the PDF report."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    charts: dict[str, str] = {}

    # --- Monthly production bar chart ---
    monthly = simulation_data.get("monthly_production", [])
    if monthly:
        fig, ax = plt.subplots(figsize=(8, 3))
        months = [MONTH_NAMES_FR[m["month"] - 1] if isinstance(m["month"], int) else m["month"] for m in monthly]
        kwh = [m["kwh"] for m in monthly]
        ax.bar(months, kwh, color="#f59e0b")
        ax.set_xlabel("Mois")
        ax.set_ylabel("kWh")
        ax.set_title("Production mensuelle")
        ax.grid(axis="y", alpha=0.3)
        buf = io.BytesIO()
        fig.savefig(buf, format="svg", bbox_inches="tight")
        charts["production_monthly"] = buf.getvalue().decode()
        plt.close(fig)

    # --- Cumulative cashflow chart ---
    if financial_data:
        cashflow = financial_data.get("cashflow_25y", [])
        if cashflow:
            fig, ax = plt.subplots(figsize=(8, 3))
            years = [c["year"] for c in cashflow]
            cumulative = [c["cumulative_fcfa"] for c in cashflow]
            ax.plot(years, cumulative, color="#10b981", linewidth=2)
            ax.axhline(y=0, color="gray", linestyle="--", alpha=0.5)
            ax.fill_between(years, cumulative, alpha=0.1, color="#10b981")
            ax.set_xlabel("Année")
            ax.set_ylabel("FCFA")
            ax.set_title("Flux de trésorerie cumulé")
            ax.grid(axis="y", alpha=0.3)
            buf = io.BytesIO()
            fig.savefig(buf, format="svg", bbox_inches="tight")
            charts["cashflow"] = buf.getvalue().decode()
            plt.close(fig)

    return charts


def generate_full_report(
    project,
    simulation_data: dict | None,
    financial_data: dict | None,
    schematic_svg: str | None,
    quote=None,
    installer=None,
) -> bytes:
    """Generate the full PDF report and return bytes."""
    from weasyprint import HTML

    profile = installer.installer_profile if installer else None
    logo_base64 = _load_logo_base64(profile.logo_path if profile else None)
    client = project.client if hasattr(project, "client") else None

    charts = {}
    if simulation_data:
        charts = _generate_chart_images(simulation_data, financial_data)

    # Build quote data for template
    quote_data = None
    if quote:
        line_items = quote.line_items if isinstance(quote.line_items, list) else []
        subtotal = quote.subtotal_fcfa
        margin_pct = float(quote.margin_pct) if quote.margin_pct else 0
        margin_amount = math.floor(subtotal * margin_pct / 100)
        total_ht = subtotal + margin_amount
        quote_data = {
            "reference": quote.reference or str(quote.id)[:8],
            "date": quote.created_at.strftime("%d/%m/%Y"),
            "validity_days": quote.validity_days,
            "line_items": line_items,
            "subtotal": _format_fcfa(subtotal),
            "margin_pct": margin_pct if margin_pct > 0 else None,
            "margin_amount": _format_fcfa(margin_amount),
            "total_ht": _format_fcfa(total_ht),
            "tax_rate_pct": float(quote.tax_rate_pct),
            "tax_amount": _format_fcfa(quote.tax_amount_fcfa),
            "total_ttc": _format_fcfa(quote.total_fcfa),
            "payment_terms": quote.payment_terms,
            "status": quote.status,
        }

    template = _jinja_env.get_template("report.html")
    html_str = template.render(
        # Project
        project_name=project.name,
        project_address=project.address,
        project_lat=project.lat,
        project_lon=project.lon,
        # Client
        client_name=client.name if client else None,
        client_address=client.address if client else None,
        client_phone=client.phone if client else None,
        client_email=client.email if client else None,
        # Installer
        logo_base64=logo_base64,
        installer_company=profile.company_name if profile else None,
        installer_address=profile.address if profile else None,
        installer_phone=profile.phone if profile else None,
        # Simulation
        simulation=simulation_data,
        monthly_names=MONTH_NAMES_FR,
        # Financial
        financial=financial_data,
        # Charts
        charts=charts,
        # Schematic
        schematic_svg=schematic_svg,
        # Quote
        quote=quote_data,
        # Meta
        generated_at=datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC"),
        format_fcfa=_format_fcfa,
    )

    pdf_bytes = HTML(string=html_str).write_pdf()
    return pdf_bytes


def generate_schematic_pdf(project, schematic_svg: str) -> bytes:
    """Generate a PDF with just the schematic diagram."""
    from weasyprint import HTML

    html_str = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  @page {{ size: A4 landscape; margin: 1.5cm; }}
  body {{ font-family: sans-serif; margin: 0; padding: 0; }}
  .header {{ text-align: center; margin-bottom: 1cm; }}
  .header h1 {{ font-size: 16pt; color: #1e3a5f; margin: 0; }}
  .header p {{ font-size: 10pt; color: #666; margin: 4px 0 0; }}
  .schematic {{ text-align: center; }}
  .schematic svg {{ max-width: 100%; max-height: 80vh; }}
  .footer {{ text-align: center; font-size: 8pt; color: #999; margin-top: 1cm; }}
</style>
</head>
<body>
  <div class="header">
    <h1>SenPV &mdash; Sch&eacute;ma unifilaire</h1>
    <p>{project.name}</p>
  </div>
  <div class="schematic">{schematic_svg}</div>
  <div class="footer">
    G&eacute;n&eacute;r&eacute; par SenPV &mdash; {datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")}
  </div>
</body>
</html>"""

    return HTML(string=html_str).write_pdf()


def save_report_pdf(project_id: str, pdf_bytes: bytes, report_type: str) -> str:
    """Save PDF bytes to disk and return the relative file path."""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"{report_type}_{timestamp}.pdf"
    rel_dir = f"reports/{project_id}"
    full_dir = Path(settings.upload_dir) / rel_dir
    full_dir.mkdir(parents=True, exist_ok=True)
    filepath = full_dir / filename
    filepath.write_bytes(pdf_bytes)
    return f"{rel_dir}/{filename}"
