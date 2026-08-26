# Prompt 10 — Facturation SENELEC

## Contexte

L'utilisateur saisit sa consommation SENELEC mensuelle (kWh/mois) et sa tranche tarifaire. SenPV calcule sa facture actuelle et les économies avec une installation PV.

La grille tarifaire SENELEC est dans `backend/app/data/senelec_tariffs.json`.

## Dépendances

- Prompt 05 (project management — clients avec monthly_kwh)
- Prompt 09 (simulation — production annuelle kWh)

## Tâches

### 1. Backend — Service SENELEC

**`backend/app/services/senelec.py`** :

```python
def calculate_bill(monthly_kwh: float, tariff_tier: str = "DMP") -> dict:
    """
    Calcule la facture SENELEC mensuelle.
    
    Tranches SENELEC (tarification progressive) :
    - 0-150 kWh    : 1ère tranche (DPP) → 90.47 FCFA/kWh
    - 151-250 kWh  : 2ème tranche (DMP) → 101.64 FCFA/kWh
    - 251+ kWh     : 3ème tranche (DGP) → 112.65 FCFA/kWh
    - Professionnel : tarif unique → 118.00 FCFA/kWh
    
    + TVA 18%
    + Redevance mensuelle 872 FCFA
    
    Returns:
        {
            "monthly_kwh": 350,
            "tariff_tier": "DMP",
            "breakdown": [
                {"tier": "DPP", "kwh": 150, "rate": 90.47, "amount": 13570},
                {"tier": "DMP", "kwh": 100, "rate": 101.64, "amount": 10164},
                {"tier": "DGP", "kwh": 100, "rate": 112.65, "amount": 11265}
            ],
            "subtotal_fcfa": 34999,
            "redevance_fcfa": 872,
            "tva_amount_fcfa": 6457,
            "total_monthly_fcfa": 42328,
            "total_annual_fcfa": 507936
        }
    """

def calculate_savings(
    monthly_kwh: float,
    tariff_tier: str,
    annual_production_kwh: float
) -> dict:
    """
    Calcule les économies avec l'installation PV.
    
    Logique : 
    - La production PV réduit la consommation réseau
    - Les kWh autoconsommés sont soustraits de la facture
    - L'économie est la différence entre facture sans PV et avec PV
    - Si la production dépasse la conso, l'excédent n'est pas valorisé
      (pas de rachat par SENELEC pour les particuliers)
    
    Returns:
        {
            "bill_without_pv": { ... },
            "bill_with_pv": { ... },
            "monthly_savings_fcfa": 28500,
            "annual_savings_fcfa": 342000,
            "self_consumption_pct": 85.0,
            "grid_reduction_pct": 72.0
        }
    """
```

### 2. Backend — API SENELEC

**`backend/app/api/senelec.py`** :

**GET `/senelec/tariffs`**
- Retourne la grille tarifaire complète depuis `senelec_tariffs.json`
- Inclut les tranches, les prix, la TVA, la redevance

**POST `/senelec/bill`**
- Body : `{ monthly_kwh, tariff_tier? }`
- Calcule et retourne la facture détaillée
- `tariff_tier` par défaut : déterminé automatiquement selon le kWh

**POST `/senelec/savings`**
- Body : `{ monthly_kwh, tariff_tier?, annual_production_kwh }`
- Calcule et retourne les économies
- Peut être appelé avec les résultats de la simulation (prompt 09)

### 3. Frontend — Saisie consommation

**`frontend/src/app/[locale]/projects/[id]/simulation/page.tsx`** — ajouter une section :

**Section "Consommation SENELEC"** (avant ou après la simulation) :
- Input : consommation mensuelle en kWh/mois (number input)
- Dropdown : tranche tarifaire (DPP, DMP, DGP, PP) — auto-sélectionnée selon le kWh
- Affichage en temps réel :
  - Facture mensuelle actuelle (FCFA)
  - Facture annuelle actuelle (FCFA)
  - Détail par tranche (tableau)

**Section "Économies avec PV"** (après simulation) :
- Comparaison avant/après :
  - Facture sans PV : X FCFA/mois
  - Facture avec PV : Y FCFA/mois
  - Économie : Z FCFA/mois (badge vert)
- Économie annuelle mise en avant (gros chiffre)
- Taux d'autoconsommation (%)
- Réduction de la facture réseau (%)

### 4. Frontend — Graphique comparatif

**`frontend/src/components/charts/SavingsChart.tsx`** :
- Recharts BarChart comparatif :
  - 12 mois en X
  - Deux barres par mois : facture sans PV (rouge) vs facture avec PV (vert)
- Ou un AreaChart montrant la production PV superposée à la consommation

### 5. Intégration avec les fiches clients

- Si le projet est lié à un client (installateur), pré-remplir `monthly_kwh` et `senelec_tariff_tier` depuis la fiche client
- La saisie dans le projet met à jour la fiche client si modifiée

## Critères d'acceptance

- [ ] GET `/senelec/tariffs` retourne la grille complète
- [ ] POST `/senelec/bill` calcule correctement la facture progressive (tranches)
- [ ] La TVA 18% est appliquée
- [ ] La redevance mensuelle 872 FCFA est ajoutée
- [ ] POST `/senelec/savings` calcule les économies correctement
- [ ] L'excédent de production n'est pas valorisé (pas de rachat)
- [ ] L'input de consommation fonctionne avec mise à jour temps réel
- [ ] La tranche tarifaire se sélectionne automatiquement
- [ ] Le graphique comparatif s'affiche
- [ ] Les montants sont formatés en FCFA (séparateur de milliers)
- [ ] Labels traduits FR/EN

## Tests

- `test_senelec.py` :
  - Facture 100 kWh (1 tranche DPP seulement)
  - Facture 200 kWh (2 tranches DPP + DMP)
  - Facture 350 kWh (3 tranches DPP + DMP + DGP)
  - Facture professionnelle (tarif unique)
  - Économies avec production PV = 50% de la conso
  - Économies avec production PV > conso (pas de négatif)
