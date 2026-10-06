# 15 — Orchestration

> Comment les differents services SenPV s'orchestrent : flux de donnees, taches async, et deploiement.

---

## Architecture des services

```
┌─────────────────────────────────────────────────────────────┐
│                        TRAEFIK :443                          │
│                    (reverse proxy, HTTPS)                     │
├──────────────────────┬──────────────────────────────────────┤
│                      │                                       │
│   NEXT.JS :3000      │        FASTAPI :8000                  │
│   (frontend)         │        (backend API)                  │
│                      │            │                           │
│   - App Router       │     ┌──────┼──────────┐               │
│   - NextAuth         │     │      │          │               │
│   - Zustand          │     │   CELERY     REDIS              │
│   - MapLibre         │     │   WORKER     :6379              │
│   - R3F              │     │   (tasks)    (cache+broker)     │
│   - React Flow       │     │      │          │               │
│   - Recharts         │     │      └──────────┘               │
│                      │     │                                  │
│                      │   POSTGRESQL :5432                     │
│                      │   + PostGIS                            │
│                      │                                        │
└──────────────────────┴────────────────────────────────────────┘
│                                                                │
│                      PORTAINER :9000                           │
│                    (gestion Docker)                             │
└────────────────────────────────────────────────────────────────┘
```

---

## Flux de donnees — Parcours complet

### 1. Creation de projet
```
[User] -> [Next.js] POST /projects -> [FastAPI] -> [PostgreSQL]
                                                        |
                                                   INSERT INTO projects
                                                        |
                                              retour Project object
```

### 2. Dessin de toit
```
[User dessine polygone sur MapLibre]
    |
[MapView] -> POST /projects/{id}/zones (GeoJSON polygon)
    |
[FastAPI] -> [PostgreSQL + PostGIS]
    |            |
    |       INSERT INTO roof_zones (polygon GEOMETRY)
    |       + calcul area_m2 via ST_Area
    |
retour RoofZone object
```

### 3. Calpinage (placement panneaux)
```
[User selectionne panneau + lance calpinage]
    |
[Frontend] -> POST /projects/{id}/layouts
    |
[FastAPI] -> [calpinage.py service]
    |            |
    |       1. Charger polygon (WGS84)
    |       2. Projeter UTM28N (EPSG:32628)
    |       3. Generer grille panneaux
    |       4. Rotation selon azimuth
    |       5. Clipping au polygone
    |       6. Retour positions GeoJSON
    |
[PostgreSQL] INSERT INTO panel_layouts (layout_geojson JSONB)
    |
retour PanelLayout object + GeoJSON
```

### 4. Simulation PV
```
[User] -> POST /projects/{id}/simulate
    |
[FastAPI] -> check Redis cache (hash des params)
    |            |
    |       [Cache HIT] -> retour resultats cached
    |       [Cache MISS] ->
    |            |
    |       [pvlib_service.py]
    |            |
    |       1. Telecharger TMY (PVGIS API)
    |       2. Configurer PVSystem (panel specs)
    |       3. Executer ModelChain
    |       4. Calculer production mensuelle/annuelle
    |       5. Cache Redis
    |            |
    |       [TIMEOUT PVGIS?]
    |            |
    |       [Fallback] -> estimation 1650 kWh/kWc
    |
[PostgreSQL] INSERT INTO simulations
    |
retour Simulation object
```

### 5. Analyse financiere
```
[User] -> POST /projects/{id}/financial
    |
[FastAPI] -> [financial.py service]
    |            |
    |       1. Charger simulation (annual_kwh)
    |       2. Calculer economies SENELEC (senelec.py)
    |       3. Boucle 25 ans (degradation + inflation)
    |       4. Calculer NPV (taux actualisation)
    |       5. Calculer IRR (Newton-Raphson)
    |       6. Calculer LCOE
    |       7. Generer cashflow cumule
    |
[PostgreSQL] INSERT INTO financial_analyses
    |
retour FinancialAnalysis object
```

### 6. Schema unifilaire
```
[User] -> POST /projects/{id}/schematic/generate
    |
[FastAPI] -> [schematic_graph.py service]
    |            |
    |       1. Creer DiGraph networkx
    |       2. Ajouter noeuds (panneaux, DC, onduleur, AC, compteur)
    |       3. Ajouter aretes (cables DC/AC, terre)
    |       4. Calculer layout hierarchique
    |       5. Valider (tensions, courants, MPPT, calibres)
    |       6. Convertir -> format React Flow
    |
[PostgreSQL] INSERT INTO schematics (schema_data JSONB)
    |
retour {nodes, edges, validation_errors}
```

### 7. Generation rapport PDF
```
[User] -> POST /projects/{id}/report
    |
[FastAPI] -> [Celery task] (background)
    |            |
    |       [report_task.py]
    |            |
    |       1. Charger toutes les donnees (projet, simulation, financial, schematic, quote)
    |       2. Generer graphiques matplotlib -> SVG
    |       3. Render template Jinja2 (report.html)
    |       4. WeasyPrint HTML -> PDF
    |       5. Sauvegarder fichier PDF
    |       6. INSERT INTO reports (file_path)
    |
retour {task_id, status: "processing"}

[User] -> GET /reports/{id}/download
    |
[FastAPI] -> FileResponse(file_path)
```

---

## Taches asynchrones (Celery)

### Configuration
```python
# Broker : Redis
CELERY_BROKER_URL = redis://redis:6379/0
CELERY_RESULT_BACKEND = redis://redis:6379/1

# Worker : 2 workers concurrents
celery -A app.tasks worker --loglevel=info --concurrency=2
```

### Taches definies
| Tache | Fichier | Declencheur | Duree estimee |
|-------|---------|-------------|---------------|
| Simulation PV | `simulation_task.py` | POST /simulate | 5-10s |
| Generation rapport | `report_task.py` | POST /report | 2-5s |

### Gestion des erreurs
- Timeout : 60s par tache
- Retry : 3 tentatives avec backoff exponentiel
- Fallback simulation : estimation simplifiee si PVGIS timeout

---

## Cache Redis

### Strategie de cache
```
Cle : sha256(lat, lon, tilt, azimuth, panel_specs, num_panels)
Valeur : resultats simulation (JSON)
TTL : 24h (les donnees meteo ne changent pas en 24h)
```

### Graceful fallback
- Si Redis est indisponible : pas de cache, simulation directe
- Pas d'erreur fatale — le service fonctionne sans Redis

---

## Deploiement Docker Compose

### Services production (7)
```yaml
services:
  traefik:     # Reverse proxy, HTTPS, routing
  frontend:    # Next.js (port 3000)
  backend:     # FastAPI (port 8000)
  celery:      # Worker Celery (meme image que backend)
  postgres:    # PostgreSQL 16 + PostGIS
  redis:       # Redis 7 (cache + broker)
  portainer:   # UI gestion Docker (port 9000)
```

### Ordre de demarrage
```
1. postgres (healthcheck: pg_isready)
2. redis (healthcheck: redis-cli ping)
3. backend (depends_on: postgres + redis healthy)
4. celery (depends_on: postgres + redis healthy)
5. frontend (depends_on: backend)
6. traefik (depends_on: frontend + backend)
7. portainer (independant)
```

### Volumes persistants
| Volume | Donnees |
|--------|---------|
| `pgdata` | Base de donnees PostgreSQL |
| `redisdata` | Donnees Redis persistees |
| `uploads` | Logos, rapports PDF, fichiers utilisateurs |
| `traefik-certs` | Certificats Let's Encrypt |
| `portainer-data` | Configuration Portainer |

### Routing Traefik
```
Host(senpv.example.com)                    -> frontend:3000
Host(senpv.example.com) && /api/*          -> backend:8000 (strip /api)
Host(portainer.senpv.example.com)          -> portainer:9000
Host(traefik.senpv.example.com)            -> traefik dashboard
```

---

## Scripts d'operations

### init.sh — Premiere installation
```
1. Copier .env.example -> .env (si pas existe)
2. docker compose up -d
3. Attendre PostgreSQL (pg_isready)
4. alembic upgrade head (migrations)
5. Seed equipements (default_equipment.json)
6. Seed admin (email/password depuis .env)
```

### backup.sh — Sauvegarde quotidienne
```
1. pg_dump | gzip -> /backups/senpv/db_YYYYMMDD.sql.gz
2. tar uploads -> /backups/senpv/uploads_YYYYMMDD.tar.gz
3. Rotation : garder les 7 derniers backups
```

Recommandation : cron quotidien a 3h du matin
```cron
0 3 * * * /path/to/scripts/backup.sh
```

---

## Monitoring

### Health check
```
GET /health -> {status, postgres, redis, version}
```

### Logs
```bash
# Tous les services
docker compose logs -f

# Backend seul
docker compose logs -f backend

# Celery
docker compose logs -f celery-worker
```

### Metriques (via API admin)
```
GET /admin/stats -> {total_users, total_projects, total_kwc, total_installers}
```
