# 07 — Business Model

> Modele economique et logique metier de SenPV.

---

## Positionnement

SenPV est une plateforme SaaS de dimensionnement solaire PV ciblent exclusivement le marche senegalais. Elle sert deux segments :

1. **Particuliers** — veulent evaluer la rentabilite d'une installation solaire sur leur toit
2. **Installateurs professionnels** — gerent leur activite commerciale (prospects, devis, suivi installations)

---

## Marche cible

### Senegal — contexte energetique
- Fournisseur unique : **SENELEC** (Societe Nationale d'Electricite du Senegal)
- Tarification progressive (4 tranches) encourageant l'autoconsommation
- Ensoleillement eleve (~1650 kWh/kWc de productivite specifique a Dakar)
- Marche PV en croissance (objectifs gouvernementaux d'energies renouvelables)
- Monnaie : FCFA (Franc CFA — XOF)

### Grille tarifaire SENELEC

| Tranche | Description | Seuil | Prix/kWh |
|---------|-------------|-------|----------|
| DPP | Domestique Petite Puissance | 0-150 kWh | 90.47 FCFA |
| DMP | Domestique Moyenne Puissance | 151-250 kWh | 101.64 FCFA |
| DGP | Domestique Grande Puissance | >250 kWh | 112.65 FCFA |
| PP | Professionnel | illimite | 118.00 FCFA |

- TVA : 18%
- Redevance mensuelle : 872 FCFA

---

## Proposition de valeur

### Pour le particulier
1. **Gratuit** — dessine son toit, simule, obtient un rapport
2. **Localise** — tarifs SENELEC reels, donnees meteo Dakar, FCFA
3. **Complet** — production kWh, economies, retour sur investissement 25 ans
4. **Autonome** — pas besoin d'un installateur pour une premiere estimation

### Pour l'installateur
1. **Pipeline commercial** — suivi prospects du premier contact a l'installation
2. **Devis professionnels** — logo, marges, TVA, conditions, PDF
3. **Dimensionnement technique** — calpinage, schema unifilaire, validation electrique
4. **Rapport client** — document PDF complet pour convaincre et closer

---

## Logique metier cle

### Calcul de rentabilite

```
Production annuelle (kWh) = nb_panneaux × Pmax × productivite_specifique × PR
Economies annuelles (FCFA) = production × tarif_SENELEC_applicable
Payback (annees) = cout_total / economies_annuelles
```

Avec degradation (0.5%/an) et inflation tarifs (3%/an) sur 25 ans :
- VAN (Valeur Actuelle Nette) avec taux d'actualisation 8%
- TRI (Taux de Rendement Interne) par Newton-Raphson
- LCOE (Cout de l'Energie Actualisee)
- Cashflow cumule annuel

### Dimensionnement technique

1. **Calpinage** — placement optimal des panneaux dans le polygone de toit
   - Projection UTM 28N (EPSG:32628) pour calculs metriques precis
   - Rotation selon l'orientation du toit
   - Espacement configurable

2. **Configuration strings** — groupement electrique des panneaux
   - Nb strings × panneaux/string = nb total panneaux
   - Tension string = Voc × panneaux/string (doit etre < Vmax onduleur)
   - Courant string = Isc (doit etre < Imax MPPT)

3. **Validation electrique** (schema unifilaire)
   - Compatibilite panneau-onduleur (tension, courant, MPPT)
   - Calibres de protection (disjoncteurs DC/AC)
   - Sections de cables

### Devis installateur

```
Sous-total HT = Somme(qte × prix_unitaire)
Marge = sous-total × marge_pct / 100
Total HT = sous-total + marge
TVA = total_HT × 18%
Total TTC = total_HT + TVA
```

Reference auto-generee : `DEV-{annee}-{numero sequentiel par installateur}`

---

## Equipements courants au Senegal

### Panneaux solaires populaires
| Modele | Puissance | Prix indicatif |
|--------|-----------|----------------|
| JA Solar JAM72S30-545W | 545 Wc | ~185 000 FCFA |
| Canadian Solar CS6W-550MS | 550 Wc | ~190 000 FCFA |
| Jinko JKM540M-72HL4-V | 540 Wc | ~180 000 FCFA |

### Onduleurs populaires
| Modele | Puissance | Prix indicatif |
|--------|-----------|----------------|
| Huawei SUN2000-5KTL | 5 kW | ~650 000 FCFA |
| Growatt MIN 5000TL-X | 5 kW | ~450 000 FCFA |
| Sungrow SG5.0RS | 5 kW | ~550 000 FCFA |

---

## Donnees meteo

- Source : PVGIS (Photovoltaic Geographical Information System) — API gratuite
- Format : TMY (Typical Meteorological Year)
- Coordonnees par defaut : Dakar (14.7167°N, 17.4677°W)
- Fallback si API indisponible : estimation 1650 kWh/kWc

---

## Monetisation (future)

Le projet est actuellement en mode MVP. Pistes de monetisation potentielles :
- Freemium : particuliers gratuits, installateurs abonnement mensuel
- Commission sur leads : mise en relation particulier → installateur
- Marque blanche : plateforme personnalisee pour les installateurs

*Note : la monetisation n'est pas implementee dans le MVP. Le projet est actuellement auto-heberge sur VPS.*
