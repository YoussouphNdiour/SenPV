# 03 — Data Model

> Schema de donnees complet de SenPV : 12 tables PostgreSQL + PostGIS.

---

## Vue d'ensemble

```
users ─────────── installer_profiles (1:1)
  │
  ├── clients (1:N)
  ├── equipment (1:N, nullable = global)
  └── projects (1:N)
        │
        ├── roof_zones (1:N)
        │     └── panel_layouts (1:N)
        │           └── simulations (1:N)
        │                 └── financial_analyses (1:N)
        │
        ├── schematics (1:1)
        ├── quotes (1:N)
        └── reports (1:N)
```

---

## Tables

### users
| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | UUID | PK, gen_random_uuid |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| name | VARCHAR(255) | NOT NULL |
| password_hash | VARCHAR(255) | NULLABLE (null si Google OAuth) |
| role | VARCHAR(20) | NOT NULL, default 'particular' |
| locale | VARCHAR(5) | NOT NULL, default 'fr' |
| is_active | BOOLEAN | default true |
| created_at | TIMESTAMPTZ | default now() |
| updated_at | TIMESTAMPTZ | default now() |

Roles : `particular`, `installer`, `admin`

### installer_profiles
| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK -> users, UNIQUE, CASCADE DELETE |
| company_name | VARCHAR(255) | NOT NULL |
| address | TEXT | NULLABLE |
| phone | VARCHAR(50) | NULLABLE |
| siret | VARCHAR(50) | NULLABLE (NINEA au Senegal) |
| logo_path | VARCHAR(500) | NULLABLE |
| payment_terms | TEXT | NULLABLE |
| created_at / updated_at | TIMESTAMPTZ | |

### clients
| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | UUID | PK |
| installer_id | UUID | FK -> users, CASCADE DELETE |
| name | VARCHAR(255) | NOT NULL |
| address | TEXT | NULLABLE |
| phone | VARCHAR(50) | NULLABLE |
| email | VARCHAR(255) | NULLABLE |
| monthly_kwh | NUMERIC(10,2) | NULLABLE |
| senelec_tariff_tier | VARCHAR(50) | NULLABLE |
| notes | TEXT | NULLABLE |
| created_at / updated_at | TIMESTAMPTZ | |

### projects
| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK -> users, CASCADE DELETE |
| client_id | UUID | FK -> clients, SET NULL, NULLABLE |
| name | VARCHAR(255) | NOT NULL |
| address | TEXT | NULLABLE |
| lat | DOUBLE PRECISION | NOT NULL |
| lon | DOUBLE PRECISION | NOT NULL |
| status | VARCHAR(20) | default 'draft' |
| notes | TEXT | NULLABLE |
| created_at / updated_at | TIMESTAMPTZ | |

Statuts : `draft`, `study`, `quote`, `signed`, `installed`

### roof_zones
| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | UUID | PK |
| project_id | UUID | FK -> projects, CASCADE DELETE |
| polygon | GEOMETRY(Polygon, 4326) | NOT NULL (PostGIS) |
| orientation_deg | NUMERIC(5,1) | NULLABLE (azimuth 0-360) |
| tilt_deg | NUMERIC(4,1) | NULLABLE (0-90) |
| roof_type | VARCHAR(30) | NULLABLE |
| area_m2 | NUMERIC(10,2) | NULLABLE |
| zone_index | INTEGER | default 0 |
| created_at | TIMESTAMPTZ | |

Types de toit : `flat`, `gable`, `hip`, `shed`

### panel_layouts
| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | UUID | PK |
| roof_zone_id | UUID | FK -> roof_zones, CASCADE DELETE |
| panel_model_id | UUID | FK -> equipment, NOT NULL |
| inverter_model_id | UUID | FK -> equipment, NULLABLE |
| num_panels | INTEGER | NOT NULL |
| num_strings | INTEGER | default 1 |
| panels_per_string | INTEGER | NOT NULL |
| spacing_x | NUMERIC(5,3) | default 0.02 (metres) |
| spacing_y | NUMERIC(5,3) | default 0.02 |
| layout_geojson | JSONB | NULLABLE |
| created_at / updated_at | TIMESTAMPTZ | |

### equipment
| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | UUID | PK |
| owner_id | UUID | FK -> users, CASCADE DELETE, NULLABLE |
| type | VARCHAR(20) | NOT NULL |
| manufacturer | VARCHAR(255) | NOT NULL |
| model | VARCHAR(255) | NOT NULL |
| specs | JSONB | NOT NULL |
| is_global | BOOLEAN | default false |
| created_at / updated_at | TIMESTAMPTZ | |

Types : `panel`, `inverter`. Si `owner_id` est NULL et `is_global` est true -> catalogue global (admin).

Index : `idx_equipment_type`, `idx_equipment_global`, `idx_equipment_owner`

### simulations
| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | UUID | PK |
| project_id | UUID | FK -> projects, CASCADE DELETE |
| panel_layout_id | UUID | FK -> panel_layouts, CASCADE DELETE |
| params | JSONB | NOT NULL |
| monthly_production | JSONB | NOT NULL |
| annual_kwh | NUMERIC(10,2) | NOT NULL |
| specific_yield | NUMERIC(8,2) | NULLABLE |
| peak_power_kwc | NUMERIC(8,3) | NULLABLE |
| performance_ratio | NUMERIC(5,3) | NULLABLE |
| created_at | TIMESTAMPTZ | |

### financial_analyses
| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | UUID | PK |
| simulation_id | UUID | FK -> simulations, CASCADE DELETE |
| total_cost_fcfa | BIGINT | NOT NULL |
| annual_savings_fcfa | BIGINT | NOT NULL |
| senelec_tariff_applied | JSONB | NULLABLE |
| npv_fcfa | BIGINT | NULLABLE |
| irr_pct | NUMERIC(5,2) | NULLABLE |
| payback_years | NUMERIC(5,2) | NULLABLE |
| cashflow_25y | JSONB | NULLABLE |
| degradation_rate_pct | NUMERIC(4,2) | default 0.5 |
| created_at | TIMESTAMPTZ | |

### schematics
| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | UUID | PK |
| project_id | UUID | FK -> projects, CASCADE DELETE, UNIQUE |
| schema_data | JSONB | NOT NULL (React Flow nodes + edges) |
| networkx_graph | JSONB | NULLABLE |
| validation_errors | JSONB | NULLABLE |
| svg_snapshot | TEXT | NULLABLE |
| created_at / updated_at | TIMESTAMPTZ | |

### quotes
| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | UUID | PK |
| project_id | UUID | FK -> projects, CASCADE DELETE |
| installer_id | UUID | FK -> users, NOT NULL |
| reference | VARCHAR(50) | NULLABLE (DEV-YYYY-NNNN) |
| line_items | JSONB | NOT NULL |
| subtotal_fcfa | BIGINT | NOT NULL |
| margin_pct | NUMERIC(5,2) | NULLABLE |
| tax_rate_pct | NUMERIC(5,2) | default 18.0 |
| tax_amount_fcfa | BIGINT | NOT NULL |
| total_fcfa | BIGINT | NOT NULL |
| payment_terms | TEXT | NULLABLE |
| validity_days | INTEGER | default 30 |
| status | VARCHAR(20) | default 'draft' |
| created_at / updated_at | TIMESTAMPTZ | |

Statuts devis : `draft`, `sent`, `accepted`, `rejected`

### reports
| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | UUID | PK |
| project_id | UUID | FK -> projects, CASCADE DELETE |
| type | VARCHAR(30) | NOT NULL |
| file_path | VARCHAR(500) | NOT NULL |
| generated_at | TIMESTAMPTZ | default now() |

Types rapport : `full_report`, `quote_only`, `schematic_only`

---

## Specs JSONB — Panneau solaire

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

## Specs JSONB — Onduleur

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

---

## Donnees seed

### Panneaux pre-charges
1. JA Solar JAM72S30-545/MR (545W)
2. Canadian Solar CS6W-550MS (550W)
3. Jinko JKM540M-72HL4-V (540W)

### Onduleurs pre-charges
1. Huawei SUN2000-5KTL-M1 (5kW)
2. Growatt MIN 5000TL-X (5kW)
3. Sungrow SG5.0RS (5kW)

### Tarifs SENELEC
| Tranche | Description | Seuil kWh | Prix/kWh (FCFA) |
|---------|-------------|-----------|-----------------|
| DPP | Domestique Petite Puissance | 0-150 | 90.47 |
| DMP | Domestique Moyenne Puissance | 151-250 | 101.64 |
| DGP | Domestique Grande Puissance | >250 | 112.65 |
| PP | Professionnel | illimite | 118.00 |

TVA : 18% | Redevance mensuelle : 872 FCFA

---

## Notes techniques

- **PostGIS** : utilise pour les colonnes `GEOMETRY(Polygon, 4326)` sur `roof_zones`
- **JSONB** : utilise pour les specs equipements, params simulation, schema unifilaire, line items devis, cashflow
- **UUID** : toutes les PKs sont des UUID (gen_random_uuid)
- **Cascade delete** : toutes les FK cascadent sauf `client_id` sur `projects` (SET NULL)
- **SQLite tests** : les tests utilisent SQLite en memoire (pas de PostGIS) — ADR-008
