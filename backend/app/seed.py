"""Seed script to create a default admin user if none exists."""

import asyncio
import os

from passlib.context import CryptContext
from sqlalchemy import select

from app.database import async_session
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed_admin():
    email = os.environ.get("ADMIN_EMAIL", "admin@senpv.sn")
    password = os.environ.get("ADMIN_PASSWORD", "admin123")

    async with async_session() as db:
        result = await db.execute(select(User).where(User.role == "admin"))
        if result.scalar_one_or_none():
            print("Admin user already exists, skipping seed.")
            return

        admin = User(
            email=email,
            name="Admin SenPV",
            password_hash=pwd_context.hash(password),
            role="admin",
        )
        db.add(admin)
        await db.commit()
        print(f"Admin user created: {email}")


if __name__ == "__main__":
    asyncio.run(seed_admin())
