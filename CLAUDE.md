# SenPV — Instructions Claude Code

## Projet

SenPV est une plateforme SaaS de dimensionnement solaire PV pour le Sénégal.
Deux modes : particulier (SaaS ouvert) et installateur professionnel.

## Stack

- **Frontend** : Next.js 15 (App Router) + React 19 + TypeScript
- **Carte** : MapLibre GL JS + Deck.gl
- **3D** : React Three Fiber (intégré, pas d'iframe)
- **Schéma unifilaire** : React Flow (nœuds custom) + networkx (backend)
- **UI** : shadcn/ui + Tailwind CSS
- **State** : Zustand
- **i18n** : next-intl (FR/EN)
- **Backend** : FastAPI + Python 3.12
- **PV Simulation** : pvlib
- **BDD** : PostgreSQL 16 + PostGIS + SQLAlchemy 2.0 + GeoAlchemy2 + Alembic
- **Cache** : Redis
- **Auth** : NextAuth.js (frontend) + JWT (backend API)
- **PDF** : WeasyPrint
- **Tâches async** : Celery + Redis
- **Deploy** : Docker Compose + Traefik + Portainer (VPS)

## Structure

```
SenPV/
├── frontend/          ← Next.js 15
├── backend/           ← FastAPI + pvlib
├── docker-compose.yml
├── .env.example
└── docs/
    ├── architecture.md    ← Spec complète du projet
    ├── MODEL_STRATEGY.md  ← Quel modèle (Opus/Sonnet/Haiku) pour chaque prompt
    ├── PROGRESS.md        ← Suivi d'avancement
    ├── BUGS.md            ← Suivi des bugs
    ├── DECISIONS.md       ← Décisions techniques (ADR)
    ├── CHANGELOG.md       ← Journal des modifications
    ├── TROUBLESHOOTING.md ← Guide de dépannage
    └── prompts/           ← Prompts Claude Code séquentiels (00-16)
```

## Conventions

### Frontend
- Composants dans `src/components/<domain>/` (map, panels, viewer3d, schematic, charts, quote, equipment, layout, ui)
- Pages dans `src/app/[locale]/` (App Router avec i18n)
- Stores Zustand dans `src/store/`
- Types dans `src/types/`
- Utilitaires dans `src/lib/`
- Toute chaîne affichée passe par next-intl (`useTranslations`)
- shadcn/ui pour tous les composants UI de base
- Pas de CSS modules, pas de styled-components — Tailwind uniquement

### Backend
- Routes dans `app/api/` (FastAPI routers)
- Modèles SQLAlchemy dans `app/models/`
- Schémas Pydantic dans `app/schemas/`
- Logique métier dans `app/services/`
- Tâches Celery dans `app/tasks/`
- Templates PDF dans `app/templates/`
- Config via pydantic-settings (`app/config.py`)
- Migrations Alembic dans `alembic/versions/`

### Base de données
- PostgreSQL + PostGIS pour les géométries (polygones toits)
- UUID comme clé primaire (gen_random_uuid)
- JSONB pour les specs équipements et données variables
- Timestamps avec timezone (TIMESTAMPTZ)

### Général
- Pas de logo graphique — écrire "SenPV" en texte
- Cible : Sénégal uniquement (SENELEC, FCFA, coordonnées Dakar par défaut)
- Français comme langue par défaut, anglais en option
- Pas de CrewAI, pas d'Ollama, pas de multi-agents IA
- Tests : pytest (backend), vitest (frontend)
- Docker Compose pour le développement et la production

## Modèles Claude — Stratégie

Changer de modèle selon la complexité du prompt. Voir `docs/MODEL_STRATEGY.md` pour le détail.

```
/model opus    → prompts 06, 07, 09, 11, 12 (algorithmes, graphes, calculs)
/model sonnet  → prompts 01, 02, 04, 05, 08, 10, 13, 14, 15 (CRUD, composants, intégrations)
/model haiku   → prompts 00, 03, 16 (scaffolding, config, i18n, deploy)
```

Règle : debug complexe → Opus. Correction simple → Haiku. Le reste → Sonnet.

## Prompts

Les prompts dans `docs/prompts/` sont séquentiels (00-16).
Chaque prompt est autonome : il contient contexte, specs, fichiers à créer, et critères d'acceptance.
Exécuter dans l'ordre numérique. Chaque prompt peut être donné tel quel à Claude Code.

**Workflow** :
1. `/model haiku` (ou sonnet/opus selon le tableau ci-dessus)
2. "Lis et exécute `docs/prompts/XX-nom.md`"
3. Mettre à jour `docs/PROGRESS.md` après chaque prompt
4. Noter les bugs dans `docs/BUGS.md`, les décisions dans `docs/DECISIONS.md`

## Commandes

```bash
# Dev frontend
cd frontend && npm run dev

# Dev backend
cd backend && uvicorn app.main:app --reload

# Docker (prod)
docker compose up -d

# Migrations
cd backend && alembic upgrade head

# Tests
cd backend && pytest
cd frontend && npm test
```
