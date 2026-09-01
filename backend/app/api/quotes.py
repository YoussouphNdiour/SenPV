"""Quote CRUD and PDF generation endpoints."""

import math
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import CurrentUser, RequireInstaller
from app.models.project import Project
from app.models.quote import Quote
from app.models.user import User
from app.schemas.quote import (
    QuoteCreateInput,
    QuoteRead,
    QuoteStatusUpdate,
    QuoteUpdateInput,
)

router = APIRouter(prefix="/projects/{project_id}", tags=["quotes"])


def _compute_totals(
    line_items: list[dict],
    margin_pct: float,
    tax_rate_pct: float,
) -> dict:
    """Calculate subtotal, margin, tax, and total from line items."""
    subtotal = sum(item["quantity"] * item["unit_price_fcfa"] for item in line_items)
    margin_amount = math.floor(subtotal * float(margin_pct) / 100)
    total_ht = subtotal + margin_amount
    tax_amount = math.floor(total_ht * float(tax_rate_pct) / 100)
    total_ttc = total_ht + tax_amount
    return {
        "subtotal_fcfa": subtotal,
        "tax_amount_fcfa": tax_amount,
        "total_fcfa": total_ttc,
    }


async def _generate_reference(db: AsyncSession, installer_id: uuid.UUID) -> str:
    """Generate DEV-YYYY-NNNN reference, auto-incremented per installer per year."""
    year = datetime.now(timezone.utc).year
    prefix = f"DEV-{year}-"

    result = await db.execute(
        select(func.count())
        .select_from(Quote)
        .where(
            Quote.installer_id == installer_id,
            Quote.reference.like(f"{prefix}%"),
        )
    )
    count = result.scalar_one()
    return f"{prefix}{count + 1:04d}"


async def _get_project_or_404(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    user_role: str,
    db: AsyncSession,
) -> Project:
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.client))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != user_id and user_role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    return project


@router.post("/quotes", response_model=QuoteRead, status_code=status.HTTP_201_CREATED)
async def create_quote(
    project_id: uuid.UUID,
    body: QuoteCreateInput,
    user: Annotated[User, RequireInstaller],
    db: AsyncSession = Depends(get_db),
):
    await _get_project_or_404(project_id, user.id, user.role, db)

    line_items_dicts = [item.model_dump() for item in body.line_items]
    totals = _compute_totals(line_items_dicts, float(body.margin_pct), float(body.tax_rate_pct))
    reference = await _generate_reference(db, user.id)

    quote = Quote(
        project_id=project_id,
        installer_id=user.id,
        reference=reference,
        line_items=line_items_dicts,
        margin_pct=body.margin_pct,
        tax_rate_pct=body.tax_rate_pct,
        payment_terms=body.payment_terms,
        validity_days=body.validity_days,
        **totals,
    )
    db.add(quote)
    await db.commit()
    await db.refresh(quote)
    return quote


@router.get("/quotes", response_model=list[QuoteRead])
async def list_quotes(
    project_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_or_404(project_id, user.id, user.role, db)

    result = await db.execute(
        select(Quote)
        .where(Quote.project_id == project_id)
        .order_by(Quote.created_at.desc())
    )
    return result.scalars().all()


@router.get("/quotes/{quote_id}", response_model=QuoteRead)
async def get_quote(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_or_404(project_id, user.id, user.role, db)

    result = await db.execute(
        select(Quote).where(Quote.id == quote_id, Quote.project_id == project_id)
    )
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return quote


@router.put("/quotes/{quote_id}", response_model=QuoteRead)
async def update_quote(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    body: QuoteUpdateInput,
    user: Annotated[User, RequireInstaller],
    db: AsyncSession = Depends(get_db),
):
    await _get_project_or_404(project_id, user.id, user.role, db)

    result = await db.execute(
        select(Quote).where(Quote.id == quote_id, Quote.project_id == project_id)
    )
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    update_data = body.model_dump(exclude_unset=True)

    # Apply simple fields
    for key in ("margin_pct", "tax_rate_pct", "payment_terms", "validity_days"):
        if key in update_data:
            setattr(quote, key, update_data[key])

    # If line_items changed, update and serialize
    if "line_items" in update_data:
        quote.line_items = [item.model_dump() for item in body.line_items]

    # Recompute totals
    totals = _compute_totals(
        quote.line_items,
        float(quote.margin_pct or 0),
        float(quote.tax_rate_pct),
    )
    for k, v in totals.items():
        setattr(quote, k, v)

    await db.commit()
    await db.refresh(quote)
    return quote


@router.put("/quotes/{quote_id}/status", response_model=QuoteRead)
async def update_quote_status(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    body: QuoteStatusUpdate,
    user: Annotated[User, RequireInstaller],
    db: AsyncSession = Depends(get_db),
):
    await _get_project_or_404(project_id, user.id, user.role, db)

    result = await db.execute(
        select(Quote).where(Quote.id == quote_id, Quote.project_id == project_id)
    )
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    quote.status = body.status
    await db.commit()
    await db.refresh(quote)
    return quote


@router.get("/quotes/{quote_id}/pdf")
async def download_quote_pdf(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project_or_404(project_id, user.id, user.role, db)

    result = await db.execute(
        select(Quote).where(Quote.id == quote_id, Quote.project_id == project_id)
    )
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Load installer profile
    from sqlalchemy.orm import selectinload as sil
    from app.models.user import User
    user_result = await db.execute(
        select(User).options(sil(User.installer_profile)).where(User.id == quote.installer_id)
    )
    installer = user_result.scalar_one_or_none()

    from app.services.pdf import generate_quote_pdf
    pdf_bytes = generate_quote_pdf(
        quote=quote,
        project=project,
        installer=installer,
    )

    filename = f"devis-{quote.reference or quote.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
