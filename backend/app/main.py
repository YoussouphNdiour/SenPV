from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.auth import router as auth_router
from app.api.clients import router as clients_router
from app.api.equipment import router as equipment_router
from app.api.projects import router as projects_router
from app.api.panel_layouts import router as panel_layouts_router
from app.api.roof_zones import router as roof_zones_router
from app.api.simulation import router as simulation_router
from app.config import settings
from app.database import async_session
from app.services.seed_equipment import seed_equipment


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure upload directory exists
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://frontend:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploads — ensure directory exists before mounting
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


app.include_router(auth_router)
app.include_router(equipment_router)
app.include_router(projects_router)
app.include_router(clients_router)
app.include_router(roof_zones_router)
app.include_router(panel_layouts_router)
app.include_router(simulation_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
