# SenPV — Stratégie d'utilisation des modèles Claude

> Guide pour choisir le bon modèle Claude (Opus / Sonnet / Haiku) selon la tâche.
> Objectif : maximiser la qualité du code tout en optimisant la consommation de tokens.

## Principes

| Modèle | Force | Coût tokens | Quand l'utiliser |
|--------|-------|-------------|------------------|
| **Opus** | Raisonnement complexe, architecture, algorithmes, debug difficile | Élevé | Logique métier critique, algorithmes, intégrations complexes, debug |
| **Sonnet** | Bon équilibre qualité/coût, CRUD, composants UI, intégrations standard | Moyen | La majorité du code applicatif, composants, routes API |
| **Haiku** | Rapide, tâches simples, boilerplate, corrections mineures | Faible | Boilerplate, config, corrections simples, formatage, i18n |

## Commandes pour changer de modèle

```
/model opus    → tâches complexes
/model sonnet  → tâches standard
/model haiku   → tâches simples
```

---

## Attribution par prompt

### Phase 1 — Fondations (Prompts 00-03)

| Prompt | Modèle | Justification |
|--------|--------|---------------|
| **00 — Project Setup** | **Haiku** | Scaffolding, config, boilerplate. Commandes npm/pip, Dockerfiles standards. Peu de logique. |
| **01 — Database Schema** | **Sonnet** | Modèles SQLAlchemy + PostGIS + relations. Schéma bien défini dans le spec, Sonnet suit les instructions. |
| **02 — Auth** | **Sonnet** | NextAuth + JWT + middleware. Pattern standard mais plusieurs fichiers interconnectés. |
| **03 — i18n** | **Haiku** | Config next-intl + fichiers JSON de traductions. Mécanique, peu de logique. |

### Phase 2 — Données & CRUD (Prompts 04-05)

| Prompt | Modèle | Justification |
|--------|--------|---------------|
| **04 — Equipment Catalog** | **Sonnet** | CRUD + validation Pydantic des specs techniques. Patterns standards mais validation métier. |
| **05 — Project Management** | **Sonnet** | CRUD projets/clients + statuts. Pattern classique, plusieurs endpoints. |

### Phase 3 — Cartographie & Panneaux (Prompts 06-08)

| Prompt | Modèle | Justification |
|--------|--------|---------------|
| **06 — Map & Roof Drawing** | **Opus** | Intégration MapLibre + dessin polygone interactif + PostGIS. Géospatial = complexe. |
| **07 — Panel Placement** | **Opus** | Algorithme de calpinage (géométrie, projection UTM, rotation, clipping). C'est un vrai algo. |
| **08 — 3D Viewer** | **Sonnet** | React Three Fiber — migration depuis l'existant. Complexe mais pattern connu, pas d'algo original. |

### Phase 4 — Simulation & Calculs (Prompts 09-11)

| Prompt | Modèle | Justification |
|--------|--------|---------------|
| **09 — PV Simulation** | **Opus** | pvlib ModelChain + TMY + fallback + cache Redis + optimisation. Cœur technique du projet. |
| **10 — SENELEC Billing** | **Sonnet** | Calcul tarifaire progressif. Logique métier claire, bien spécifiée. |
| **11 — Financial Analysis** | **Opus** | NPV, IRR, LCOE, cashflow 25 ans avec dégradation + inflation. Calculs financiers complexes. |

### Phase 5 — Schéma & Documents (Prompts 12-14)

| Prompt | Modèle | Justification |
|--------|--------|---------------|
| **12 — Schematic Editor** | **Opus** | React Flow + networkx + auto-génération graphe + validation électrique + propagation cascade. Le plus complexe du projet. |
| **13 — Quote Builder** | **Sonnet** | CRUD devis + calculs (marge, TVA). Template PDF standard. |
| **14 — Report Generator** | **Sonnet** | WeasyPrint + templates Jinja2 + matplotlib charts. Assemblage de données, pas d'algo complexe. |

### Phase 6 — Dashboard & Deploy (Prompts 15-16)

| Prompt | Modèle | Justification |
|--------|--------|---------------|
| **15 — Dashboard** | **Sonnet** | Composants UI + requêtes agrégées. Kanban drag & drop = moyen. |
| **16 — Deploy** | **Haiku** | Docker Compose, scripts bash, config Traefik. Tout est dans le spec, c'est de la config. |

---

## Résumé visuel

```
OPUS (5 prompts)     — Les cerveaux du projet
  ├── 06  Map & Roof Drawing      (géospatial, PostGIS, dessin interactif)
  ├── 07  Panel Placement          (algorithme calpinage, géométrie)
  ├── 09  PV Simulation            (pvlib, optimisation, cache)
  ├── 11  Financial Analysis       (NPV, IRR, cashflow 25 ans)
  └── 12  Schematic Editor         (React Flow + networkx + validation)

SONNET (9 prompts)   — Le gros du travail
  ├── 01  Database Schema
  ├── 02  Auth
  ├── 04  Equipment Catalog
  ├── 05  Project Management
  ├── 08  3D Viewer
  ├── 10  SENELEC Billing
  ├── 13  Quote Builder
  ├── 14  Report Generator
  └── 15  Dashboard

HAIKU (3 prompts)    — Le boilerplate rapide
  ├── 00  Project Setup
  ├── 03  i18n
  └── 16  Deploy
```

---

## Tâches transversales — Modèle à utiliser

| Tâche | Modèle |
|-------|--------|
| **Debug un bug complexe** (race condition, calcul faux) | Opus |
| **Debug un bug simple** (typo, import manquant, CSS) | Haiku |
| **Ajouter un champ à un formulaire** | Haiku |
| **Refactoring d'un composant** | Sonnet |
| **Écrire des tests unitaires** | Sonnet |
| **Corriger un test qui fail** | Sonnet (Opus si le bug est dans la logique) |
| **Ajouter une traduction** | Haiku |
| **Modifier le docker-compose** | Haiku |
| **Optimiser une requête SQL** | Opus |
| **Ajouter un endpoint CRUD** | Sonnet |
| **Revoir l'architecture d'un service** | Opus |
| **Écrire de la documentation** | Haiku |
| **Code review** | Opus |

---

## Workflow recommandé

```
1. Avant chaque prompt, changer de modèle :
   /model opus    (ou sonnet, ou haiku)

2. Donner le prompt :
   "Lis et exécute docs/prompts/XX-nom.md"

3. Si bloqué sur un bug complexe :
   /model opus
   "Debug le problème suivant : ..."

4. Pour les corrections rapides :
   /model haiku
   "Corrige l'import manquant dans ..."

5. Revenir au modèle du prompt pour continuer :
   /model sonnet
```

## Estimation tokens par prompt

| Prompt | Modèle | Tokens estimés (input+output) | Coût relatif |
|--------|--------|-------------------------------|--------------|
| 00 | Haiku | ~30k | $ |
| 01 | Sonnet | ~50k | $$ |
| 02 | Sonnet | ~60k | $$ |
| 03 | Haiku | ~25k | $ |
| 04 | Sonnet | ~70k | $$ |
| 05 | Sonnet | ~60k | $$ |
| 06 | Opus | ~80k | $$$$ |
| 07 | Opus | ~90k | $$$$ |
| 08 | Sonnet | ~70k | $$ |
| 09 | Opus | ~100k | $$$$ |
| 10 | Sonnet | ~40k | $$ |
| 11 | Opus | ~80k | $$$$ |
| 12 | Opus | ~120k | $$$$$ |
| 13 | Sonnet | ~60k | $$ |
| 14 | Sonnet | ~70k | $$ |
| 15 | Sonnet | ~60k | $$ |
| 16 | Haiku | ~30k | $ |

**Total estimé** : ~1.1M tokens
- Opus (5 prompts) : ~470k tokens — coût dominant
- Sonnet (9 prompts) : ~540k tokens — volume dominant
- Haiku (3 prompts) : ~85k tokens — négligeable
