# Prompt 11 — Analyse Financière

## Contexte

Analyse financière complète sur 25 ans : coût total de l'installation, économies SENELEC, VAN (NPV), TRI (IRR), délai de retour sur investissement (payback), et courbe de flux de trésorerie cumulé.

## Dépendances

- Prompt 09 (simulation — production annuelle kWh)
- Prompt 10 (SENELEC — économies annuelles FCFA)

## Tâches

### 1. Backend — Service financier

**`backend/app/services/financial.py`** :

```python
import numpy_financial as npf  # ou calcul manuel

def calculate_financial_analysis(
    total_cost_fcfa: int,
    annual_production_kwh: float,
    annual_savings_fcfa: int,
    degradation_rate_pct: float = 0.5,
    discount_rate_pct: float = 8.0,
    inflation_rate_pct: float = 2.0,
    maintenance_annual_fcfa: int = 0,
    project_lifetime_years: int = 25
) -> dict:
    """
    Analyse financière complète sur la durée de vie du projet.
    
    - La production décroît chaque année (dégradation : -0.5%/an)
    - Les tarifs SENELEC augmentent (inflation : +2%/an)
    - Maintenance annuelle optionnelle
    
    Returns:
        {
            "total_cost_fcfa": 5500000,
            "annual_savings_year1_fcfa": 420000,
            "payback_years": 8.2,
            "npv_fcfa": 2800000,
            "irr_pct": 15.3,
            "roi_pct": 180.5,
            "lcoe_fcfa_per_kwh": 42.5,
            "cashflow_25y": [
                {
                    "year": 0,
                    "production_kwh": 0,
                    "savings_fcfa": 0,
                    "maintenance_fcfa": 0,
                    "net_cashflow_fcfa": -5500000,
                    "cumulative_fcfa": -5500000
                },
                {
                    "year": 1,
                    "production_kwh": 4250,
                    "savings_fcfa": 420000,
                    "maintenance_fcfa": 50000,
                    "net_cashflow_fcfa": 370000,
                    "cumulative_fcfa": -5130000
                },
                ...
            ]
        }
    """
    cashflow = []
    cumulative = -total_cost_fcfa
    
    # Year 0 : investissement
    cashflow.append({
        "year": 0,
        "production_kwh": 0,
        "savings_fcfa": 0,
        "maintenance_fcfa": 0,
        "net_cashflow_fcfa": -total_cost_fcfa,
        "cumulative_fcfa": cumulative
    })
    
    payback_year = None
    net_cashflows = [-total_cost_fcfa]
    
    for year in range(1, project_lifetime_years + 1):
        # Production dégradée
        prod = annual_production_kwh * (1 - degradation_rate_pct / 100) ** (year - 1)
        
        # Économies avec inflation des tarifs
        savings = annual_savings_fcfa * (1 + inflation_rate_pct / 100) ** (year - 1)
        
        # Maintenance
        maint = maintenance_annual_fcfa
        
        net = savings - maint
        cumulative += net
        net_cashflows.append(net)
        
        cashflow.append({
            "year": year,
            "production_kwh": round(prod, 1),
            "savings_fcfa": round(savings),
            "maintenance_fcfa": maint,
            "net_cashflow_fcfa": round(net),
            "cumulative_fcfa": round(cumulative)
        })
        
        if payback_year is None and cumulative >= 0:
            # Interpolation linéaire pour le payback exact
            prev = cashflow[-2]["cumulative_fcfa"]
            payback_year = round(year - 1 + abs(prev) / net, 1)
    
    # NPV
    npv = sum(cf / (1 + discount_rate_pct/100)**y 
              for y, cf in enumerate(net_cashflows))
    
    # IRR (Newton-Raphson ou numpy_financial)
    try:
        irr = npf.irr(net_cashflows) * 100
    except:
        irr = None
    
    # LCOE (Levelized Cost of Energy)
    total_production = sum(
        annual_production_kwh * (1 - degradation_rate_pct/100)**(y-1)
        for y in range(1, project_lifetime_years + 1)
    )
    lcoe = total_cost_fcfa / total_production if total_production > 0 else 0
    
    # ROI
    total_savings = sum(cf["savings_fcfa"] for cf in cashflow[1:])
    roi = ((total_savings - total_cost_fcfa) / total_cost_fcfa) * 100
    
    return {
        "total_cost_fcfa": total_cost_fcfa,
        "annual_savings_year1_fcfa": annual_savings_fcfa,
        "payback_years": payback_year,
        "npv_fcfa": round(npv),
        "irr_pct": round(irr, 1) if irr else None,
        "roi_pct": round(roi, 1),
        "lcoe_fcfa_per_kwh": round(lcoe, 1),
        "cashflow_25y": cashflow
    }
```

### 2. Backend — API Financial

**`backend/app/api/financial.py`** :

**POST `/projects/{id}/financial`**
- Body : `{ total_cost_fcfa, maintenance_annual_fcfa?, degradation_rate_pct?, discount_rate_pct?, inflation_rate_pct? }`
- Charger la dernière simulation du projet (annual_kwh)
- Charger les économies SENELEC (annual_savings)
- Appeler `calculate_financial_analysis()`
- Sauvegarder en BDD (table `financial_analyses`)
- Retourner les résultats

### 3. Frontend — Page analyse financière

Intégrée dans la page simulation ou dans un onglet séparé :

**Section "Coût de l'installation"** :
- Input : coût total (FCFA) — à saisir par l'utilisateur
- Input : maintenance annuelle (FCFA, optionnel, défaut 0)
- Input : taux de dégradation (%/an, défaut 0.5%)
- Input : taux d'inflation tarif SENELEC (%/an, défaut 2%)
- Bouton "Calculer l'analyse financière"

**Section "Résultats"** :
- 4 cartes KPI :
  - Retour sur investissement : X.X ans (grande police)
  - VAN : X FCFA
  - TRI : X.X %
  - ROI : X.X %
- LCOE : X FCFA/kWh (coût de production du kWh solaire)

### 4. Frontend — Graphique cashflow

**`frontend/src/components/charts/CashflowChart.tsx`** :
- Recharts ComposedChart sur 25 ans :
  - Barres : net cashflow annuel (vert si positif, rouge si négatif)
  - Ligne : flux cumulé (commence négatif, passe à positif au payback)
  - Ligne horizontale à 0 (seuil de rentabilité)
  - Point annoté au payback year
- Axe X : année (0-25)
- Axe Y : FCFA
- Tooltip avec détails par année

### 5. Frontend — Courbe de dégradation

**`frontend/src/components/charts/DegradationChart.tsx`** (optionnel) :
- Recharts LineChart montrant la production annuelle décroissante sur 25 ans
- Production année 1 vs année 25

## Critères d'acceptance

- [ ] Le calcul du payback est correct (interpolation linéaire)
- [ ] La VAN utilise le taux d'actualisation correctement
- [ ] Le TRI est calculé (ou "N/A" si non convergent)
- [ ] La dégradation annuelle réduit la production correctement
- [ ] L'inflation augmente les économies annuelles
- [ ] Le LCOE est calculé correctement
- [ ] Le graphique cashflow 25 ans s'affiche avec le point de payback
- [ ] Les 4 cartes KPI affichent les bons chiffres
- [ ] Les montants sont formatés en FCFA
- [ ] Les résultats sont sauvegardés en BDD
- [ ] Labels traduits FR/EN

## Tests

- `test_financial.py` :
  - Coût 5M FCFA, économie 500k/an → payback ~10 ans
  - NPV positif si TRI > discount rate
  - Dégradation 0% → production constante
  - Cashflow 25 entrées + year 0
