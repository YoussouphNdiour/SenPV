# SenPV — Architecture & Design Specification

> **Version** : 1.0
> **Date** : 2026-08-26
> **Statut** : Validé
> **Cible** : Sénégal (SENELEC, FCFA)

---

## 1. Vision produit

SenPV est une plateforme SaaS de dimensionnement d'installations solaires photovoltaïques au Sénégal. Elle combine deux modes d'utilisation :

- **SaaS ouvert** — tout particulier peut s'inscrire, dessiner son toit sur une carte, simuler une installation PV et obtenir un rapport complet (production, économies SENELEC, retour sur investissement).
- **Outil professionnel** — les installateurs solaires gèrent un pipeline commercial (prospects → devis → installation), avec fiches clients, devis personnalisés (logo, marges, conditions), catalogue d'équipements techniques et schéma unifilaire.

### Ce que SenPV ne fait PAS

- Pas de système multi-agents IA (CrewAI/Ollama supprimé)
- Pas de ciblage international — Sénégal uniquement (tarifs SENELEC, FCFA, TMY Dakar)
- Pas de logo graphique — le texte "SenPV" suffit

---

## 2. Rôles utilisateurs

| Rôle | Accès | Description |
|------|-------|-------------|
| `particular` | Projets perso, simulations, rapports | Particulier qui dimensionne son installation |
| `installer` | Multi-projets, fiches clients, devis, catalogue équipements, schéma unifilaire | Professionnel installateur solaire |
| `admin` | Tout + gestion utilisateurs, métriques plateforme, catalogue global | Administrateur de la plateforme |

### Parcours "Particulier"
1. Inscription (email/Google) → dashboard vide
2. Nouveau projet → saisie adresse ou clic sur carte
3. Dessin du toit → polygone sur MapLibre
4. Calpinage auto → grille de panneaux générée
5. Ajustement manuel → ajouter/supprimer/déplacer panneaux
6. Vue 3D → visualisation du toit avec panneaux
7. Simulation → production kWh, économies SENELEC, ROI
8. Rapport PDF → téléchargeable
9. Historique → retrouver ses projets passés

### Parcours "Installateur"
- Même parcours +
- Multi-projets par client
- Fiches clients (nom, adresse, téléphone, conso SENELEC)
- Catalogue équipements perso (panneaux + onduleurs avec specs complètes)
- Devis avec logo, lignes, marges, TVA, conditions de paiement
- Schéma unifilaire auto-généré + éditable
- Pipeline commercial (prospect → étude → devis → signé → installé)

### Parcours "Admin"
- Tous les utilisateurs, tous les projets
- Catalogue global d'équipements
- Métriques plateforme (nb utilisateurs, nb projets, kWc total)

---

## 3. Stack technique

### Frontend

| Techno | Version | Rôle |
|--------|---------|------|
| Next.js | 15 (App Router) | Framework React, SSR, routing |
| React | 19 | UI library |
| MapLibre GL JS | 4.x | Carte interactive open source |
| Deck.gl | 9.x | Couches géospatiales haute performance |
| React Three Fiber | 8.x | Visualisation 3D toits/panneaux (intégré, pas d'iframe) |
| @react-three/drei | 9.x | Helpers Three.js |
| React Flow | 12.x | Éditeur schéma unifilaire (drag & drop, nœuds custom) |
| shadcn/ui | latest | Composants UI accessibles (Radix + Tailwind) |
| Tailwind CSS | 4.x | Styles utilitaires |
| Recharts | 2.x | Graphiques (production, financier) |
| Zustand | 5.x | State management |
| next-intl | 3.x | Internationalisation FR/EN |
| NextAuth.js | 5.x | Authentification (email, Google) |

### Backend

| Techno | Version | Rôle |
|--------|---------|------|
| Python | 3.12+ | Runtime |
| FastAPI | 0.115+ | API REST async |
| uvicorn | 0.30+ | Serveur ASGI |
| pvlib | 0.11+ | Simulation PV (TMY, ModelChain) |
| networkx | 3.x | Modélisation graphe électrique (schéma unifilaire) |
| SQLAlchemy | 2.0+ | ORM |
| GeoAlchemy2 | 0.15+ | Support PostGIS dans SQLAlchemy |
| Alembic | 1.13+ | Migrations BDD |
| pydantic | 2.x | Validation données |
| pydantic-settings | 2.x | Configuration |
| WeasyPrint | 62+ | Génération PDF (HTML/CSS → PDF) |
| Redis (via redis-py) | 5.x | Cache simulations, sessions |
| Celery | 5.4+ | Tâches async (simulations longues, PDF) |
| passlib + python-jose | - | Hash passwords, JWT tokens |
| pandas / numpy | - | Traitement données PV |
| httpx | 0.27+ | Client HTTP async |

### Infrastructure

| Techno | Rôle |
|--------|------|
| PostgreSQL 16 + PostGIS | BDD relationnelle + géospatiale |
| Redis 7 | Cache + broker Celery |
| Docker Compose | Orchestration conteneurs |
| Traefik 3 | Reverse proxy, HTTPS auto (Let's Encrypt) |
| Portainer | UI gestion Docker sur VPS |

---

## 4. Modèle de données

### 4.1 Utilisateurs & Auth

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),          -- NULL si auth Google
    role VARCHAR(20) NOT NULL DEFAULT 'particular',
        -- 'particular' | 'installer' | 'admin'
    locale VARCHAR(5) NOT NULL DEFAULT 'fr',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE installer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    siret VARCHAR(50),                   -- ou NINEA au Sénégal
    logo_path VARCHAR(500),              -- chemin vers /data/uploads/logos/
    payment_terms TEXT,                  -- conditions de paiement texte libre
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);
```

### 4.2 Clients (fiches installateur)

```sql
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    monthly_kwh NUMERIC(10,2),           -- consommation mensuelle saisie
    senelec_tariff_tier VARCHAR(50),     -- tranche tarifaire
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.3 Projets

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
        -- 'draft' | 'study' | 'quote' | 'signed' | 'installed'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.4 Toiture & Panneaux

```sql
CREATE TABLE roof_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    polygon GEOMETRY(Polygon, 4326) NOT NULL,  -- WGS84
    orientation_deg NUMERIC(5,1),        -- azimuth 0-360
    tilt_deg NUMERIC(4,1),               -- inclinaison 0-90
    roof_type VARCHAR(30),               -- 'flat' | 'gable' | 'hip' | 'shed'
    area_m2 NUMERIC(10,2),
    zone_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE panel_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    roof_zone_id UUID NOT NULL REFERENCES roof_zones(id) ON DELETE CASCADE,
    panel_model_id UUID NOT NULL REFERENCES equipment(id),
    inverter_model_id UUID REFERENCES equipment(id),
    num_panels INTEGER NOT NULL,
    num_strings INTEGER NOT NULL DEFAULT 1,
    panels_per_string INTEGER NOT NULL,
    spacing_x NUMERIC(5,3) NOT NULL DEFAULT 0.02,  -- mètres
    spacing_y NUMERIC(5,3) NOT NULL DEFAULT 0.02,
    layout_geojson JSONB,                -- positions individuelles des panneaux
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.5 Catalogue Équipements

```sql
CREATE TABLE equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
        -- NULL = catalogue global (admin), sinon = perso installateur
    type VARCHAR(20) NOT NULL,           -- 'panel' | 'inverter'
    manufacturer VARCHAR(255) NOT NULL,
    model VARCHAR(255) NOT NULL,
    specs JSONB NOT NULL,                -- caractéristiques techniques complètes
    is_global BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour recherche rapide
CREATE INDEX idx_equipment_type ON equipment(type);
CREATE INDEX idx_equipment_global ON equipment(is_global);
CREATE INDEX idx_equipment_owner ON equipment(owner_id);
```

#### Specs JSONB — Panneau solaire

```json
{
  "pmax_w": 545,
  "voc_v": 49.62,
  "vmp_v": 41.52,
  "isc_a": 13.89,
  "imp_a": 13.13,
  "efficiency_pct": 21.1,
  "temp_coeff_pmax_pct_per_c": -0.350,
  "temp_coeff_voc_pct_per_c": -0.272,
  "temp_coeff_isc_pct_per_c": 0.048,
  "noct_c": 45,
  "cells": 144,
  "cell_type": "mono-PERC",
  "dimensions_mm": { "length": 2278, "width": 1134, "height": 35 },
  "weight_kg": 28.6,
  "warranty_years": 25
}
```

#### Specs JSONB — Onduleur

```json
{
  "max_pv_power_kw": 6.0,
  "max_pv_voltage_v": 600,
  "startup_voltage_v": 120,
  "mppt_voltage_range_v": "80-550",
  "rated_pv_voltage_v": 360,
  "max_input_current_a": 12.5,
  "max_short_circuit_current_a": 18.75,
  "num_mppt": 2,
  "strings_per_mppt": 1,
  "rated_ac_power_kw": 5.0,
  "max_ac_apparent_kva": 5.5,
  "rated_ac_current_a": 22.7,
  "max_ac_current_a": 25.0,
  "rated_output_voltage_v": 230,
  "rated_output_freq_hz": 50,
  "output_freq_range_hz": "45-55",
  "power_factor_range": "0.8 leading - 0.8 lagging",
  "thdi_pct": 3.0,
  "dc_injection_ma": 10,
  "max_efficiency_pct": 97.6,
  "euro_efficiency_pct": 97.0,
  "mppt_efficiency_pct": 99.9,
  "protection": {
    "anti_islanding": true,
    "overvoltage": true,
    "overcurrent": true,
    "ground_fault": true
  },
  "dimensions_mm": { "width": 361, "height": 522, "depth": 200 },
  "weight_kg": 16.5,
  "ip_rating": "IP65",
  "warranty_years": 10
}
```

### 4.6 Simulations

```sql
CREATE TABLE simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    panel_layout_id UUID NOT NULL REFERENCES panel_layouts(id) ON DELETE CASCADE,
    params JSONB NOT NULL,               -- lat, lon, tilt, azimuth, losses, albedo
    monthly_production JSONB NOT NULL,   -- [{"month":1,"kwh":320.5}, ...]
    annual_kwh NUMERIC(10,2) NOT NULL,
    specific_yield NUMERIC(8,2),         -- kWh/kWc
    peak_power_kwc NUMERIC(8,3),
    performance_ratio NUMERIC(5,3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.7 Analyse financière

```sql
CREATE TABLE financial_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    total_cost_fcfa BIGINT NOT NULL,
    annual_savings_fcfa BIGINT NOT NULL,
    senelec_tariff_applied JSONB,        -- détail tranches appliquées
    npv_fcfa BIGINT,
    irr_pct NUMERIC(5,2),
    payback_years NUMERIC(5,2),
    cashflow_25y JSONB,                  -- [{year, production, savings, cumulative}, ...]
    degradation_rate_pct NUMERIC(4,2) NOT NULL DEFAULT 0.5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.8 Schéma unifilaire

```sql
CREATE TABLE schematics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    schema_data JSONB NOT NULL,          -- React Flow nodes + edges
    networkx_graph JSONB,               -- graphe networkx sérialisé (validation)
    validation_errors JSONB,             -- erreurs détectées par le graphe
    svg_snapshot TEXT,                    -- SVG exporté pour PDF
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id)
);
```

### 4.9 Devis

```sql
CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    installer_id UUID NOT NULL REFERENCES users(id),
    reference VARCHAR(50),               -- ex: "DEV-2026-0042"
    line_items JSONB NOT NULL,
        -- [{"description":"JA Solar 545W","qty":10,"unit_price_fcfa":185000}, ...]
    subtotal_fcfa BIGINT NOT NULL,
    margin_pct NUMERIC(5,2),
    tax_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 18.0,  -- TVA Sénégal
    tax_amount_fcfa BIGINT NOT NULL,
    total_fcfa BIGINT NOT NULL,
    payment_terms TEXT,
    validity_days INTEGER NOT NULL DEFAULT 30,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
        -- 'draft' | 'sent' | 'accepted' | 'rejected'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.10 Rapports

```sql
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL,
        -- 'full_report' | 'quote_only' | 'schematic_only'
    file_path VARCHAR(500) NOT NULL,     -- /data/uploads/reports/
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 5. Architecture backend

### 5.1 Structure des fichiers

```
backend/
├── pyproject.toml
├── Dockerfile
├── alembic.ini
├── alembic/
│   └── versions/
│
├── app/
│   ├── main.py                  ← FastAPI app factory
│   ├── config.py                ← pydantic-settings
│   ├── database.py              ← Engine + SessionLocal
│   ├── dependencies.py          ← get_db, get_current_user
│   │
│   ├── api/                     ← Routes (routers)
│   │   ├── auth.py              ← POST /auth/login, /auth/register
│   │   ├── projects.py          ← CRUD /projects
│   │   ├── clients.py           ← CRUD /clients (installateur)
│   │   ├── equipment.py         ← CRUD /equipment
│   │   ├── roof_zones.py        ← CRUD /projects/{id}/zones
│   │   ├── panel_layouts.py     ← CRUD /projects/{id}/layouts
│   │   ├── simulation.py        ← POST /projects/{id}/simulate
│   │   ├── senelec.py           ← GET /senelec/tariffs, POST /senelec/bill
│   │   ├── financial.py         ← POST /projects/{id}/financial
│   │   ├── schematics.py       ← GET/PUT /projects/{id}/schematic
│   │   ├── quotes.py            ← CRUD /projects/{id}/quotes
│   │   ├── reports.py           ← POST /projects/{id}/report
│   │   └── admin.py             ← Admin routes
│   │
│   ├── models/                  ← SQLAlchemy models
│   │   ├── user.py
│   │   ├── project.py
│   │   ├── client.py
│   │   ├── roof_zone.py
│   │   ├── panel_layout.py
│   │   ├── equipment.py
│   │   ├── simulation.py
│   │   ├── financial.py
│   │   ├── schematic.py
│   │   ├── quote.py
│   │   └── report.py
│   │
│   ├── schemas/                 ← Pydantic request/response schemas
│   │   └── (mirrors models/)
│   │
│   ├── services/                ← Business logic
│   │   ├── pvlib_service.py     ← Simulation PV (pvlib ModelChain)
│   │   ├── calpinage.py         ← Algorithme placement panneaux
│   │   ├── senelec.py           ← Grille tarifaire + calcul facture
│   │   ├── financial.py         ← NPV, IRR, payback, cashflow
│   │   ├── schematic_graph.py   ← networkx : auto-génération + validation
│   │   ├── optimizer.py         ← Boucles optimisation tilt/azimuth/sizing
│   │   └── pdf.py               ← WeasyPrint : rapport, devis, schéma
│   │
│   ├── templates/               ← HTML templates pour WeasyPrint
│   │   ├── report.html
│   │   ├── quote.html
│   │   └── schematic.html
│   │
│   ├── data/                    ← Données statiques
│   │   ├── senelec_tariffs.json
│   │   └── default_equipment.json
│   │
│   └── tasks/                   ← Celery tasks
│       ├── simulation_task.py
│       └── report_task.py
│
└── tests/
    ├── conftest.py
    ├── test_auth.py
    ├── test_simulation.py
    ├── test_senelec.py
    ├── test_financial.py
    ├── test_schematic_graph.py
    └── test_equipment.py
```

### 5.2 Graph Engineering — Schéma unifilaire

Le service `schematic_graph.py` utilise `networkx` pour :

#### Auto-génération

```python
import networkx as nx

def generate_schematic(panel_layout, panel_specs, inverter_specs):
    """Génère un graphe électrique à partir de la configuration PV."""
    G = nx.DiGraph()

    # 1. Panneaux groupés en strings
    for s in range(panel_layout.num_strings):
        for p in range(panel_layout.panels_per_string):
            node_id = f"panel_{s}_{p}"
            G.add_node(node_id, type="panel", string=s,
                       specs={"voc": panel_specs.voc_v, "isc": panel_specs.isc_a})
        # Connecter panneaux en série dans chaque string
        for p in range(panel_layout.panels_per_string - 1):
            G.add_edge(f"panel_{s}_{p}", f"panel_{s}_{p+1}",
                       cable_type="dc", section_mm2=4)

    # 2. String combiners → coffret DC
    for s in range(panel_layout.num_strings):
        last_panel = f"panel_{s}_{panel_layout.panels_per_string - 1}"
        G.add_edge(last_panel, "dc_combiner", cable_type="dc")

    G.add_node("dc_combiner", type="junction_box")
    G.add_node("dc_surge", type="surge_protector", rating="type_2")
    G.add_node("dc_breaker", type="breaker",
               rating_a=calc_dc_breaker_rating(panel_specs, panel_layout))

    # 3. Onduleur
    G.add_node("inverter", type="inverter", specs=inverter_specs)

    # 4. Protections AC
    G.add_node("ac_breaker", type="breaker",
               rating_a=calc_ac_breaker_rating(inverter_specs))
    G.add_node("ac_surge", type="surge_protector", rating="type_2")
    G.add_node("ac_panel", type="junction_box")

    # 5. Compteur + réseau
    G.add_node("meter", type="bidirectional_meter")
    G.add_node("grid", type="senelec_grid")
    G.add_node("ground", type="ground")

    # Connecter DC → AC → réseau
    G.add_edge("dc_combiner", "dc_surge")
    G.add_edge("dc_surge", "dc_breaker")
    G.add_edge("dc_breaker", "inverter")
    G.add_edge("inverter", "ac_breaker")
    G.add_edge("ac_breaker", "ac_surge")
    G.add_edge("ac_surge", "ac_panel")
    G.add_edge("ac_panel", "meter")
    G.add_edge("meter", "grid")

    # Mise à la terre
    G.add_edge("dc_surge", "ground")
    G.add_edge("ac_surge", "ground")
    G.add_edge("inverter", "ground")

    return G
```

#### Validation électrique

```python
def validate_electrical(G, panel_specs, inverter_specs, panel_layout):
    """Valide le graphe électrique et retourne les erreurs."""
    errors = []

    # Tension string ≤ Vmax onduleur
    string_voc = panel_specs.voc_v * panel_layout.panels_per_string
    if string_voc > inverter_specs.max_pv_voltage_v:
        errors.append({
            "type": "overvoltage",
            "severity": "critical",
            "message": f"Tension string {string_voc}V > Vmax onduleur {inverter_specs.max_pv_voltage_v}V",
            "nodes": ["inverter"]
        })

    # Courant string ≤ Imax MPPT
    if panel_specs.isc_a > inverter_specs.max_short_circuit_current_a:
        errors.append({
            "type": "overcurrent",
            "severity": "critical",
            "message": f"Isc {panel_specs.isc_a}A > Imax MPPT {inverter_specs.max_short_circuit_current_a}A"
        })

    # Nb strings ≤ nb entrées
    max_strings = inverter_specs.num_mppt * inverter_specs.strings_per_mppt
    if panel_layout.num_strings > max_strings:
        errors.append({
            "type": "topology",
            "severity": "critical",
            "message": f"{panel_layout.num_strings} strings > {max_strings} entrées onduleur"
        })

    # Tension MPPT dans la plage
    string_vmp = panel_specs.vmp_v * panel_layout.panels_per_string
    mppt_min, mppt_max = parse_range(inverter_specs.mppt_voltage_range_v)
    if string_vmp < mppt_min or string_vmp > mppt_max:
        errors.append({
            "type": "mppt_range",
            "severity": "warning",
            "message": f"Vmp string {string_vmp}V hors plage MPPT [{mppt_min}-{mppt_max}]V"
        })

    # Nœuds non connectés
    for node in G.nodes():
        if G.degree(node) == 0:
            errors.append({
                "type": "floating",
                "severity": "warning",
                "message": f"Composant '{node}' non connecté"
            })

    # Calibre disjoncteur DC
    dc_breaker = G.nodes.get("dc_breaker", {})
    min_rating = panel_specs.isc_a * 1.25
    if dc_breaker.get("rating_a", 0) < min_rating:
        errors.append({
            "type": "protection",
            "severity": "warning",
            "message": f"Disjoncteur DC sous-dimensionné (min {min_rating:.1f}A)"
        })

    return errors
```

#### Conversion graphe → React Flow

```python
def graph_to_reactflow(G):
    """Convertit un graphe networkx en nodes + edges React Flow."""
    nodes = []
    edges = []

    # Positions auto (layout hiérarchique)
    pos = nx.drawing.nx_agraph.graphviz_layout(G, prog="dot")

    for node_id, data in G.nodes(data=True):
        nodes.append({
            "id": node_id,
            "type": data.get("type", "default"),
            "position": {"x": pos[node_id][0] * 2, "y": -pos[node_id][1] * 2},
            "data": {k: v for k, v in data.items() if k != "type"}
        })

    for source, target, data in G.edges(data=True):
        edges.append({
            "id": f"{source}-{target}",
            "source": source,
            "target": target,
            "data": data
        })

    return {"nodes": nodes, "edges": edges}
```

#### Propagation en cascade

Quand l'utilisateur modifie un composant, le graphe recalcule :
1. Changement onduleur → re-validation tensions/courants
2. Ajout/suppression panneau → recalcul strings + disjoncteurs
3. Modification string → recalcul section câbles + calibres

### 5.3 Boucles d'optimisation

```python
# services/optimizer.py

def optimize_tilt_azimuth(lat, lon, panel_specs):
    """Trouve l'inclinaison et orientation optimales."""
    best = {"tilt": 0, "azimuth": 180, "annual_kwh": 0}
    for tilt in range(0, 46, 5):
        for azimuth in range(0, 361, 10):
            kwh = quick_simulate(lat, lon, tilt, azimuth, panel_specs)
            if kwh > best["annual_kwh"]:
                best = {"tilt": tilt, "azimuth": azimuth, "annual_kwh": kwh}
    return best

def suggest_inverter(panel_layout, panel_specs, available_inverters):
    """Suggère l'onduleur optimal parmi les compatibles."""
    compatible = [
        inv for inv in available_inverters
        if is_compatible(panel_layout, panel_specs, inv)
    ]
    if not compatible:
        return None, "Aucun onduleur compatible"
    return max(compatible, key=lambda inv: inv.specs["euro_efficiency_pct"]), None

def optimize_panel_count(panel_specs, senelec_tariff, monthly_kwh, max_panels):
    """Trouve le nombre de panneaux pour le payback optimal."""
    results = []
    for n in range(1, max_panels + 1):
        fin = calculate_financial(n, panel_specs, senelec_tariff, monthly_kwh)
        results.append({"n_panels": n, **fin})
        if fin["payback_years"] <= 5:
            break
    return results
```

---

## 6. Architecture frontend

### 6.1 Structure des fichiers

```
frontend/
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── Dockerfile
│
├── messages/                        ← i18n
│   ├── fr.json
│   └── en.json
│
├── public/
│   └── uploads/ → symlink /data/uploads
│
├── src/
│   ├── app/
│   │   ├── [locale]/               ← Routing i18n
│   │   │   ├── layout.tsx          ← Layout principal (sidebar + header)
│   │   │   ├── page.tsx            ← Landing page
│   │   │   │
│   │   │   ├── auth/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── register/page.tsx
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx        ← Dashboard par rôle
│   │   │   │
│   │   │   ├── projects/
│   │   │   │   ├── page.tsx        ← Liste projets
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx    ← Vue d'ensemble projet
│   │   │   │       ├── map/page.tsx
│   │   │   │       ├── panels/page.tsx
│   │   │   │       ├── 3d/page.tsx
│   │   │   │       ├── simulation/page.tsx
│   │   │   │       ├── schematic/page.tsx
│   │   │   │       ├── quote/page.tsx
│   │   │   │       └── report/page.tsx
│   │   │   │
│   │   │   ├── equipment/
│   │   │   │   └── page.tsx        ← Catalogue
│   │   │   │
│   │   │   ├── clients/
│   │   │   │   └── page.tsx        ← Fiches clients (installer)
│   │   │   │
│   │   │   └── admin/
│   │   │       └── page.tsx        ← Panel admin
│   │   │
│   │   └── api/                    ← Next.js API routes (auth proxy)
│   │
│   ├── components/
│   │   ├── ui/                     ← shadcn/ui components
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Footer.tsx
│   │   ├── map/
│   │   │   ├── MapView.tsx         ← MapLibre container
│   │   │   ├── DrawingTools.tsx    ← Toolbar dessin polygone
│   │   │   ├── PanelLayer.tsx      ← Deck.gl couche panneaux
│   │   │   └── GeoSearch.tsx       ← Recherche adresse
│   │   ├── panels/
│   │   │   ├── PanelGrid.tsx       ← Grille calpinage
│   │   │   ├── PanelToolbar.tsx    ← Outils ajout/suppression
│   │   │   └── PanelBadge.tsx      ← Compteur panneaux
│   │   ├── viewer3d/
│   │   │   ├── RoofScene.tsx
│   │   │   ├── SolarPanels3D.tsx
│   │   │   ├── Building.tsx
│   │   │   └── Controls.tsx
│   │   ├── schematic/
│   │   │   ├── SchematicEditor.tsx  ← React Flow container
│   │   │   ├── nodes/              ← Nœuds custom
│   │   │   │   ├── PanelNode.tsx
│   │   │   │   ├── InverterNode.tsx
│   │   │   │   ├── BreakerNode.tsx
│   │   │   │   ├── SurgeNode.tsx
│   │   │   │   ├── MeterNode.tsx
│   │   │   │   ├── GridNode.tsx
│   │   │   │   └── GroundNode.tsx
│   │   │   ├── edges/
│   │   │   │   └── CableEdge.tsx    ← Arête custom (section, type)
│   │   │   ├── SymbolPalette.tsx    ← Bibliothèque symboles drag
│   │   │   └── ValidationPanel.tsx  ← Affichage erreurs
│   │   ├── charts/
│   │   │   ├── ProductionChart.tsx
│   │   │   ├── CashflowChart.tsx
│   │   │   └── SavingsChart.tsx
│   │   ├── quote/
│   │   │   ├── QuoteEditor.tsx
│   │   │   ├── LineItemTable.tsx
│   │   │   └── QuotePreview.tsx
│   │   └── equipment/
│   │       ├── PanelForm.tsx
│   │       ├── InverterForm.tsx
│   │       └── EquipmentTable.tsx
│   │
│   ├── lib/
│   │   ├── api.ts               ← Fetch wrapper (backend FastAPI)
│   │   ├── auth.ts              ← NextAuth config
│   │   ├── geo.ts               ← Helpers géospatial
│   │   └── solar.ts             ← Calculs côté client (preview)
│   │
│   ├── store/
│   │   ├── project.ts           ← Zustand : projet courant
│   │   ├── map.ts               ← Zustand : état carte
│   │   ├── schematic.ts         ← Zustand : état schéma unifilaire
│   │   └── equipment.ts         ← Zustand : catalogue
│   │
│   └── types/
│       ├── project.ts
│       ├── equipment.ts
│       ├── simulation.ts
│       ├── schematic.ts
│       └── quote.ts
```

---

## 7. API Endpoints

### Auth
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/auth/register` | Inscription email |
| POST | `/auth/login` | Connexion → JWT |
| GET | `/auth/me` | Profil utilisateur courant |

### Projects
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/projects` | Liste projets (filtré par user) |
| POST | `/projects` | Créer un projet |
| GET | `/projects/{id}` | Détail projet |
| PUT | `/projects/{id}` | Modifier projet |
| DELETE | `/projects/{id}` | Supprimer projet |

### Roof Zones
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/projects/{id}/zones` | Ajouter zone toit (GeoJSON polygon) |
| PUT | `/projects/{id}/zones/{zid}` | Modifier zone |
| DELETE | `/projects/{id}/zones/{zid}` | Supprimer zone |

### Panel Layouts
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/projects/{id}/layouts` | Créer layout (calpinage) |
| PUT | `/projects/{id}/layouts/{lid}` | Modifier layout |
| GET | `/projects/{id}/layouts` | Lister layouts |

### Equipment
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/equipment?type=panel` | Liste catalogue |
| POST | `/equipment` | Ajouter équipement |
| PUT | `/equipment/{id}` | Modifier |
| DELETE | `/equipment/{id}` | Supprimer |

### Simulation
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/projects/{id}/simulate` | Lancer simulation pvlib |
| GET | `/projects/{id}/simulations` | Historique simulations |
| POST | `/projects/{id}/optimize` | Optimisation tilt/azimuth |

### SENELEC
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/senelec/tariffs` | Grille tarifaire |
| POST | `/senelec/bill` | Calculer facture |
| POST | `/senelec/savings` | Calculer économies avec PV |

### Financial
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/projects/{id}/financial` | Analyse financière 25 ans |

### Schematic
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/projects/{id}/schematic` | Charger schéma unifilaire |
| PUT | `/projects/{id}/schematic` | Sauvegarder schéma |
| POST | `/projects/{id}/schematic/generate` | Auto-générer depuis config |
| POST | `/projects/{id}/schematic/validate` | Valider graphe électrique |

### Quotes
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/projects/{id}/quotes` | Créer devis |
| GET | `/projects/{id}/quotes` | Lister devis |
| PUT | `/projects/{id}/quotes/{qid}` | Modifier devis |
| PUT | `/projects/{id}/quotes/{qid}/status` | Changer statut |

### Reports
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/projects/{id}/report` | Générer rapport complet (PDF) |
| POST | `/projects/{id}/report/quote` | Générer devis seul (PDF) |
| POST | `/projects/{id}/report/schematic` | Générer schéma seul (PDF) |
| GET | `/reports/{id}/download` | Télécharger PDF |

### Clients (installer only)
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/clients` | Liste clients |
| POST | `/clients` | Ajouter client |
| PUT | `/clients/{id}` | Modifier client |
| DELETE | `/clients/{id}` | Supprimer client |

### Admin
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/admin/users` | Liste utilisateurs |
| GET | `/admin/stats` | Métriques plateforme |
| PUT | `/admin/users/{id}/role` | Changer rôle |

---

## 8. Déploiement Docker

### docker-compose.yml

```yaml
services:
  traefik:
    image: traefik:v3.1
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik-certs:/letsencrypt

  frontend:
    build: ./frontend
    labels:
      - "traefik.http.routers.frontend.rule=Host(`senpv.example.com`)"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
    environment:
      - NEXT_PUBLIC_API_URL=https://senpv.example.com/api
    depends_on:
      - backend

  backend:
    build: ./backend
    labels:
      - "traefik.http.routers.backend.rule=Host(`senpv.example.com`) && PathPrefix(`/api`)"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
    environment:
      - DATABASE_URL=postgresql+asyncpg://senpv:secret@postgres:5432/senpv
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=${SECRET_KEY}
    volumes:
      - uploads:/data/uploads
    depends_on:
      - postgres
      - redis

  celery-worker:
    build: ./backend
    command: celery -A app.tasks worker --loglevel=info
    environment:
      - DATABASE_URL=postgresql+asyncpg://senpv:secret@postgres:5432/senpv
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - uploads:/data/uploads
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgis/postgis:16-3.4
    environment:
      - POSTGRES_DB=senpv
      - POSTGRES_USER=senpv
      - POSTGRES_PASSWORD=secret
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

volumes:
  traefik-certs:
  pgdata:
  redisdata:
  uploads:
```

---

## 9. Prompts .md — Ordre d'exécution

| # | Prompt | Dépendances | Livrable |
|---|--------|-------------|----------|
| 00 | Project Setup | — | Repos Next.js + FastAPI + Docker |
| 01 | Database Schema | 00 | PostgreSQL + PostGIS + migrations |
| 02 | Auth | 00, 01 | NextAuth + JWT + rôles |
| 03 | i18n | 00 | next-intl FR/EN |
| 04 | Equipment Catalog | 01, 02 | CRUD panneaux/onduleurs + specs |
| 05 | Project Management | 01, 02 | CRUD projets + clients + statuts |
| 06 | Map & Roof Drawing | 00, 05 | MapLibre + dessin polygone |
| 07 | Panel Placement | 04, 06 | Calpinage + placement manuel |
| 08 | 3D Viewer | 07 | React Three Fiber intégré |
| 09 | PV Simulation | 07 | pvlib + cache Redis |
| 10 | SENELEC Billing | 05, 09 | Saisie conso + tarifs |
| 11 | Financial Analysis | 09, 10 | NPV, IRR, cashflow |
| 12 | Schematic Editor | 04, 07 | React Flow + networkx |
| 13 | Quote Builder | 04, 05, 12 | Devis + logo + PDF |
| 14 | Report Generator | 09, 11, 12, 13 | WeasyPrint rapport complet |
| 15 | Dashboard | 05, 09 | Dashboard par rôle |
| 16 | Deploy | Tous | Docker + Traefik + Portainer |
```
