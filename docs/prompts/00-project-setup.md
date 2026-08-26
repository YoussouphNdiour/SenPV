# Prompt 00 — Project Setup

## Contexte

Initialiser le projet SenPV depuis zéro : un frontend Next.js 15 et un backend FastAPI, orchestrés par Docker Compose avec PostgreSQL + PostGIS et Redis.

Référence architecture : `docs/architecture.md`

## Tâches

### 1. Frontend Next.js

```bash
cd /Users/yusper/Downloads/SenPV
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

Installer les dépendances :
```bash
cd frontend
npm install maplibre-gl @deck.gl/core @deck.gl/layers @deck.gl/mapbox
npm install @react-three/fiber @react-three/drei three
npm install @xyflow/react
npm install recharts
npm install zustand
npm install next-intl
npm install next-auth@beta
npm install lucide-react
npm install clsx tailwind-merge class-variance-authority
npm install -D @types/three
```

Initialiser shadcn/ui :
```bash
npx shadcn@latest init
npx shadcn@latest add button card input label select dialog table tabs badge separator dropdown-menu sheet toast form
```

### 2. Backend FastAPI

```bash
cd /Users/yusper/Downloads/SenPV
mkdir -p backend/app/{api,models,schemas,services,tasks,templates,data}
mkdir -p backend/tests
mkdir -p backend/alembic/versions
```

Créer `backend/pyproject.toml` :
```toml
[project]
name = "senpv-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "pvlib>=0.11.0",
    "pandas>=2.2.0",
    "numpy>=1.26.0",
    "sqlalchemy[asyncio]>=2.0.0",
    "asyncpg>=0.29.0",
    "geoalchemy2>=0.15.0",
    "alembic>=1.13.0",
    "pydantic>=2.0.0",
    "pydantic-settings>=2.0.0",
    "python-jose[cryptography]>=3.3.0",
    "passlib[bcrypt]>=1.7.4",
    "python-multipart>=0.0.9",
    "weasyprint>=62.0",
    "jinja2>=3.1.0",
    "networkx>=3.0",
    "redis>=5.0.0",
    "celery[redis]>=5.4.0",
    "httpx>=0.27.0",
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
]
```

Créer `backend/app/main.py` — FastAPI app factory avec :
- CORS middleware (autoriser frontend)
- Inclusion de tous les routers depuis `app/api/`
- Route `/health` retournant `{"status": "ok"}`
- Montage fichiers statiques pour `/uploads`

Créer `backend/app/config.py` — pydantic-settings :
```python
class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://senpv:secret@localhost:5432/senpv"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24h
    upload_dir: str = "/data/uploads"
    default_lat: float = 14.6928    # Dakar
    default_lon: float = -17.4467
    model_config = SettingsConfigDict(env_file=".env")
```

Créer `backend/app/database.py` — async engine + session factory.

### 3. Docker Compose

Créer `docker-compose.yml` à la racine avec :
- `postgres` : image `postgis/postgis:16-3.4`, volume `pgdata`, port 5432
- `redis` : image `redis:7-alpine`, volume `redisdata`, port 6379
- `backend` : build `./backend`, port 8000, dépend de postgres + redis
- `celery-worker` : même build que backend, commande celery
- `frontend` : build `./frontend`, port 3000, dépend de backend
- `traefik` : image `traefik:v3.1`, ports 80/443, Let's Encrypt

Créer `docker-compose.dev.yml` (override pour dev local) :
- Pas de Traefik
- Ports exposés directement (3000, 8000)
- Volumes montés pour hot reload

Créer `.env.example` :
```env
# Database
POSTGRES_DB=senpv
POSTGRES_USER=senpv
POSTGRES_PASSWORD=change-me

# Backend
SECRET_KEY=change-me-in-production
DATABASE_URL=postgresql+asyncpg://senpv:change-me@postgres:5432/senpv
REDIS_URL=redis://redis:6379/0

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=change-me

# Domain (production)
DOMAIN=senpv.example.com
ACME_EMAIL=admin@example.com
```

### 4. Dockerfiles

`backend/Dockerfile` :
- Base : `python:3.12-slim`
- Installer les dépendances système pour WeasyPrint (libpango, libcairo, libgdk-pixbuf)
- `pip install .`
- CMD : `uvicorn app.main:app --host 0.0.0.0 --port 8000`

`frontend/Dockerfile` :
- Multi-stage build
- Stage 1 : `node:20-alpine`, `npm ci`, `npm run build`
- Stage 2 : `node:20-alpine`, copier `.next/standalone`, CMD `node server.js`

### 5. Fichiers de base

Créer `backend/app/api/__init__.py` (vide)
Créer `backend/app/models/__init__.py` (vide)
Créer `backend/app/schemas/__init__.py` (vide)
Créer `backend/app/services/__init__.py` (vide)
Créer `backend/app/tasks/__init__.py` (vide)

Créer `frontend/src/lib/api.ts` — fetch wrapper basique :
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

### 6. Git

```bash
cd /Users/yusper/Downloads/SenPV
git init
```

Créer `.gitignore` :
```
node_modules/
.next/
__pycache__/
*.pyc
.env
.venv/
dist/
pgdata/
redisdata/
/data/uploads/
```

## Critères d'acceptance

- [ ] `cd frontend && npm run dev` démarre sans erreur sur :3000
- [ ] `cd backend && uvicorn app.main:app --reload` démarre sans erreur sur :8000
- [ ] `curl http://localhost:8000/health` retourne `{"status": "ok"}`
- [ ] `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` lance tous les services
- [ ] PostgreSQL accessible avec PostGIS activé
- [ ] Redis accessible
- [ ] Structure de fichiers conforme à `docs/architecture.md` section 5.1 et 6.1
