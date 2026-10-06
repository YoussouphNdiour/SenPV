# 14 — Contract

> Contrat d'interface entre les modules SenPV : qui appelle quoi, avec quelles donnees.

---

## Contrats Backend (API <-> Services)

### Auth -> Tous les modules
```
Entree : JWT token dans Authorization header
Sortie : User object (id, email, name, role, locale)
Contrat : get_current_user() dependency injecte le user dans chaque route
Roles   : particular (acces propres projets), installer (+ clients/devis), admin (tout)
```

### Projects <-> Roof Zones <-> Panel Layouts
```
projects.user_id = current_user.id     (filtre par user)
roof_zones.project_id = projects.id    (cascade delete)
panel_layouts.roof_zone_id = zones.id  (cascade delete)

Contrat :
- Un projet a 0..N zones de toit
- Une zone a 0..N layouts de panneaux
- Supprimer un projet supprime tout (cascade)
- Un layout reference un panel_model_id et un inverter_model_id (FK -> equipment)
```

### Equipment -> Panel Layouts -> Simulation -> Financial
```
Flux de donnees :
equipment.specs (JSONB) --> panel_layouts (config) --> simulation (pvlib) --> financial (NPV/IRR)

Contrats :
- panel_layouts.panel_model_id DOIT exister dans equipment (type='panel')
- panel_layouts.inverter_model_id DOIT exister dans equipment (type='inverter')
- simulation.panel_layout_id DOIT avoir un layout valide
- financial.simulation_id DOIT avoir une simulation valide
```

### Simulation Service
```
Entree :
  - lat, lon : float (coordonnees WGS84)
  - tilt, azimuth : float (degres)
  - panel_specs : JSONB (pmax_w, voc_v, vmp_v, isc_a, gamma_pdc)
  - num_panels, num_strings, panels_per_string : int
  
Sortie :
  - annual_kwh : float
  - monthly_production : [{month: 1-12, kwh: float}]
  - specific_yield : float (kWh/kWc)
  - performance_ratio : float (0-1)
  - peak_power_kwc : float

Contrat gamma_pdc :
  gamma_pdc = specs.temp_coeff_pmax_pct_per_c / 100
  (datasheets en %/C, pvlib attend fraction/C — ADR-012)
```

### SENELEC Service
```
Entree :
  - monthly_kwh : float (consommation mensuelle)
  - tariff_tier : string (DPP | DMP | DGP | PP) — optionnel, auto-detecte

Sortie :
  - base_amount_fcfa : int
  - tva_fcfa : int (18%)
  - redevance_fcfa : int (872)
  - total_fcfa : int
  - breakdown : [{tier, kwh, amount}]

Contrat tarification progressive :
  0-150 kWh   -> 90.47 FCFA/kWh (DPP)
  151-250 kWh -> 101.64 FCFA/kWh (DMP)
  >250 kWh    -> 112.65 FCFA/kWh (DGP)
```

### Financial Service
```
Entree :
  - simulation : Simulation object (annual_kwh, peak_power_kwc)
  - total_cost_fcfa : int
  - annual_savings_fcfa : int
  - discount_rate : float (default 0.08)
  - inflation_rate : float (default 0.03)
  - degradation_rate : float (default 0.005)

Sortie :
  - npv_fcfa : int (Valeur Actuelle Nette)
  - irr_pct : float (Taux de Rendement Interne)
  - lcoe_fcfa_per_kwh : float (Cout de l'Energie Actualisee)
  - payback_years : float
  - cashflow_25y : [{year, production_kwh, savings_fcfa, cumulative_fcfa}]

Contrat degradation :
  production_annee_n = production_annee_1 * (1 - degradation)^(n-1)
  tarif_annee_n = tarif_base * (1 + inflation)^(n-1)
```

### Schematic Graph Service
```
Entree (generation) :
  - panel_layout : PanelLayout object
  - panel_specs : JSONB
  - inverter_specs : JSONB

Sortie (generation) :
  - nodes : [{id, type, position, data}]  (format React Flow)
  - edges : [{id, source, target, data}]

Entree (validation) :
  - networkx graph (DiGraph)
  - panel_specs, inverter_specs, panel_layout

Sortie (validation) :
  - errors : [{type, severity, message, nodes?}]
  - Types : overvoltage, overcurrent, topology, mppt_range, floating, protection
  - Severites : critical, warning

Contrat mppt_voltage_range_v :
  Peut etre string "80-550" ou liste [80, 550]
  Parser les deux formats
```

### Quote Service
```
Entree :
  - line_items : [{description, quantity, unit_price_fcfa}]
  - margin_pct : float (default 15.0)
  - tax_rate_pct : float (default 18.0)

Sortie :
  - subtotal_fcfa = sum(qty * unit_price)
  - margin_fcfa = subtotal * margin_pct / 100
  - total_ht_fcfa = subtotal + margin
  - tax_amount_fcfa = total_ht * tax_rate / 100
  - total_fcfa = total_ht + tax_amount

Contrat reference :
  Format : DEV-{YYYY}-{NNNN}
  NNNN : auto-incremente par installateur (pas global)
```

---

## Contrats Frontend <-> Backend

### API Client (`lib/api.ts`)
```typescript
// Toutes les requetes passent par api.ts
// Header Authorization: Bearer <token> ajoute automatiquement
// Base URL : process.env.NEXT_PUBLIC_API_URL

api.get('/projects')           -> Project[]
api.post('/projects', body)    -> Project
api.put('/projects/{id}', body) -> Project
api.delete('/projects/{id}')   -> void
```

### NextAuth <-> FastAPI
```
Frontend (NextAuth) appelle POST /auth/login
-> Recoit JWT access_token
-> Stocke dans la session NextAuth
-> Passe le token au backend via Authorization header

Le backend decode le JWT et retourne le user
Pas de sessions cote backend — stateless
```

### Zustand Stores <-> API
```
Flux :
  User action -> Zustand store dispatch -> API call -> Update store state -> Re-render

Stores :
  project.ts  : fetchProjects(), createProject(), updateProject()
  map.ts      : setMapMode(), addZone(), deleteZone()
  schematic.ts: loadSchematic(), updateNodes(), validate()
  equipment.ts: fetchEquipment(), createEquipment()
```

---

## Contrats inter-composants Frontend

### Map -> Panels -> 3D
```
MapView dessine le polygone (GeoJSON)
  -> Sauvegarde en API (POST /zones)
  -> PanelGrid recoit la zone et lance le calpinage
  -> Layout GeoJSON retourne au frontend
  -> RoofScene (3D) recoit les positions des panneaux
```

### Simulation -> Charts
```
Simulation retourne monthly_production [{month, kwh}]
  -> ProductionChart (Recharts BarChart)
  -> CashflowChart (Recharts LineChart) via financial

Financial retourne cashflow_25y [{year, cumulative}]
  -> CashflowChart + SavingsChart
```

### Schematic -> Report
```
SchematicEditor exporte SVG (svg_snapshot)
  -> Sauvegarde en API (PUT /schematic)
  -> Report Generator recupere le SVG
  -> Integre dans le PDF pleine page
```

---

## Invariants systeme

1. **Un user ne voit que ses propres projets** (filtre user_id)
2. **Un installateur ne voit que ses propres clients** (filtre installer_id)
3. **Cascade delete** : supprimer un projet supprime zones, layouts, simulations, financials, schematic, quotes, reports
4. **Les calculs financiers sont reproductibles** : memes parametres -> memes resultats
5. **Les specs JSONB doivent passer la validation Pydantic** avant sauvegarde
6. **gamma_pdc est toujours divise par 100** a l'entree de pvlib
7. **Les montants FCFA sont des entiers** (pas de centimes en FCFA)
