import shutil
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.dependencies import CurrentUser
from app.models.user import InstallerProfile, User
from app.schemas.user import (
    InstallerProfileRead,
    LoginRequest,
    ProfileUpdate,
    RegisterRequest,
    TokenResponse,
    UserRead,
    UserWithProfile,
)

router = APIRouter(prefix="/auth", tags=["auth"])

ALLOWED_LOGO_EXTENSIONS = {".png", ".jpg", ".jpeg", ".svg"}
MAX_LOGO_SIZE = 2 * 1024 * 1024  # 2MB


def create_access_token(user: User) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    data: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Validate role
    if data.role not in ("particular", "installer"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'particular' or 'installer'",
        )

    # Create user
    user = User(
        email=data.email,
        name=data.name,
        password_hash=bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode(),
        role=data.role,
    )
    db.add(user)
    await db.flush()

    # If installer, create empty profile
    if data.role == "installer":
        profile = InstallerProfile(
            user_id=user.id,
            company_name=data.company_name or data.name,
            phone=data.phone,
        )
        db.add(profile)

    await db.commit()
    await db.refresh(user)

    token = create_access_token(user)
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash or not bcrypt.checkpw(data.password.encode(), user.password_hash.encode()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    token = create_access_token(user)
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.get("/me", response_model=UserWithProfile)
async def get_me(user: CurrentUser):
    return UserWithProfile.model_validate(user)


@router.put("/profile", response_model=UserWithProfile)
async def update_profile(
    data: ProfileUpdate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Update user fields
    if data.name is not None:
        user.name = data.name
    if data.locale is not None:
        user.locale = data.locale

    # Update installer profile fields
    if user.role in ("installer", "admin") and user.installer_profile:
        profile = user.installer_profile
        if data.company_name is not None:
            profile.company_name = data.company_name
        if data.address is not None:
            profile.address = data.address
        if data.phone is not None:
            profile.phone = data.phone
        if data.siret is not None:
            profile.siret = data.siret
        if data.payment_terms is not None:
            profile.payment_terms = data.payment_terms

    await db.commit()
    await db.refresh(user)
    return UserWithProfile.model_validate(user)


@router.post("/profile/logo", response_model=UserWithProfile)
async def upload_logo(
    file: UploadFile,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if user.role not in ("installer", "admin") or not user.installer_profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only installers can upload a logo",
        )

    # Validate extension
    ext = Path(file.filename).suffix.lower() if file.filename else ""
    if ext not in ALLOWED_LOGO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Accepted: {', '.join(ALLOWED_LOGO_EXTENSIONS)}",
        )

    # Validate size
    content = await file.read()
    if len(content) > MAX_LOGO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size: 2MB",
        )

    # Save file
    logos_dir = Path(settings.upload_dir) / "logos"
    logos_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{user.id}{ext}"
    file_path = logos_dir / filename

    with open(file_path, "wb") as f:
        f.write(content)

    # Update profile
    user.installer_profile.logo_path = f"/uploads/logos/{filename}"
    await db.commit()
    await db.refresh(user)
    return UserWithProfile.model_validate(user)
