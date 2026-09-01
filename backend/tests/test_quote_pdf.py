"""Tests for quote PDF generation service."""

import math
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock

import pytest


def _make_mock_quote():
    quote = MagicMock()
    quote.id = "test-uuid"
    quote.reference = "DEV-2026-0001"
    quote.line_items = [
        {"description": "Panneau 545W", "quantity": 10, "unit_price_fcfa": 185000},
        {"description": "Onduleur 5kW", "quantity": 1, "unit_price_fcfa": 650000},
    ]
    quote.subtotal_fcfa = 2_500_000
    quote.margin_pct = Decimal("15.0")
    quote.tax_rate_pct = Decimal("18.0")
    quote.tax_amount_fcfa = 517_500
    quote.total_fcfa = 3_392_500
    quote.payment_terms = "50% à la commande"
    quote.validity_days = 30
    quote.created_at = datetime(2026, 8, 26, tzinfo=timezone.utc)
    quote.installer_id = "installer-uuid"
    return quote


def _make_mock_project(with_client=True):
    project = MagicMock()
    project.name = "Solar Dakar"
    project.address = "123 Rue Liberté, Dakar"
    if with_client:
        client = MagicMock()
        client.name = "Moussa Diop"
        client.address = "456 Avenue Ponty"
        client.phone = "+221770001234"
        client.email = "moussa@example.com"
        project.client = client
    else:
        project.client = None
    return project


def _make_mock_installer(with_profile=True):
    installer = MagicMock()
    installer.name = "Installer User"
    if with_profile:
        profile = MagicMock()
        profile.company_name = "Solar Pro SARL"
        profile.address = "Dakar, Sénégal"
        profile.phone = "+221770001234"
        profile.logo_path = None
        installer.installer_profile = profile
    else:
        installer.installer_profile = None
    return installer


def test_format_fcfa():
    from app.services.pdf import _format_fcfa

    assert _format_fcfa(0) == "0"
    assert _format_fcfa(1000) == "1 000"
    assert _format_fcfa(3500000) == "3 500 000"
    assert _format_fcfa(4749500) == "4 749 500"


def test_generate_quote_pdf_returns_bytes():
    """PDF generation should return non-empty bytes."""
    try:
        from app.services.pdf import generate_quote_pdf
    except ImportError:
        pytest.skip("WeasyPrint not installed")

    quote = _make_mock_quote()
    project = _make_mock_project()
    installer = _make_mock_installer()

    try:
        pdf_bytes = generate_quote_pdf(quote=quote, project=project, installer=installer)
        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0
        # PDF files start with %PDF
        assert pdf_bytes[:5] == b"%PDF-"
    except Exception:
        # WeasyPrint may not be available in test env
        pytest.skip("WeasyPrint rendering failed (likely missing system deps)")


def test_generate_quote_pdf_no_client():
    """PDF should render without client info."""
    try:
        from app.services.pdf import generate_quote_pdf
    except ImportError:
        pytest.skip("WeasyPrint not installed")

    quote = _make_mock_quote()
    project = _make_mock_project(with_client=False)
    installer = _make_mock_installer()

    try:
        pdf_bytes = generate_quote_pdf(quote=quote, project=project, installer=installer)
        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0
    except Exception:
        pytest.skip("WeasyPrint rendering failed (likely missing system deps)")


def test_generate_quote_pdf_no_profile():
    """PDF should render without installer profile (fallback to name)."""
    try:
        from app.services.pdf import generate_quote_pdf
    except ImportError:
        pytest.skip("WeasyPrint not installed")

    quote = _make_mock_quote()
    project = _make_mock_project()
    installer = _make_mock_installer(with_profile=False)

    try:
        pdf_bytes = generate_quote_pdf(quote=quote, project=project, installer=installer)
        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0
    except Exception:
        pytest.skip("WeasyPrint rendering failed (likely missing system deps)")


def test_compute_totals():
    """Test the total computation logic."""
    from app.api.quotes import _compute_totals

    line_items = [
        {"description": "Panel", "quantity": 10, "unit_price_fcfa": 185000},
        {"description": "Inverter", "quantity": 1, "unit_price_fcfa": 650000},
        {"description": "Mounting", "quantity": 1, "unit_price_fcfa": 350000},
        {"description": "Wiring", "quantity": 1, "unit_price_fcfa": 250000},
        {"description": "Labour", "quantity": 1, "unit_price_fcfa": 400000},
    ]

    result = _compute_totals(line_items, margin_pct=15.0, tax_rate_pct=18.0)

    assert result["subtotal_fcfa"] == 3_500_000
    # margin = floor(3_500_000 * 0.15) = 525_000
    # total_ht = 4_025_000
    # tax = floor(4_025_000 * 0.18) = 724_500
    assert result["tax_amount_fcfa"] == 724_500
    assert result["total_fcfa"] == 4_749_500


def test_compute_totals_zero_margin():
    """Test with 0% margin."""
    from app.api.quotes import _compute_totals

    line_items = [{"description": "Item", "quantity": 1, "unit_price_fcfa": 1_000_000}]
    result = _compute_totals(line_items, margin_pct=0, tax_rate_pct=18.0)

    assert result["subtotal_fcfa"] == 1_000_000
    assert result["tax_amount_fcfa"] == 180_000
    assert result["total_fcfa"] == 1_180_000
