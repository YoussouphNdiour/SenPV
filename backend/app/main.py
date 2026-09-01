import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

import redis
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.auth import router as auth_router
from app.api.clients import router as clients_router
from app.api.dashboard import router as dashboard_router
from app.api.equipment import router as equipment_router
from app.api.projects import router as projects_router
from app.api.panel_layouts import router as panel_layouts_router
from app.api.roof_zones import router as roof_zones_router
from app.api.senelec import router as senelec_router
from app.api.financial import router as financial_router
from app.api.quotes import router as quotes_router
from app.api.reports import router as reports_router
from app.api.schematics import router as schematics_router
from app.api.simulation import router as simulation_router
from app.config import settings
from app.database import Base, async_session, engine
from app.models import *  # noqa: F401,F403 — register all models
from app.services.seed_equipment import seed_equipment

logger = logging.getLogger("senpv")
logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}',
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure upload directory exists
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)

    # Create tables if they don't exist (first launch)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed global equipment catalog
    async with async_session() as db:
        await seed_equipment(db)

    yield


app = FastAPI(
    title="SenPV API",
    description="API de dimensionnement solaire PV pour le Sénégal",
    version="0.1.0",
    lifespan=lifespan,
)

_origins = ["http://localhost:3000", "http://frontend:3000"]
if settings.domain:
    _origins.append(f"https://{settings.domain}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start) * 1000, 1)
    logger.info(
        "%s %s %s %.1fms",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


# Static files for uploads — ensure directory exists before mounting
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(equipment_router)
app.include_router(projects_router)
app.include_router(clients_router)
app.include_router(roof_zones_router)
app.include_router(panel_layouts_router)
app.include_router(senelec_router)
app.include_router(simulation_router)
app.include_router(financial_router)
app.include_router(quotes_router)
app.include_router(reports_router)
app.include_router(schematics_router)


@app.get("/health")
async def health():
    result = {"status": "ok", "version": "0.1.0"}

    # Check PostgreSQL
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        result["postgres"] = "ok"
    except Exception:
        result["postgres"] = "error"
        result["status"] = "degraded"

    # Check Redis
    try:
        r = redis.from_url(settings.redis_url, decode_responses=True)
        r.ping()
        result["redis"] = "ok"
    except Exception:
        result["redis"] = "error"
        result["status"] = "degraded"

    return result
