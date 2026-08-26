# Prompt 16 — Déploiement Docker + Traefik + Portainer

## Contexte

Déployer SenPV sur un VPS avec Docker Compose, Traefik comme reverse proxy (HTTPS auto), et Portainer pour la gestion. Tout doit fonctionner avec `docker compose up -d`.

## Dépendances

- Tous les prompts précédents (0-15)

## Tâches

### 1. Dockerfiles de production

**`backend/Dockerfile`** :
```dockerfile
FROM python:3.12-slim

# Dépendances système pour WeasyPrint + PostGIS
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 \
    libcairo2 libffi-dev shared-mime-info \
    libgdal-dev libgeos-dev libproj-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY . .

# Créer le dossier uploads
RUN mkdir -p /data/uploads/{logos,reports}

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

**`frontend/Dockerfile`** :
```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

### 2. Docker Compose production

**`docker-compose.yml`** (racine du projet) :
```yaml
version: '3.8'

services:
  # --- Reverse Proxy ---
  traefik:
    image: traefik:v3.1
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik-certs:/letsencrypt
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.traefik.rule=Host(`traefik.${DOMAIN}`)"
      - "traefik.http.routers.traefik.tls.certresolver=letsencrypt"
      - "traefik.http.routers.traefik.service=api@internal"
    restart: unless-stopped

  # --- Frontend ---
  frontend:
    build: ./frontend
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`${DOMAIN}`)"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.frontend.loadbalancer.server.port=3000"
    environment:
      - NEXT_PUBLIC_API_URL=https://${DOMAIN}/api
      - NEXTAUTH_URL=https://${DOMAIN}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
    depends_on:
      - backend
    restart: unless-stopped

  # --- Backend API ---
  backend:
    build: ./backend
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`${DOMAIN}`) && PathPrefix(`/api`)"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
      - "traefik.http.services.backend.loadbalancer.server.port=8000"
      - "traefik.http.middlewares.strip-api.stripprefix.prefixes=/api"
      - "traefik.http.routers.backend.middlewares=strip-api"
    environment:
      - DATABASE_URL=postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=${SECRET_KEY}
      - UPLOAD_DIR=/data/uploads
    volumes:
      - uploads:/data/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  # --- Celery Worker ---
  celery-worker:
    build: ./backend
    command: celery -A app.tasks worker --loglevel=info --concurrency=2
    environment:
      - DATABASE_URL=postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=${SECRET_KEY}
      - UPLOAD_DIR=/data/uploads
    volumes:
      - uploads:/data/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  # --- Database ---
  postgres:
    image: postgis/postgis:16-3.4
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # --- Cache / Broker ---
  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # --- Portainer ---
  portainer:
    image: portainer/portainer-ce:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.portainer.rule=Host(`portainer.${DOMAIN}`)"
      - "traefik.http.routers.portainer.tls.certresolver=letsencrypt"
      - "traefik.http.services.portainer.loadbalancer.server.port=9000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - portainer-data:/data
    restart: unless-stopped

volumes:
  traefik-certs:
  pgdata:
  redisdata:
  uploads:
  portainer-data:
```

### 3. Docker Compose développement

**`docker-compose.dev.yml`** :
```yaml
version: '3.8'

services:
  postgres:
    image: postgis/postgis:16-3.4
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=senpv
      - POSTGRES_USER=senpv
      - POSTGRES_PASSWORD=senpv-dev
    volumes:
      - pgdata-dev:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata-dev:
```

Usage dev :
```bash
# Lancer seulement les services externes
docker compose -f docker-compose.dev.yml up -d

# Frontend en mode dev (hot reload)
cd frontend && npm run dev

# Backend en mode dev (hot reload)
cd backend && uvicorn app.main:app --reload --port 8000
```

### 4. Script d'initialisation

**`scripts/init.sh`** :
```bash
#!/bin/bash
set -e

echo "=== SenPV — Initialisation ==="

# Copier .env
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✓ .env créé depuis .env.example"
    echo "⚠ MODIFIEZ .env avec vos valeurs avant de lancer !"
    exit 1
fi

# Lancer les containers
docker compose up -d

# Attendre que PostgreSQL soit prêt
echo "Attente de PostgreSQL..."
until docker compose exec postgres pg_isready -U $POSTGRES_USER; do
    sleep 2
done

# Lancer les migrations
echo "Migrations Alembic..."
docker compose exec backend alembic upgrade head

# Seed données initiales
echo "Seed catalogue équipements..."
docker compose exec backend python -c "from app.services.seed_equipment import seed; seed()"

# Seed admin
echo "Seed utilisateur admin..."
docker compose exec backend python -c "from app.seed import seed_admin; seed_admin()"

echo "=== SenPV prêt ! ==="
echo "Frontend : https://${DOMAIN}"
echo "API      : https://${DOMAIN}/api/health"
echo "Portainer: https://portainer.${DOMAIN}"
```

### 5. Script de backup

**`scripts/backup.sh`** :
```bash
#!/bin/bash
set -e
BACKUP_DIR="/backups/senpv"
DATE=$(date +%Y%m%d_%H%M)
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker compose exec -T postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Backup uploads
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" -C /var/lib/docker/volumes/ senpv_uploads

# Garder les 7 derniers backups
ls -t $BACKUP_DIR/db_*.sql.gz | tail -n +8 | xargs -r rm
ls -t $BACKUP_DIR/uploads_*.tar.gz | tail -n +8 | xargs -r rm

echo "Backup terminé : $BACKUP_DIR"
```

### 6. Monitoring basique

Ajouter dans le backend :
- Route `/health` retournant le statut de PostgreSQL, Redis et du disque
- Logging structuré (JSON) pour les erreurs
- Middleware de logging des requêtes (temps de réponse)

### 7. Variables d'environnement production

**`.env.example`** complet :
```env
# === SenPV Production ===

# Domain
DOMAIN=senpv.example.com
ACME_EMAIL=admin@example.com

# Database
POSTGRES_DB=senpv
POSTGRES_USER=senpv
POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD

# Backend
SECRET_KEY=CHANGE_ME_RANDOM_64_CHARS
DATABASE_URL=postgresql+asyncpg://senpv:CHANGE_ME@postgres:5432/senpv
REDIS_URL=redis://redis:6379/0

# Admin initial
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=CHANGE_ME_ADMIN

# Frontend
NEXT_PUBLIC_API_URL=https://senpv.example.com/api
NEXTAUTH_URL=https://senpv.example.com
NEXTAUTH_SECRET=CHANGE_ME_RANDOM_32_CHARS

# Google OAuth (optionnel)
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
```

## Critères d'acceptance

- [ ] `docker compose up -d` lance tous les services (traefik, frontend, backend, celery, postgres, redis, portainer)
- [ ] HTTPS automatique via Let's Encrypt
- [ ] `https://DOMAIN` affiche le frontend
- [ ] `https://DOMAIN/api/health` retourne OK avec statut PostgreSQL et Redis
- [ ] `https://portainer.DOMAIN` affiche Portainer
- [ ] `scripts/init.sh` initialise tout (migrations, seed)
- [ ] `scripts/backup.sh` sauvegarde la BDD et les uploads
- [ ] Le mode dev fonctionne (docker compose dev + hot reload)
- [ ] Healthchecks PostgreSQL et Redis fonctionnent
- [ ] Les volumes persistent les données entre redémarrages
- [ ] Les logs sont accessibles via `docker compose logs`
- [ ] Redémarrage automatique des services (restart: unless-stopped)
