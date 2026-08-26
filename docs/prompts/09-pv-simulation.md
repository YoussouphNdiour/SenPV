# Prompt 09 — Simulation PV (pvlib)

## Contexte

Simulation de la production photovoltaïque avec pvlib. C'est le cœur technique de SenPV : à partir de la localisation, l'orientation, l'inclinaison, et les specs du panneau, pvlib calcule la production mensuelle et annuelle en kWh.

## Dépendances

- Prompt 07 (panel placement — layout avec nb panneaux, orientation, inclinaison)

## Tâches

### 1. Backend — Service pvlib

**`backend/app/services/pvlib_service.py`** :

```python
import pvlib
from pvlib.modelchain import ModelChain
from pvlib.pvsystem import PVSystem
from pvlib.location import Location
from pvlib.temperature import TEMPERATURE_MODEL_PARAMETERS

def simulate_pv(
    lat: float, lon: float,
    tilt: float, azimuth: float,
    panel_specs: dict,
    num_panels: int,
    num_strings: int,
    panels_per_string: int,
    inverter_specs: dict | None = None,
    losses_pct: float = 14.0,
    albedo: float = 0.2
) -> dict:
    """
    Simule la production PV annuelle avec pvlib.
    
    Returns:
        {
            "monthly_production": [{"month": 1, "kwh": 320.5}, ...],
            "annual_kwh": 4250.0,
            "specific_yield": 1650.0,  # kWh/kWc
            "peak_power_kwc": 2.725,
            "performance_ratio": 0.82
        }
    """
    # 1. Localisation
    location = Location(lat, lon, tz='Africa/Dakar', altitude=30)
    
    # 2. Données météo TMY (Typical Meteorological Year)
    #    Utiliser pvlib.iotools pour récupérer les données PVGIS
    #    ou fichier TMY local pour Dakar si hors-ligne
    tmy_data, _, _, _ = pvlib.iotools.get_pvgis_tmy(lat, lon, map_variables=True)
    
    # 3. Définir le module PV depuis les specs
    module_parameters = {
        'pdc0': panel_specs['pmax_w'],
        'v_mp': panel_specs['vmp_v'],
        'i_mp': panel_specs['imp_a'],
        'v_oc': panel_specs['voc_v'],
        'i_sc': panel_specs['isc_a'],
        'alpha_sc': panel_specs['temp_coeff_isc_pct_per_c'] / 100 * panel_specs['isc_a'],
        'beta_oc': panel_specs['temp_coeff_voc_pct_per_c'] / 100 * panel_specs['voc_v'],
        'gamma_pdc': panel_specs['temp_coeff_pmax_pct_per_c'],
        'cells_in_series': panel_specs.get('cells', 72),
    }
    
    # 4. Définir l'onduleur (si fourni) ou utiliser un onduleur générique
    if inverter_specs:
        inverter_parameters = {
            'pdc0': inverter_specs['max_pv_power_kw'] * 1000,
            'eta_inv_nom': inverter_specs['euro_efficiency_pct'] / 100,
        }
    else:
        # Onduleur générique 97% efficiency
        inverter_parameters = {
            'pdc0': panel_specs['pmax_w'] * num_panels * 1.2,
            'eta_inv_nom': 0.97,
        }
    
    # 5. Système PV
    system = PVSystem(
        surface_tilt=tilt,
        surface_azimuth=azimuth,
        module_parameters=module_parameters,
        inverter_parameters=inverter_parameters,
        strings_per_inverter=num_strings,
        modules_per_string=panels_per_string,
        temperature_model_parameters=TEMPERATURE_MODEL_PARAMETERS['sapm']['open_rack_glass_glass'],
        losses_parameters={'soiling': 2, 'shading': 3, 'snow': 0,
                          'mismatch': 2, 'wiring': 2, 'connections': 0.5,
                          'lid': 1.5, 'nameplate_rating': 1, 'age': 0,
                          'availability': 3}
    )
    
    # 6. ModelChain
    mc = ModelChain(system, location,
                    aoi_model='physical',
                    spectral_model='no_loss')
    mc.run_model(tmy_data)
    
    # 7. Résultats
    ac_power = mc.results.ac
    monthly = ac_power.resample('M').sum() / 1000  # Wh → kWh
    annual_kwh = monthly.sum()
    peak_kwc = panel_specs['pmax_w'] * num_panels / 1000
    specific_yield = annual_kwh / peak_kwc if peak_kwc > 0 else 0
    
    return {
        "monthly_production": [
            {"month": i+1, "kwh": round(float(monthly.iloc[i]), 1)}
            for i in range(12)
        ],
        "annual_kwh": round(float(annual_kwh), 1),
        "specific_yield": round(float(specific_yield), 1),
        "peak_power_kwc": round(peak_kwc, 3),
        "performance_ratio": round(float(annual_kwh / (peak_kwc * 1800)) if peak_kwc > 0 else 0, 3)
    }
```

### 2. Backend — Fallback sans TMY

Si `get_pvgis_tmy()` échoue (pas d'internet, API down) :
- Utiliser une estimation simplifiée basée sur l'irradiation moyenne de Dakar (~2000 kWh/m²/an)
- Formule : `annual_kwh = peak_kwc × specific_yield_estimate × (1 - losses/100)`
- `specific_yield_estimate = 1650` kWh/kWc pour Dakar
- Log un warning pour informer que le fallback est utilisé

### 3. Backend — Cache Redis

- Clé de cache : hash de `(lat, lon, tilt, azimuth, panel_model_id, num_panels, num_strings)`
- TTL : 24h (les données TMY ne changent pas souvent)
- Avant de lancer pvlib, vérifier le cache
- Stocker le résultat complet en JSON

### 4. Backend — API Simulation

**`backend/app/api/simulation.py`** :

**POST `/projects/{id}/simulate`**
- Body optionnel : `{ panel_layout_id?, losses_pct?, albedo? }`
- Si `panel_layout_id` non fourni, utiliser le premier layout du projet
- Charger le layout, la zone de toit (tilt, azimuth), le panneau et l'onduleur
- Appeler `simulate_pv()`
- Sauvegarder en BDD (table `simulations`)
- Retourner les résultats

**GET `/projects/{id}/simulations`**
- Historique des simulations du projet (triées par date desc)

**POST `/projects/{id}/optimize`**
- Appeler `optimizer.optimize_tilt_azimuth()` (voir architecture.md §5.3)
- Retourner l'inclinaison et l'orientation optimales
- Cache le résultat (même localisation = même optimum)

### 5. Backend — Celery task

**`backend/app/tasks/simulation_task.py`** :
- Task Celery pour les simulations longues
- L'API POST `/simulate` peut retourner un `task_id` pour les simulations avec optimisation
- GET `/tasks/{task_id}/status` → polling du statut

### 6. Frontend — Page simulation

**`frontend/src/app/[locale]/projects/[id]/simulation/page.tsx`** :
- Bouton "Lancer la simulation" (désactivé si pas de panneaux placés)
- Spinner pendant le calcul
- Résultats affichés :
  - Carte de résumé : Production annuelle (kWh), Puissance crête (kWc), Productivité (kWh/kWc), Ratio performance
  - Graphique barres : production mensuelle (Recharts BarChart)
  - Bouton "Optimiser inclinaison/orientation" → affiche la recommandation

### 7. Frontend — Graphiques

**`frontend/src/components/charts/ProductionChart.tsx`** :
- Recharts BarChart avec 12 barres (mois)
- Axe X : mois (Jan-Déc), traduit selon la locale
- Axe Y : kWh
- Couleur : gradient solaire (jaune → orange)
- Tooltip avec la valeur exacte
- Responsive

### 8. Frontend — Historique simulations

- Liste des simulations passées avec date, paramètres, production annuelle
- Clic → affiche les résultats détaillés
- Comparer deux simulations (optionnel, futur)

## Critères d'acceptance

- [ ] La simulation pvlib retourne la production mensuelle et annuelle
- [ ] Les specs du panneau (Voc, Isc, coefficients temp) sont utilisées par pvlib
- [ ] Les specs de l'onduleur (si fourni) sont utilisées
- [ ] Le fallback sans TMY fonctionne et produit une estimation raisonnable
- [ ] Le cache Redis évite les recalculs identiques
- [ ] Le graphique de production mensuelle s'affiche (Recharts)
- [ ] Les résultats sont sauvegardés en BDD
- [ ] L'optimisation tilt/azimuth retourne des valeurs cohérentes pour Dakar (~15° tilt, ~180° azimuth)
- [ ] Le bouton "Simuler" est désactivé si aucun panneau n'est placé
- [ ] Spinner pendant le calcul
- [ ] Labels traduits FR/EN

## Tests

- `test_simulation.py` : simulation avec paramètres Dakar, résultats dans une plage raisonnable
- `test_pvlib_service.py` : test unitaire du service (mock TMY data)
- `test_optimizer.py` : optimisation retourne des valeurs cohérentes
- `test_cache.py` : cache Redis hit/miss
