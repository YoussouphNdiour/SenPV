# 06 — Decision & Token Strategy

> Strategie d'utilisation des modeles Claude (Opus/Sonnet/Haiku) et gestion des tokens.

---

## Principes

| Modele | Force | Cout tokens | Quand l'utiliser |
|--------|-------|-------------|------------------|
| **Opus** | Raisonnement complexe, architecture, algorithmes, debug difficile | Eleve | Logique metier critique, algorithmes, integrations complexes, debug |
| **Sonnet** | Bon equilibre qualite/cout, CRUD, composants UI, integrations standard | Moyen | La majorite du code applicatif, composants, routes API |
| **Haiku** | Rapide, taches simples, boilerplate, corrections mineures | Faible | Boilerplate, config, corrections simples, formatage, i18n |

## Commandes

```
/model opus    -> taches complexes
/model sonnet  -> taches standard
/model haiku   -> taches simples
```

---

## Attribution par prompt

### Opus (5 prompts) — Les cerveaux du projet
| Prompt | Justification |
|--------|---------------|
| 06 — Map & Roof Drawing | Geospatial, PostGIS, dessin interactif |
| 07 — Panel Placement | Algorithme calpinage, geometrie UTM |
| 09 — PV Simulation | pvlib ModelChain, optimisation, cache |
| 11 — Financial Analysis | NPV, IRR, cashflow 25 ans |
| 12 — Schematic Editor | React Flow + networkx + validation electrique |

### Sonnet (9 prompts) — Le gros du travail
| Prompt | Justification |
|--------|---------------|
| 01 — Database Schema | Modeles SQLAlchemy + PostGIS |
| 02 — Auth | NextAuth + JWT + middleware |
| 04 — Equipment Catalog | CRUD + validation Pydantic |
| 05 — Project Management | CRUD projets/clients |
| 08 — 3D Viewer | React Three Fiber (pattern connu) |
| 10 — SENELEC Billing | Calcul tarifaire progressif |
| 13 — Quote Builder | CRUD devis + PDF |
| 14 — Report Generator | WeasyPrint + templates |
| 15 — Dashboard | Composants UI + requetes |

### Haiku (3 prompts) — Le boilerplate rapide
| Prompt | Justification |
|--------|---------------|
| 00 — Project Setup | Scaffolding, config |
| 03 — i18n | Config next-intl + JSON |
| 16 — Deploy | Docker Compose, scripts bash |

---

## Taches transversales

| Tache | Modele |
|-------|--------|
| Debug un bug complexe (race condition, calcul faux) | Opus |
| Debug un bug simple (typo, import manquant, CSS) | Haiku |
| Ajouter un champ a un formulaire | Haiku |
| Refactoring d'un composant | Sonnet |
| Ecrire des tests unitaires | Sonnet |
| Corriger un test qui fail | Sonnet (Opus si bug logique) |
| Ajouter une traduction | Haiku |
| Modifier le docker-compose | Haiku |
| Optimiser une requete SQL | Opus |
| Ajouter un endpoint CRUD | Sonnet |
| Revoir l'architecture d'un service | Opus |
| Ecrire de la documentation | Haiku |
| Code review | Opus |

---

## Estimation tokens par prompt

| Prompt | Modele | Tokens estimes | Cout |
|--------|--------|---------------|------|
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

**Total estime** : ~1.1M tokens
- Opus (5 prompts) : ~470k tokens — cout dominant
- Sonnet (9 prompts) : ~540k tokens — volume dominant
- Haiku (3 prompts) : ~85k tokens — negligeable

---

## Workflow recommande

```
1. Avant chaque prompt, changer de modele :
   /model opus    (ou sonnet, ou haiku)

2. Donner le prompt :
   "Lis et execute docs/prompts/XX-nom.md"

3. Si bloque sur un bug complexe :
   /model opus
   "Debug le probleme suivant : ..."

4. Pour les corrections rapides :
   /model haiku
   "Corrige l'import manquant dans ..."

5. Revenir au modele du prompt pour continuer :
   /model sonnet
```

---

## Decisions liees (ADR)

- Les 12 ADR documentes dans `docs/DECISIONS.md` ont ete prises avec les modeles correspondants
- Les decisions complexes (MapLibre vs ArcGIS, networkx, gamma_pdc) ont ete traitees en Opus
- Les decisions de config (proxy.ts, SQLite tests) ont ete traitees en Sonnet/Haiku
