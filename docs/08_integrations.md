# 08 — Integrations

> Services externes, APIs tierces et bibliotheques cles utilisees par SenPV.

---

## APIs externes

### PVGIS (Photovoltaic Geographical Information System)
- **URL** : `https://re.jrc.ec.europa.eu/api/v5_2/`
- **Usage** : Donnees meteorologiques TMY (Typical Meteorological Year)
- **Endpoint** : `pvgis.get_pvgis_tmy(latitude, longitude, ...)`
- **Gratuit** : Oui (API publique, Commission Europeenne)
- **Limitation** : Timeout possible, pas de SLA
- **Fallback** : Estimation basee sur 1650 kWh/kWc pour Dakar
- **Fichier** : `backend/app/services/pvlib_service.py`

### Nominatim (OpenStreetMap)
- **URL** : `https://nominatim.openstreetmap.org/`
- **Usage** : Geocoding (adresse -> coordonnees lat/lon)
- **Gratuit** : Oui (usage raisonnable, user-agent requis)
- **Fichier** : Composant `GeoSearch.tsx` dans le frontend

### Google OAuth (optionnel)
- **Usage** : Inscription/connexion via compte Google
- **Config** : `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` dans `.env`
- **Fichier** : `frontend/src/lib/auth.ts` (NextAuth provider)

---

## Bibliotheques cles — Backend

### pvlib (simulation PV)
- **Version** : 0.11+
- **Usage** : Simulation complete de production solaire
- **Composants utilises** :
  - `pvlib.iotools.get_pvgis_tmy()` — donnees meteo
  - `pvlib.pvsystem.PVSystem()` — configuration systeme PV
  - `pvlib.modelchain.ModelChain()` — simulation chaine complete
  - `pvlib.temperature.sapm_cell()` — temperature cellule
- **Attention** : `gamma_pdc` doit etre en fraction/°C, pas %/°C (ADR-012)
- **Fichier** : `backend/app/services/pvlib_service.py`

### networkx (graphe electrique)
- **Version** : 3.x
- **Usage** : Modelisation et validation du schema unifilaire
- **Composants utilises** :
  - `nx.DiGraph()` — graphe oriente (composants electriques)
  - Parcours de noeuds pour validation (tensions, courants)
  - Serialisation JSON (node_link_data / node_link_graph)
- **Layout** : Hierarchique manuel (pas de pygraphviz)
- **Fichier** : `backend/app/services/schematic_graph.py`

### WeasyPrint (generation PDF)
- **Version** : 62+
- **Usage** : HTML/CSS -> PDF (rapports, devis, schemas)
- **Templates** : Jinja2 dans `backend/app/templates/`
- **Dependances systeme** : libpango, libpangocairo, libcairo, libgdk-pixbuf
- **Fichier** : `backend/app/services/pdf.py`
- **Decision** : ADR-004 (WeasyPrint au lieu de ReportLab)

### matplotlib (graphiques PDF)
- **Usage** : Generation de graphiques SVG pour inclusion dans les PDF
- **Backend Agg** : `matplotlib.use('Agg')` (pas de GUI)
- **Graphiques** : barres production mensuelle, courbe cashflow
- **Fichier** : `backend/app/services/pdf.py` (generate_chart_images)

### SQLAlchemy 2.0 + GeoAlchemy2
- **Usage** : ORM + support PostGIS
- **Mode** : Async avec asyncpg
- **GeoAlchemy2** : Type `Geometry('POLYGON', srid=4326)` pour les zones de toit
- **Fichier** : `backend/app/models/` + `backend/app/database.py`

### Alembic
- **Usage** : Migrations de base de donnees
- **Commandes** : `alembic upgrade head`, `alembic revision --autogenerate`
- **Config** : `backend/alembic.ini` + `backend/alembic/env.py`

### Celery + Redis
- **Usage** : Taches asynchrones (simulations longues, generation PDF)
- **Broker** : Redis (`REDIS_URL`)
- **Taches** : `backend/app/tasks/simulation_task.py`, `report_task.py`

### Redis (cache)
- **Usage** : Cache des resultats de simulation (cle = hash des params)
- **Fallback** : Graceful — fonctionne sans Redis (pas de cache)
- **Fichier** : `backend/app/services/pvlib_service.py`

---

## Bibliotheques cles — Frontend

### MapLibre GL JS
- **Version** : 4.x (ESM-only)
- **Usage** : Carte interactive, dessin de polygones
- **Import** : Dynamic (`await import("maplibre-gl")`) — ADR-011
- **Tiles** : OpenStreetMap standard (configurable)
- **Decision** : ADR-001 (MapLibre au lieu d'ArcGIS)
- **Fichier** : `frontend/src/components/map/MapView.tsx`

### React Three Fiber + drei
- **Usage** : Visualisation 3D des toits avec panneaux
- **Import** : Dynamic avec `ssr: false`
- **Performance** : instancedMesh pour >50 panneaux
- **Fichier** : `frontend/src/components/viewer3d/`

### React Flow
- **Version** : 12.x
- **Usage** : Editeur de schema unifilaire interactif
- **Composants** : Noeuds custom (PanelNode, InverterNode, BreakerNode, etc.)
- **Decision** : ADR-002 (React Flow pour le schema)
- **Fichier** : `frontend/src/components/schematic/`

### NextAuth.js v5
- **Usage** : Authentification frontend (sessions, providers)
- **Providers** : Credentials (email/password) + Google OAuth
- **Integration** : `proxy.ts` pour la protection des routes (Next.js 16 — ADR-007)
- **Fichier** : `frontend/src/lib/auth.ts`

### next-intl
- **Version** : 3.x
- **Usage** : Internationalisation FR/EN
- **Namespaces** : 16 (common, auth, dashboard, projects, equipment, etc.)
- **Fichiers** : `frontend/messages/fr.json`, `frontend/messages/en.json`

### Recharts
- **Version** : 2.x
- **Usage** : Graphiques interactifs dans le frontend
- **Types** : BarChart (production), LineChart (cashflow), PieChart (repartition)
- **Fichier** : `frontend/src/components/charts/`

### Zustand
- **Version** : 5.x
- **Usage** : State management par domaine
- **Stores** : project, map, schematic, equipment
- **Fichier** : `frontend/src/store/`

---

## Infrastructure

### PostgreSQL 16 + PostGIS
- **Image Docker** : `postgis/postgis:16-3.4`
- **Usage** : Base de donnees relationnelle + geometries spatiales
- **PostGIS** : Polygones de toit (SRID 4326 / WGS84)

### Redis 7
- **Image Docker** : `redis:7-alpine`
- **Usage** : Cache simulations + broker Celery

### Traefik 3
- **Image Docker** : `traefik:v3.1`
- **Usage** : Reverse proxy, HTTPS auto (Let's Encrypt)
- **Labels Docker** : routage frontend/backend/portainer

### Portainer CE
- **Image Docker** : `portainer/portainer-ce:latest`
- **Usage** : UI de gestion Docker sur VPS
- **Acces** : `https://portainer.{DOMAIN}`

---

## Diagramme d'integration

```
[Navigateur] --> [Traefik :443]
                    |
        +-----------+-----------+
        |                       |
   [Next.js :3000]      [FastAPI :8000]
   (frontend)            (backend API)
        |                    |
        |              +-----+-----+-----+
        |              |           |     |
   [NextAuth]    [PostgreSQL] [Redis] [Celery]
   (sessions)    (+ PostGIS)  (cache)  (tasks)
                                |
                          [Redis broker]
                          
[FastAPI] --> [PVGIS API] (donnees meteo)
[Next.js] --> [Nominatim] (geocoding)
[Next.js] --> [Google OAuth] (optionnel)
```
