# Prompt 04 — Catalogue Équipements

## Contexte

SenPV gère un catalogue d'équipements solaires (panneaux PV et onduleurs) avec des caractéristiques techniques complètes. Deux niveaux : catalogue global (admin) visible par tous, et équipements personnalisés par installateur.

## Dépendances

- Prompt 01 (database — table `equipment`)
- Prompt 02 (auth — rôles et permissions)

## Tâches

### 1. Backend — CRUD Equipment

**`backend/app/api/equipment.py`** :

**GET `/equipment`**
- Query params : `type` (panel|inverter), `manufacturer`, `search`, `page`, `per_page`
- Retourne : équipements globaux + équipements perso de l'utilisateur courant
- Un particulier ne voit que les équipements globaux
- Un installateur voit les globaux + les siens
- Pagination

**POST `/equipment`**
- Rôle requis : installer ou admin
- Si admin et `is_global=true` → équipement global
- Si installer → `owner_id = current_user.id`, `is_global = false`
- Validation des specs JSONB selon le type (voir ci-dessous)

**PUT `/equipment/{id}`**
- Le owner ou un admin peut modifier
- Un installateur ne peut pas modifier un équipement global

**DELETE `/equipment/{id}`**
- Le owner ou un admin peut supprimer
- Vérifier qu'aucun `panel_layout` ne référence cet équipement avant suppression

### 2. Backend — Validation des specs

**`backend/app/schemas/equipment.py`** :

Créer des schémas Pydantic stricts pour valider les specs techniques :

**PanelSpecs** :
```python
class PanelSpecs(BaseModel):
    pmax_w: float = Field(gt=0, le=1000, description="Puissance max en Watt")
    voc_v: float = Field(gt=0, le=100, description="Tension circuit ouvert")
    vmp_v: float = Field(gt=0, le=100, description="Tension au point max")
    isc_a: float = Field(gt=0, le=30, description="Courant de court-circuit")
    imp_a: float = Field(gt=0, le=30, description="Courant au point max")
    efficiency_pct: float = Field(gt=0, le=30, description="Rendement %")
    temp_coeff_pmax_pct_per_c: float = Field(description="Coeff temp Pmax (%/°C)")
    temp_coeff_voc_pct_per_c: float = Field(description="Coeff temp Voc (%/°C)")
    temp_coeff_isc_pct_per_c: float = Field(description="Coeff temp Isc (%/°C)")
    noct_c: float = Field(default=45, description="NOCT en °C")
    cells: int = Field(gt=0, description="Nombre de cellules")
    cell_type: str = Field(default="mono-PERC")
    dimensions_mm: dict  # {length, width, height}
    weight_kg: float = Field(gt=0)
    warranty_years: int = Field(default=25, gt=0)
```

**InverterSpecs** :
```python
class InverterSpecs(BaseModel):
    # DC Input
    max_pv_power_kw: float = Field(gt=0)
    max_pv_voltage_v: float = Field(gt=0)
    startup_voltage_v: float = Field(gt=0)
    mppt_voltage_range_v: str  # "80-550"
    rated_pv_voltage_v: float = Field(gt=0)
    max_input_current_a: float = Field(gt=0)
    max_short_circuit_current_a: float = Field(gt=0)
    num_mppt: int = Field(gt=0)
    strings_per_mppt: int = Field(gt=0, default=1)
    
    # AC Output
    rated_ac_power_kw: float = Field(gt=0)
    max_ac_apparent_kva: float = Field(gt=0)
    rated_ac_current_a: float = Field(gt=0)
    max_ac_current_a: float = Field(gt=0)
    rated_output_voltage_v: float = Field(default=230)
    rated_output_freq_hz: float = Field(default=50)
    output_freq_range_hz: str = Field(default="45-55")
    power_factor_range: str = Field(default="0.8 leading - 0.8 lagging")
    thdi_pct: float = Field(ge=0, le=10)
    dc_injection_ma: float = Field(default=10)
    
    # Efficiency
    max_efficiency_pct: float = Field(gt=0, le=100)
    euro_efficiency_pct: float = Field(gt=0, le=100)
    mppt_efficiency_pct: float = Field(gt=0, le=100)
    
    # Physical
    dimensions_mm: dict  # {width, height, depth}
    weight_kg: float = Field(gt=0)
    ip_rating: str = Field(default="IP65")
    warranty_years: int = Field(default=10, gt=0)
```

### 3. Backend — Seed catalogue global

**`backend/app/services/seed_equipment.py`** :
- Au démarrage, si aucun équipement global n'existe, charger `default_equipment.json`
- Créer les entrées avec `is_global=true`, `owner_id=null`

### 4. Frontend — Page catalogue

**`frontend/src/app/[locale]/equipment/page.tsx`** :
- Deux onglets : "Panneaux solaires" / "Onduleurs"
- Table avec colonnes : Fabricant, Modèle, Specs clés (Pmax ou Pac), Global/Perso
- Filtres : fabricant (select), recherche texte
- Bouton "Ajouter" (visible pour installer/admin)
- Badge "Global" ou "Personnel" sur chaque ligne
- Actions : Modifier, Supprimer (si owner ou admin)

### 5. Frontend — Formulaires

**`frontend/src/components/equipment/PanelForm.tsx`** :
- Dialog/modal avec tous les champs PanelSpecs
- Groupes de champs :
  - Général : fabricant, modèle, type cellule
  - Électrique : Pmax, Voc, Vmp, Isc, Imp, rendement
  - Température : coefficients Pmax, Voc, Isc, NOCT
  - Physique : dimensions (L×l×H mm), poids
  - Garantie
- Validation en temps réel (Vmp < Voc, Imp < Isc, etc.)
- Bouton "Enregistrer"

**`frontend/src/components/equipment/InverterForm.tsx`** :
- Dialog/modal avec tous les champs InverterSpecs
- Groupes de champs :
  - DC Input : Puissance PV max, tension max, startup, plage MPPT, courants max, nb MPPT, strings/MPPT
  - AC Output : Puissance nominale, puissance apparente, courant nominal/max, tension, fréquence, facteur de puissance, THDi
  - Rendement : max, euro, MPPT
  - Physique : dimensions, poids, IP, garantie
- Validation en temps réel

**`frontend/src/components/equipment/EquipmentTable.tsx`** :
- Composant table réutilisable pour panneaux et onduleurs
- Colonnes adaptées selon le type
- Tri par colonne
- Actions par ligne

### 6. Frontend — Store

**`frontend/src/store/equipment.ts`** :
```typescript
interface EquipmentStore {
  panels: Equipment[];
  inverters: Equipment[];
  loading: boolean;
  fetchPanels: () => Promise<void>;
  fetchInverters: () => Promise<void>;
  addEquipment: (data: CreateEquipment) => Promise<void>;
  updateEquipment: (id: string, data: UpdateEquipment) => Promise<void>;
  deleteEquipment: (id: string) => Promise<void>;
}
```

## Critères d'acceptance

- [ ] Le catalogue global contient au moins 3 panneaux et 3 onduleurs (seed)
- [ ] Un admin peut ajouter/modifier/supprimer des équipements globaux
- [ ] Un installateur peut ajouter/modifier/supprimer ses équipements perso
- [ ] Un installateur ne peut PAS modifier un équipement global
- [ ] Un particulier voit le catalogue mais ne peut pas ajouter
- [ ] La validation des specs rejette les valeurs incohérentes (Vmp > Voc, etc.)
- [ ] La recherche/filtre fonctionne
- [ ] Suppression bloquée si l'équipement est utilisé dans un projet
- [ ] Tous les labels sont traduits FR/EN
- [ ] Le formulaire panneau affiche tous les champs techniques demandés
- [ ] Le formulaire onduleur affiche tous les champs techniques demandés

## Tests

- `test_equipment_crud.py` : CRUD complet
- `test_equipment_permissions.py` : accès par rôle
- `test_equipment_validation.py` : validation specs (valeurs limites, incohérences)
