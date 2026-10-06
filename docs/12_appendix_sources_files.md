# 12 — Appendix: Sources & Files

> Index complet de tous les fichiers du projet SenPV avec leur role.

---

## Racine du projet

| Fichier | Role |
|---------|------|
| `CLAUDE.md` | Instructions pour Claude Code (stack, conventions, workflow) |
| `docker-compose.yml` | Orchestration Docker production (7 services) |
| `docker-compose.dev.yml` | Orchestration Docker dev (PostgreSQL + Redis) |
| `.env.example` | Template variables d'environnement |
| `.gitignore` | Fichiers ignores par Git |

---

## Documentation (`docs/`)

| Fichier | Role |
|---------|------|
| `architecture.md` | Spec complete du projet (~800 lignes) |
| `MODEL_STRATEGY.md` | Strategie Opus/Sonnet/Haiku par prompt |
| `PROGRESS.md` | Suivi d'avancement (13/17 prompts) |
| `DECISIONS.md` | 12 ADR (Architecture Decision Records) |
| `BUGS.md` | Suivi des bugs (0 ouverts) |
| `CHANGELOG.md` | Journal des modifications (Keep a Changelog) |
| `TROUBLESHOOTING.md` | Guide de depannage (PostgreSQL, WeasyPrint, pvlib, etc.) |

### Prompts (`docs/prompts/`)

| Fichier | Statut | Modele |
|---------|--------|--------|
| `00-project-setup.md` | ✓ Complete | Haiku |
| `01-database-schema.md` | ✓ Complete | Sonnet |
| `02-auth.md` | ✓ Complete | Sonnet |
| `03-i18n.md` | ✓ Complete | Haiku |
| `04-equipment-catalog.md` | ✓ Complete | Sonnet |
| `05-project-management.md` | ✓ Complete | Sonnet |
| `06-map-roof-drawing.md` | ✓ Complete | Opus |
| `07-panel-placement.md` | ✓ Complete | Opus |
| `08-3d-viewer.md` | ✓ Complete | Sonnet |
| `09-pv-simulation.md` | ✓ Complete | Opus |
| `10-senelec-billing.md` | ✓ Complete | Sonnet |
| `11-financial-analysis.md` | ✓ Complete | Opus |
| `12-schematic-editor.md` | ✓ Complete | Opus |
| `13-quote-builder.md` | ✓ Complete | Sonnet |
| `14-report-generator.md` | A faire | Sonnet |
| `15-dashboard.md` | A faire | Sonnet |
| `16-deploy.md` | A faire | Haiku |

---

## Backend (`backend/`)

### Configuration

| Fichier | Role |
|---------|------|
| `pyproject.toml` | Dependances Python + config projet |
| `Dockerfile` | Image Docker backend (python:3.12-slim + WeasyPrint deps) |
| `alembic.ini` | Config Alembic (migrations) |
| `alembic/env.py` | Setup Alembic (async, GeoAlchemy2) |
| `alembic/versions/` | Fichiers de migration |

### Application (`backend/app/`)

| Fichier | Role |
|---------|------|
| `main.py` | FastAPI app factory, CORS, routers |
| `config.py` | pydantic-settings (DATABASE_URL, REDIS_URL, SECRET_KEY) |
| `database.py` | Engine async + SessionLocal |
| `dependencies.py` | get_db(), get_current_user() |

### Modeles (`backend/app/models/`)

| Fichier | Table | Prompt |
|---------|-------|--------|
| `__init__.py` | Imports tous les modeles | 01 |
| `user.py` | users, installer_profiles | 01 |
| `client.py` | clients | 01 |
| `project.py` | projects | 01 |
| `roof_zone.py` | roof_zones (PostGIS) | 01 |
| `panel_layout.py` | panel_layouts | 01 |
| `equipment.py` | equipment (JSONB specs) | 01 |
| `simulation.py` | simulations | 01 |
| `financial.py` | financial_analyses | 01 |
| `schematic.py` | schematics | 01 |
| `quote.py` | quotes | 01 |
| `report.py` | reports | 01 |

### Schemas Pydantic (`backend/app/schemas/`)

Miroir des modeles avec schemas Create/Update/Read pour chaque domaine.

### Routes API (`backend/app/api/`)

| Fichier | Endpoints | Prompt |
|---------|-----------|--------|
| `auth.py` | /auth/register, /auth/login, /auth/me | 02 |
| `projects.py` | CRUD /projects | 05 |
| `clients.py` | CRUD /clients | 05 |
| `equipment.py` | CRUD /equipment | 04 |
| `roof_zones.py` | CRUD /projects/{id}/zones | 06 |
| `panel_layouts.py` | CRUD /projects/{id}/layouts | 07 |
| `simulation.py` | POST /projects/{id}/simulate | 09 |
| `senelec.py` | GET /senelec/tariffs, POST /senelec/bill | 10 |
| `financial.py` | POST /projects/{id}/financial | 11 |
| `schematics.py` | GET/PUT /projects/{id}/schematic | 12 |
| `quotes.py` | CRUD /projects/{id}/quotes | 13 |
| `reports.py` | POST /projects/{id}/report | 14 |
| `dashboard.py` | GET /dashboard/stats | 15 |
| `admin.py` | GET /admin/users, /admin/stats | 15 |

### Services (`backend/app/services/`)

| Fichier | Role | Prompt |
|---------|------|--------|
| `pvlib_service.py` | Simulation PV (pvlib ModelChain + TMY) | 09 |
| `calpinage.py` | Algorithme placement panneaux (UTM28N) | 07 |
| `senelec.py` | Grille tarifaire + calcul facture | 10 |
| `financial.py` | NPV, IRR, LCOE, payback, cashflow 25 ans | 11 |
| `schematic_graph.py` | networkx auto-generation + validation | 12 |
| `optimizer.py` | Optimisation tilt/azimuth/sizing | 09 |
| `pdf.py` | WeasyPrint : rapport, devis, schema | 13, 14 |

### Taches Celery (`backend/app/tasks/`)

| Fichier | Role | Prompt |
|---------|------|--------|
| `simulation_task.py` | Simulation PV en background | 09 |
| `report_task.py` | Generation PDF en background | 14 |

### Templates WeasyPrint (`backend/app/templates/`)

| Fichier | Role | Prompt |
|---------|------|--------|
| `quote.html` | Template devis PDF | 13 |
| `report.html` | Template rapport complet PDF | 14 |
| `report.css` | Styles PDF (A4, marges, @page) | 14 |
| `schematic.html` | Template schema seul PDF | 14 |

### Donnees statiques (`backend/app/data/`)

| Fichier | Contenu | Prompt |
|---------|---------|--------|
| `default_equipment.json` | 3 panneaux + 3 onduleurs (specs completes) | 01 |
| `senelec_tariffs.json` | 4 tranches tarifaires + TVA + redevance | 01 |

### Tests (`backend/tests/`)

| Fichier | Tests | Prompt |
|---------|-------|--------|
| `conftest.py` | Fixtures (db, client, user) | 01 |
| `test_auth.py` | Register, login, JWT | 02 |
| `test_equipment.py` | CRUD, validation specs | 04 |
| `test_projects.py` | CRUD, statuts, clients | 05 |
| `test_calpinage.py` | Algo placement panneaux | 07 |
| `test_simulation.py` | pvlib, cache, fallback | 09 |
| `test_senelec.py` | Tarifs, calcul facture | 10 |
| `test_financial.py` | NPV, IRR, cashflow | 11 |
| `test_schematic_graph.py` | Auto-gen, validation, graphe | 12 |
| `test_quotes.py` | CRUD, calculs, PDF | 13 |

---

## Frontend (`frontend/`)

### Configuration

| Fichier | Role |
|---------|------|
| `package.json` | Dependances npm + scripts |
| `next.config.ts` | Config Next.js (i18n, images, output) |
| `tailwind.config.ts` | Config Tailwind CSS |
| `tsconfig.json` | Config TypeScript |
| `Dockerfile` | Image Docker frontend (multi-stage) |

### Messages i18n (`frontend/messages/`)

| Fichier | Langue | Namespaces |
|---------|--------|------------|
| `fr.json` | Francais | 16 namespaces |
| `en.json` | Anglais | 16 namespaces |

### Pages (`frontend/src/app/[locale]/`)

Structure detaillee dans `05_ui_spec.md`.

### Composants (`frontend/src/components/`)

| Dossier | Composants cles | Prompt |
|---------|-----------------|--------|
| `ui/` | shadcn/ui (Button, Input, Dialog, etc.) | 00 |
| `layout/` | Header, Sidebar, Footer, LocaleSwitcher | 02, 03 |
| `map/` | MapView, DrawingTools, GeoSearch | 06 |
| `panels/` | PanelGrid, PanelToolbar, PanelBadge | 07 |
| `viewer3d/` | RoofScene, SolarPanels3D, Building, Controls | 08 |
| `charts/` | ProductionChart, CashflowChart, SavingsChart | 09, 11 |
| `schematic/` | SchematicEditor, nodes/, edges/, ValidationPanel | 12 |
| `quote/` | QuoteEditor, LineItemTable, QuotePreview | 13 |
| `equipment/` | PanelForm, InverterForm, EquipmentTable | 04 |
| `dashboard/` | KPICard, PipelineBoard, RecentProjectsTable | 15 |

### Stores Zustand (`frontend/src/store/`)

| Fichier | Contenu |
|---------|---------|
| `project.ts` | Projet courant, zones, layouts |
| `map.ts` | Etat carte, mode dessin |
| `schematic.ts` | Noeuds/aretes React Flow |
| `equipment.ts` | Catalogue charge |

### Utilitaires (`frontend/src/lib/`)

| Fichier | Role |
|---------|------|
| `api.ts` | Fetch wrapper (backend FastAPI) |
| `auth.ts` | NextAuth config (providers, callbacks) |
| `geo.ts` | Helpers geospatiaux (wgs84ToLocal3D) |
| `solar.ts` | Calculs preview cote client |

---

## Scripts (`scripts/`)

| Fichier | Role | Prompt |
|---------|------|--------|
| `init.sh` | Initialisation (migrations, seed, admin) | 16 |
| `backup.sh` | Backup BDD + uploads (rotation 7 jours) | 16 |

---

## Sources SolarIntel v1 (reference)

Le projet original se trouve dans `/Users/yusper/Downloads/solarintel/` :

| Fichier | Description |
|---------|-------------|
| `index.html` | Monolithe frontend (2100+ lignes) |
| `solarintel/api.py` | Backend FastAPI (pvlib) |
| `solarintel/api_report.py` | Generation rapport PDF |
| `solarintel/api_senelec.py` | Tarifs SENELEC |
| `solarintel-3d/` | 3D viewer React/R3F (iframe) |

Ces fichiers servent de reference pour la migration mais ne sont pas copies directement.
