# 04 — API Specification

> Specification complete de l'API REST FastAPI de SenPV.

---

## Base URL

- Dev : `http://localhost:8000`
- Prod : `https://{DOMAIN}/api` (via Traefik strip-prefix)

## Authentification

Toutes les routes (sauf `/auth/register`, `/auth/login`, `/health`) necessitent un header :
```
Authorization: Bearer <JWT_TOKEN>
```

Le JWT contient : `sub` (user_id), `role`, `exp`.

---

## Auth

| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | `/auth/register` | Inscription email | Non |
| POST | `/auth/login` | Connexion -> JWT | Non |
| GET | `/auth/me` | Profil utilisateur courant | Oui |

### POST /auth/register
```json
// Request
{ "email": "user@example.com", "name": "Nom", "password": "secret123" }
// Response 201
{ "id": "uuid", "email": "...", "name": "...", "role": "particular", "locale": "fr" }
```

### POST /auth/login
```json
// Request
{ "email": "user@example.com", "password": "secret123" }
// Response 200
{ "access_token": "eyJ...", "token_type": "bearer", "user": {...} }
```

---

## Projects

| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| GET | `/projects` | Liste projets (filtre par user) | Oui |
| POST | `/projects` | Creer un projet | Oui |
| GET | `/projects/{id}` | Detail projet | Oui |
| PUT | `/projects/{id}` | Modifier projet | Oui |
| DELETE | `/projects/{id}` | Supprimer projet | Oui |

### POST /projects
```json
// Request
{
  "name": "Maison Dakar",
  "address": "12 rue Blanchot, Dakar",
  "lat": 14.6928,
  "lon": -17.4467,
  "client_id": "uuid-optional",
  "notes": "Toit plat 80m2"
}
// Response 201
{ "id": "uuid", "name": "...", "status": "draft", ... }
```

---

## Roof Zones

| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | `/projects/{id}/zones` | Ajouter zone toit (GeoJSON) | Oui |
| PUT | `/projects/{id}/zones/{zid}` | Modifier zone | Oui |
| DELETE | `/projects/{id}/zones/{zid}` | Supprimer zone | Oui |

### POST /projects/{id}/zones
```json
// Request
{
  "polygon": {
    "type": "Polygon",
    "coordinates": [[[-17.447, 14.693], [-17.446, 14.693], [-17.446, 14.692], [-17.447, 14.692], [-17.447, 14.693]]]
  },
  "orientation_deg": 180.0,
  "tilt_deg": 15.0,
  "roof_type": "flat"
}
```

---

## Panel Layouts

| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | `/projects/{id}/layouts` | Creer layout (calpinage) | Oui |
| PUT | `/projects/{id}/layouts/{lid}` | Modifier layout | Oui |
| GET | `/projects/{id}/layouts` | Lister layouts | Oui |

### POST /projects/{id}/layouts
```json
// Request
{
  "roof_zone_id": "uuid",
  "panel_model_id": "uuid",
  "inverter_model_id": "uuid",
  "num_panels": 10,
  "num_strings": 2,
  "panels_per_string": 5,
  "spacing_x": 0.02,
  "spacing_y": 0.02
}
```

---

## Equipment

| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| GET | `/equipment?type=panel` | Liste catalogue | Oui |
| POST | `/equipment` | Ajouter equipement | Oui |
| PUT | `/equipment/{id}` | Modifier | Oui |
| DELETE | `/equipment/{id}` | Supprimer | Oui |

Filtres query params : `type` (panel/inverter), `is_global` (true/false)

---

## Simulation

| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | `/projects/{id}/simulate` | Lancer simulation pvlib | Oui |
| GET | `/projects/{id}/simulations` | Historique simulations | Oui |
| POST | `/projects/{id}/optimize` | Optimisation tilt/azimuth | Oui |

### POST /projects/{id}/simulate
```json
// Response 200
{
  "id": "uuid",
  "annual_kwh": 8250.50,
  "specific_yield": 1650.10,
  "peak_power_kwc": 5.450,
  "performance_ratio": 0.823,
  "monthly_production": [
    {"month": 1, "kwh": 620.5},
    {"month": 2, "kwh": 710.3},
    ...
  ]
}
```

---

## SENELEC

| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| GET | `/senelec/tariffs` | Grille tarifaire | Oui |
| POST | `/senelec/bill` | Calculer facture | Oui |
| POST | `/senelec/savings` | Calculer economies avec PV | Oui |

### POST /senelec/bill
```json
// Request
{ "monthly_kwh": 350, "tariff_tier": "DGP" }
// Response
{
  "base_amount_fcfa": 37927,
  "tva_fcfa": 6826,
  "redevance_fcfa": 872,
  "total_fcfa": 45625,
  "breakdown": [
    {"tier": "DPP", "kwh": 150, "amount": 13570},
    {"tier": "DMP", "kwh": 100, "amount": 10164},
    {"tier": "DGP", "kwh": 100, "amount": 11265}
  ]
}
```

---

## Financial

| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | `/projects/{id}/financial` | Analyse financiere 25 ans | Oui |

### POST /projects/{id}/financial
```json
// Request
{
  "simulation_id": "uuid",
  "total_cost_fcfa": 4500000,
  "monthly_kwh": 350,
  "discount_rate_pct": 8.0,
  "inflation_rate_pct": 3.0,
  "degradation_rate_pct": 0.5
}
// Response
{
  "npv_fcfa": 2850000,
  "irr_pct": 15.3,
  "payback_years": 6.2,
  "lcoe_fcfa_per_kwh": 45.8,
  "annual_savings_fcfa": 540000,
  "cashflow_25y": [
    {"year": 0, "production_kwh": 0, "savings_fcfa": 0, "cumulative_fcfa": -4500000},
    {"year": 1, "production_kwh": 8250, "savings_fcfa": 540000, "cumulative_fcfa": -3960000},
    ...
  ]
}
```

---

## Schematic

| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| GET | `/projects/{id}/schematic` | Charger schema unifilaire | Oui |
| PUT | `/projects/{id}/schematic` | Sauvegarder schema | Oui |
| POST | `/projects/{id}/schematic/generate` | Auto-generer depuis config | Oui |
| POST | `/projects/{id}/schematic/validate` | Valider graphe electrique | Oui |

### POST /projects/{id}/schematic/generate
```json
// Response
{
  "nodes": [
    {"id": "panel_0_0", "type": "panel", "position": {"x": 100, "y": 50}, "data": {...}},
    {"id": "inverter", "type": "inverter", "position": {"x": 300, "y": 200}, "data": {...}},
    ...
  ],
  "edges": [
    {"id": "panel_0_0-panel_0_1", "source": "panel_0_0", "target": "panel_0_1", "data": {"cable_type": "dc"}},
    ...
  ],
  "validation_errors": []
}
```

---

## Quotes

| Methode | Route | Description | Auth | Role |
|---------|-------|-------------|------|------|
| POST | `/projects/{id}/quotes` | Creer devis | Oui | installer |
| GET | `/projects/{id}/quotes` | Lister devis | Oui | installer |
| GET | `/projects/{id}/quotes/{qid}` | Detail devis | Oui | installer |
| PUT | `/projects/{id}/quotes/{qid}` | Modifier devis | Oui | installer |
| PUT | `/projects/{id}/quotes/{qid}/status` | Changer statut | Oui | installer |

---

## Reports

| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | `/projects/{id}/report` | Generer rapport complet (Celery) | Oui |
| POST | `/projects/{id}/report/quote` | Generer devis seul (PDF) | Oui |
| POST | `/projects/{id}/report/schematic` | Generer schema seul (PDF) | Oui |
| GET | `/reports/{id}/download` | Telecharger PDF | Oui |
| GET | `/projects/{id}/reports` | Historique rapports | Oui |

---

## Clients (installer only)

| Methode | Route | Description | Auth | Role |
|---------|-------|-------------|------|------|
| GET | `/clients` | Liste clients | Oui | installer |
| POST | `/clients` | Ajouter client | Oui | installer |
| PUT | `/clients/{id}` | Modifier client | Oui | installer |
| DELETE | `/clients/{id}` | Supprimer client | Oui | installer |

---

## Dashboard

| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| GET | `/dashboard/stats` | KPI selon le role | Oui |
| GET | `/dashboard/recent-projects` | 5 derniers projets | Oui |
| GET | `/dashboard/pipeline` | Projets par statut (installer) | Oui |
| GET | `/dashboard/charts` | Donnees graphiques | Oui |

---

## Admin

| Methode | Route | Description | Auth | Role |
|---------|-------|-------------|------|------|
| GET | `/admin/users` | Liste utilisateurs | Oui | admin |
| GET | `/admin/stats` | Metriques plateforme | Oui | admin |
| PUT | `/admin/users/{id}/role` | Changer role | Oui | admin |

---

## Health

| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| GET | `/health` | Statut PostgreSQL + Redis | Non |

```json
// Response
{
  "status": "ok",
  "postgres": "connected",
  "redis": "connected",
  "version": "1.0.0"
}
```
