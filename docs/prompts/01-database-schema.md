# Prompt 01 — Database Schema

## Contexte

Créer le modèle de données complet de SenPV avec SQLAlchemy 2.0 + GeoAlchemy2 + Alembic.
Le schéma SQL de référence est dans `docs/architecture.md` section 4.

## Dépendances

- Prompt 00 (project setup) doit être complété

## Tâches

### 1. Configurer Alembic

```bash
cd backend
alembic init alembic
```

Modifier `alembic/env.py` pour :
- Importer tous les modèles depuis `app.models`
- Utiliser `config.database_url` depuis `app.config`
- Support async (asyncpg)
- Importer les types GeoAlchemy2

Modifier `alembic.ini` :
- `sqlalchemy.url` pointant vers la variable d'env DATABASE_URL

### 2. Créer les modèles SQLAlchemy

Créer un modèle par fichier dans `backend/app/models/` :

**`user.py`** — Table `users`
- `id` : UUID, PK, default gen_random_uuid
- `email` : String(255), unique, not null
- `name` : String(255), not null
- `password_hash` : String(255), nullable (null si auth Google)
- `role` : String(20), not null, default 'particular' — enum: particular, installer, admin
- `locale` : String(5), not null, default 'fr'
- `is_active` : Boolean, default true
- `created_at` : DateTime(timezone=True), default now
- `updated_at` : DateTime(timezone=True), default now, onupdate now
- Relations : `installer_profile`, `projects`, `clients`, `equipment`

**`installer_profile.py`** — Table `installer_profiles`
- `id` : UUID, PK
- `user_id` : FK → users, unique, cascade delete
- `company_name` : String(255), not null
- `address` : Text, nullable
- `phone` : String(50), nullable
- `siret` : String(50), nullable (NINEA au Sénégal)
- `logo_path` : String(500), nullable
- `payment_terms` : Text, nullable
- Timestamps

**`client.py`** — Table `clients`
- `id` : UUID, PK
- `installer_id` : FK → users, cascade delete
- `name` : String(255), not null
- `address`, `phone`, `email` : nullable
- `monthly_kwh` : Numeric(10,2), nullable
- `senelec_tariff_tier` : String(50), nullable
- `notes` : Text, nullable
- Timestamps

**`project.py`** — Table `projects`
- `id` : UUID, PK
- `user_id` : FK → users, cascade delete
- `client_id` : FK → clients, SET NULL on delete, nullable
- `name` : String(255), not null
- `address` : Text, nullable
- `lat`, `lon` : Float, not null
- `status` : String(20), default 'draft' — enum: draft, study, quote, signed, installed
- `notes` : Text, nullable
- Timestamps
- Relations : `roof_zones`, `simulations`, `schematics`, `quotes`, `reports`

**`roof_zone.py`** — Table `roof_zones`
- `id` : UUID, PK
- `project_id` : FK → projects, cascade delete
- `polygon` : Geometry('POLYGON', srid=4326) — GeoAlchemy2
- `orientation_deg` : Numeric(5,1), nullable
- `tilt_deg` : Numeric(4,1), nullable
- `roof_type` : String(30), nullable — flat, gable, hip, shed
- `area_m2` : Numeric(10,2), nullable
- `zone_index` : Integer, default 0
- Timestamp created_at
- Relation : `panel_layouts`

**`panel_layout.py`** — Table `panel_layouts`
- `id` : UUID, PK
- `roof_zone_id` : FK → roof_zones, cascade delete
- `panel_model_id` : FK → equipment, not null
- `inverter_model_id` : FK → equipment, nullable
- `num_panels` : Integer, not null
- `num_strings` : Integer, default 1
- `panels_per_string` : Integer, not null
- `spacing_x`, `spacing_y` : Numeric(5,3), default 0.02
- `layout_geojson` : JSONB, nullable
- Timestamps

**`equipment.py`** — Table `equipment`
- `id` : UUID, PK
- `owner_id` : FK → users, cascade delete, nullable (null = global)
- `type` : String(20), not null — panel, inverter
- `manufacturer` : String(255), not null
- `model` : String(255), not null
- `specs` : JSONB, not null
- `is_global` : Boolean, default false
- Timestamps
- Index sur `type`, `is_global`, `owner_id`

**`simulation.py`** — Table `simulations`
- `id` : UUID, PK
- `project_id` : FK → projects, cascade delete
- `panel_layout_id` : FK → panel_layouts, cascade delete
- `params` : JSONB, not null
- `monthly_production` : JSONB, not null
- `annual_kwh` : Numeric(10,2), not null
- `specific_yield` : Numeric(8,2), nullable
- `peak_power_kwc` : Numeric(8,3), nullable
- `performance_ratio` : Numeric(5,3), nullable
- Timestamp created_at

**`financial.py`** — Table `financial_analyses`
- `id` : UUID, PK
- `simulation_id` : FK → simulations, cascade delete
- `total_cost_fcfa` : BigInteger, not null
- `annual_savings_fcfa` : BigInteger, not null
- `senelec_tariff_applied` : JSONB, nullable
- `npv_fcfa` : BigInteger, nullable
- `irr_pct` : Numeric(5,2), nullable
- `payback_years` : Numeric(5,2), nullable
- `cashflow_25y` : JSONB, nullable
- `degradation_rate_pct` : Numeric(4,2), default 0.5
- Timestamp created_at

**`schematic.py`** — Table `schematics`
- `id` : UUID, PK
- `project_id` : FK → projects, cascade delete, unique
- `schema_data` : JSONB, not null (React Flow nodes + edges)
- `networkx_graph` : JSONB, nullable
- `validation_errors` : JSONB, nullable
- `svg_snapshot` : Text, nullable
- Timestamps

**`quote.py`** — Table `quotes`
- `id` : UUID, PK
- `project_id` : FK → projects, cascade delete
- `installer_id` : FK → users, not null
- `reference` : String(50), nullable
- `line_items` : JSONB, not null
- `subtotal_fcfa` : BigInteger, not null
- `margin_pct` : Numeric(5,2), nullable
- `tax_rate_pct` : Numeric(5,2), default 18.0
- `tax_amount_fcfa` : BigInteger, not null
- `total_fcfa` : BigInteger, not null
- `payment_terms` : Text, nullable
- `validity_days` : Integer, default 30
- `status` : String(20), default 'draft'
- Timestamps

**`report.py`** — Table `reports`
- `id` : UUID, PK
- `project_id` : FK → projects, cascade delete
- `type` : String(30), not null — full_report, quote_only, schematic_only
- `file_path` : String(500), not null
- `generated_at` : DateTime(timezone=True), default now

### 3. Créer `app/models/__init__.py`

Importer tous les modèles pour qu'Alembic les détecte :
```python
from app.models.user import User, InstallerProfile
from app.models.client import Client
from app.models.project import Project
from app.models.roof_zone import RoofZone
from app.models.panel_layout import PanelLayout
from app.models.equipment import Equipment
from app.models.simulation import Simulation
from app.models.financial import FinancialAnalysis
from app.models.schematic import Schematic
from app.models.quote import Quote
from app.models.report import Report
```

### 4. Générer la migration initiale

```bash
cd backend
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

### 5. Créer les schémas Pydantic

Dans `backend/app/schemas/`, créer un fichier par domaine avec les schemas Create, Update, Read pour chaque modèle. Utiliser `model_config = ConfigDict(from_attributes=True)`.

### 6. Données initiales

Créer `backend/app/data/default_equipment.json` avec au moins :
- 3 panneaux solaires courants au Sénégal (JA Solar 545W, Canadian Solar 550W, Jinko 540W)
- 3 onduleurs courants (Huawei SUN2000-5KTL, Growatt MIN 5000TL-X, Sungrow SG5.0RS)

Avec les specs JSONB complètes telles que définies dans `docs/architecture.md` section 4.5.

Créer `backend/app/data/senelec_tariffs.json` :
```json
{
  "currency": "FCFA",
  "tariffs": [
    {"tier": "DPP", "description": "Domestique Petite Puissance", "max_kwh": 150, "price_per_kwh": 90.47},
    {"tier": "DMP", "description": "Domestique Moyenne Puissance", "max_kwh": 250, "price_per_kwh": 101.64},
    {"tier": "DGP", "description": "Domestique Grande Puissance", "max_kwh": null, "price_per_kwh": 112.65},
    {"tier": "PP", "description": "Professionnel", "max_kwh": null, "price_per_kwh": 118.00}
  ],
  "taxes": {
    "tva_pct": 18.0,
    "redevance_mensuelle_fcfa": 872
  }
}
```

## Critères d'acceptance

- [ ] `alembic upgrade head` crée toutes les tables sans erreur
- [ ] PostGIS activé : `SELECT PostGIS_Version();` retourne une version
- [ ] Table `roof_zones` a une colonne geometry de type POLYGON, SRID 4326
- [ ] Table `equipment` a un index sur `type`, `is_global`, `owner_id`
- [ ] Tous les FK avec cascade delete fonctionnent
- [ ] `alembic downgrade -1` puis `alembic upgrade head` fonctionne
- [ ] Les schémas Pydantic valident les données correctement
- [ ] `default_equipment.json` contient 3 panneaux et 3 onduleurs avec specs complètes
- [ ] `senelec_tariffs.json` contient les tranches DPP, DMP, DGP, PP
