# 11 — Rebuild Plan

> Plan de reconstruction complet de SolarIntel -> SenPV. 17 prompts sequentiels.

---

## Pourquoi la refonte ?

SolarIntel v1 avait atteint ses limites :
- Monolithe `index.html` (2100+ lignes, impossible a maintenir)
- ArcGIS JS SDK payant (~2MB, licence)
- Pas de base de donnees (tout en memoire)
- Pas d'authentification (un seul utilisateur)
- 3D viewer en iframe separee
- CrewAI/Ollama trop lourd et non essentiel
- Pas de devis, pas de multi-utilisateurs, pas de schema unifilaire editable

---

## Strategie de reconstruction

### Approche : prompts sequentiels

Chaque prompt est :
1. **Autonome** — contient contexte, specs, fichiers a creer, criteres d'acceptance
2. **Sequentiel** — les dependances sont explicites (ex: prompt 07 depend de 04 et 06)
3. **Testable** — chaque prompt a des criteres d'acceptance verifiables
4. **Modele-specifique** — le modele Claude (Opus/Sonnet/Haiku) est recommande

### Workflow d'execution

```
1. /model [opus|sonnet|haiku]   <- selon le tableau
2. "Lis et execute docs/prompts/XX-nom.md"
3. Verifier les criteres d'acceptance
4. Mettre a jour docs/PROGRESS.md
5. Noter les decisions dans docs/DECISIONS.md
6. Reporter les bugs dans docs/BUGS.md
7. Passer au prompt suivant
```

---

## Phases et prompts

### Phase 1 — Fondations (Prompts 00-03)

| # | Prompt | Modele | Livrable |
|---|--------|--------|----------|
| 00 | Project Setup | Haiku | Repos Next.js + FastAPI + Docker |
| 01 | Database Schema | Sonnet | 12 tables + PostGIS + migrations + Pydantic |
| 02 | Auth | Sonnet | NextAuth + JWT + proxy.ts + roles |
| 03 | i18n | Haiku | next-intl FR/EN + 16 namespaces |

**Objectif** : avoir un squelette fonctionnel avec auth et i18n.

### Phase 2 — Donnees & CRUD (Prompts 04-05)

| # | Prompt | Modele | Livrable |
|---|--------|--------|----------|
| 04 | Equipment Catalog | Sonnet | CRUD panneaux/onduleurs + validation specs |
| 05 | Project Management | Sonnet | CRUD projets + clients + statuts |

**Objectif** : gerer les donnees de base (equipements, projets, clients).

### Phase 3 — Cartographie & Panneaux (Prompts 06-08)

| # | Prompt | Modele | Livrable |
|---|--------|--------|----------|
| 06 | Map & Roof Drawing | Opus | MapLibre + dessin polygone + PostGIS |
| 07 | Panel Placement | Opus | Calpinage UTM28N + placement manuel |
| 08 | 3D Viewer | Sonnet | React Three Fiber integre |

**Objectif** : dessiner un toit sur la carte, placer des panneaux, visualiser en 3D.

### Phase 4 — Simulation & Calculs (Prompts 09-11)

| # | Prompt | Modele | Livrable |
|---|--------|--------|----------|
| 09 | PV Simulation | Opus | pvlib + cache Redis + Celery |
| 10 | SENELEC Billing | Sonnet | Tarification progressive + economies |
| 11 | Financial Analysis | Opus | NPV/IRR/LCOE/cashflow 25 ans |

**Objectif** : simuler la production, calculer les economies et la rentabilite.

### Phase 5 — Documents (Prompts 12-14)

| # | Prompt | Modele | Livrable |
|---|--------|--------|----------|
| 12 | Schematic Editor | Opus | React Flow + networkx + validation |
| 13 | Quote Builder | Sonnet | CRUD devis + PDF WeasyPrint |
| 14 | Report Generator | Sonnet | Rapport complet PDF multi-pages |

**Objectif** : generer les documents techniques et commerciaux.

### Phase 6 — Dashboard & Deploy (Prompts 15-16)

| # | Prompt | Modele | Livrable |
|---|--------|--------|----------|
| 15 | Dashboard | Sonnet | Dashboard par role + kanban |
| 16 | Deploy | Haiku | Docker + Traefik + Portainer |

**Objectif** : page d'accueil intelligente et deploiement production.

---

## Avancement au 2026-09-01

```
Phase 1 : ████████████████████ 100% (00-03 ✓)
Phase 2 : ████████████████████ 100% (04-05 ✓)
Phase 3 : ████████████████████ 100% (06-08 ✓)
Phase 4 : ████████████████████ 100% (09-11 ✓)
Phase 5 : █████████████░░░░░░░  66% (12-13 ✓, 14 a faire)
Phase 6 : ░░░░░░░░░░░░░░░░░░░   0% (15-16 a faire)

Global  : ████████████████░░░░  76% (13/17 prompts)
Tests   : 170+ passants
Bugs    : 0 ouverts
ADR     : 12 documentes
```

---

## Dependances entre prompts

```
00 ─┬─ 01 ─┬─ 02 ─── 04 ─┬─ 07 ─┬─ 08
    │      │              │      │
    │      └─ 05 ─── 06 ──┘      ├─ 09 ─┬─ 10
    │                             │      │
    └─ 03                         │      └─ 11
                                  │
                           12 ────┤
                                  │
                    04 + 05 + 12 ─┴─ 13
                                       │
                       09 + 11 + 12 + 13 ── 14
                                              │
                                  05 + 09 ── 15
                                              │
                                   Tous ── 16
```

---

## Prochaines etapes

1. **Prompt 14** — Report Generator (Sonnet) : rapport PDF complet avec graphiques matplotlib
2. **Prompt 15** — Dashboard (Sonnet) : dashboard par role avec kanban installateur
3. **Prompt 16** — Deploy (Haiku) : Docker Compose production + Traefik + scripts
4. **Post-MVP** : tests E2E, monitoring, rate limiting, analytics
