# 09 — Code Conventions

> Conventions de code, structure des fichiers et patterns utilises dans SenPV.

---

## Structure du projet

```
SenPV/
├── frontend/           <- Next.js 15 (App Router)
├── backend/            <- FastAPI + Python 3.12
├── docker-compose.yml  <- Production
├── docker-compose.dev.yml <- Dev (PostgreSQL + Redis seulement)
├── .env.example
├── scripts/            <- init.sh, backup.sh
├── CLAUDE.md           <- Instructions Claude Code
└── docs/
    ├── architecture.md <- Spec complete
    ├── prompts/        <- 17 prompts sequentiels (00-16)
    ├── PROGRESS.md
    ├── DECISIONS.md
    ├── BUGS.md
    ├── CHANGELOG.md
    ├── TROUBLESHOOTING.md
    └── MODEL_STRATEGY.md
```

---

## Backend (Python / FastAPI)

### Structure des fichiers

```
backend/
├── app/
│   ├── main.py              <- FastAPI app factory
│   ├── config.py            <- pydantic-settings (env vars)
│   ├── database.py          <- Engine + async session
│   ├── dependencies.py      <- get_db, get_current_user
│   ├── api/                 <- Routers FastAPI
│   ├── models/              <- SQLAlchemy models (1 fichier/table)
│   ├── schemas/             <- Pydantic request/response
│   ├── services/            <- Logique metier
│   ├── tasks/               <- Celery tasks
│   ├── templates/           <- HTML/CSS Jinja2 (WeasyPrint)
│   └── data/                <- JSON statiques (tarifs, equipements)
├── tests/                   <- pytest
├── alembic/                 <- Migrations
└── pyproject.toml
```

### Conventions Python

- **Modeles SQLAlchemy** : 1 fichier par table dans `app/models/`, importer dans `__init__.py`
- **Schemas Pydantic** : `ConfigDict(from_attributes=True)`, schemas Create/Update/Read
- **Services** : logique metier isolee dans `app/services/`, jamais dans les routes
- **Routes** : thin controllers — validation, appel service, retour response
- **Config** : `pydantic-settings` avec variables d'environnement
- **Database** : async sessions (asyncpg), UUID comme PK
- **Tests** : `pytest` avec SQLite in-memory (sauf tests PostGIS)
- **Imports** : absolus depuis `app.` (ex: `from app.models.user import User`)

### Conventions nommage Python

```python
# Fichiers : snake_case
panel_layout.py
schematic_graph.py

# Classes : PascalCase
class PanelLayout(Base):
class SchematicGenerateResponse(BaseModel):

# Fonctions : snake_case
def generate_schematic():
def validate_electrical():

# Variables : snake_case
annual_kwh = 8250.5
string_voc = panel_specs.voc_v * panels_per_string

# Constantes : UPPER_SNAKE_CASE
DEFAULT_DEGRADATION_RATE = 0.005
```

### SQLAlchemy patterns

```python
# Modele type
class Project(Base):
    __tablename__ = "projects"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="draft")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relations
    user = relationship("User", back_populates="projects")
    roof_zones = relationship("RoofZone", back_populates="project", cascade="all, delete-orphan")
```

---

## Frontend (TypeScript / Next.js)

### Structure des fichiers

```
frontend/src/
├── app/[locale]/           <- Pages (App Router + i18n)
│   ├── (app)/              <- Route group authentifie
│   └── auth/               <- Pages auth (sans sidebar)
├── components/
│   ├── ui/                 <- shadcn/ui
│   ├── layout/             <- Header, Sidebar, Footer
│   ├── map/                <- MapView, DrawingTools
│   ├── panels/             <- PanelGrid, PanelToolbar
│   ├── viewer3d/           <- RoofScene, SolarPanels3D
│   ├── schematic/          <- SchematicEditor, nodes/
│   ├── charts/             <- ProductionChart, CashflowChart
│   ├── quote/              <- QuoteEditor, LineItemTable
│   ├── equipment/          <- PanelForm, InverterForm
│   └── dashboard/          <- KPICard, PipelineBoard
├── lib/                    <- Utilitaires (api.ts, auth.ts, geo.ts)
├── store/                  <- Zustand stores
└── types/                  <- TypeScript types
```

### Conventions TypeScript

```typescript
// Fichiers composants : PascalCase
MapView.tsx
QuoteEditor.tsx

// Fichiers utilitaires : camelCase
api.ts
geo.ts

// Types : PascalCase + suffixe
interface Project { ... }
interface ProjectCreate { ... }
type RoofType = 'flat' | 'gable' | 'hip' | 'shed';

// Hooks : use prefix
const useProjectStore = create<ProjectState>((set) => ({ ... }));

// Props : PascalCase + Props suffix
interface KPICardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
}
```

### Patterns Next.js

```typescript
// Dynamic import (MapLibre, R3F, React Flow) — ADR-011
const MapView = dynamic(() => import('@/components/map/MapView'), { ssr: false });

// i18n — toute chaine affichee
const t = useTranslations('projects');
<h1>{t('title')}</h1>

// API calls — via lib/api.ts
const response = await api.get(`/projects/${id}`);

// Route group (app) — ADR-009
// src/app/[locale]/(app)/layout.tsx wrappe AppLayout
```

### Styles

- **Tailwind CSS uniquement** — pas de CSS modules, pas de styled-components
- **shadcn/ui** pour tous les composants UI de base
- **Pas d'emojis** dans le code sauf demande explicite

---

## Base de donnees

- **PostgreSQL 16 + PostGIS** : toutes les geometries
- **UUID** comme cle primaire partout (`gen_random_uuid`)
- **JSONB** pour les donnees semi-structurees (specs, params, nodes)
- **TIMESTAMPTZ** pour tous les timestamps
- **Cascade delete** sur toutes les FK (sauf client_id -> SET NULL)
- **Index** explicites sur les colonnes filtrees (equipment.type, equipment.is_global)

---

## Tests

### Backend (pytest)
- SQLite in-memory pour les tests CRUD (rapide)
- PostgreSQL reel pour les tests PostGIS (calpinage, zones)
- Fixtures dans `tests/conftest.py`
- ~170+ tests passants

### Frontend (vitest)
- Tests unitaires des composants
- Pas de tests E2E dans le MVP

---

## Git & versioning

- Branche principale : `main`
- Commits en anglais, prefixes : `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- Pas de force push sur main
- CHANGELOG.md au format Keep a Changelog

---

## Docker

- `docker-compose.yml` : production (7 services)
- `docker-compose.dev.yml` : dev (PostgreSQL + Redis seulement)
- Frontend : multi-stage build (builder + runner)
- Backend : python:3.12-slim + deps systeme WeasyPrint
- Volumes : pgdata, redisdata, uploads, traefik-certs, portainer-data
- Healthchecks sur PostgreSQL et Redis
- `restart: unless-stopped` sur tous les services
