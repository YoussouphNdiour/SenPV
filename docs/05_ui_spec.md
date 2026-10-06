# 05 — UI Specification

> Structure des pages, composants et layout de l'interface SenPV.

---

## Stack UI

| Techno | Role |
|--------|------|
| Next.js 15 (App Router) | Framework, SSR, routing |
| React 19 | UI library |
| shadcn/ui (Radix + Tailwind) | Composants UI de base |
| Tailwind CSS 4.x | Styles utilitaires (pas de CSS modules, pas de styled-components) |
| next-intl 3.x | Internationalisation FR/EN |
| Zustand 5.x | State management (stores par domaine) |
| Recharts 2.x | Graphiques (barres, courbes) |

---

## Layout general

### Structure des routes

```
src/app/[locale]/
├── layout.tsx              <- Layout racine (providers, i18n)
├── page.tsx                <- Landing page (non authentifie)
│
├── auth/                   <- Hors route group, sans sidebar
│   ├── login/page.tsx
│   └── register/page.tsx
│
└── (app)/                  <- Route group authentifie (ADR-009)
    ├── layout.tsx          <- AppLayout (sidebar + header)
    ├── dashboard/page.tsx
    ├── projects/
    │   ├── page.tsx        <- Liste projets
    │   └── [id]/
    │       ├── page.tsx    <- Vue d'ensemble projet
    │       ├── map/page.tsx
    │       ├── panels/page.tsx
    │       ├── 3d/page.tsx
    │       ├── simulation/page.tsx
    │       ├── schematic/page.tsx
    │       ├── quote/page.tsx
    │       └── report/page.tsx
    ├── equipment/page.tsx
    ├── clients/page.tsx
    └── admin/page.tsx
```

### AppLayout (pages authentifiees)
```
┌──────────────────────────────────────────────────┐
│ Header : logo "SenPV" | recherche | locale | user│
├────────┬─────────────────────────────────────────┤
│        │                                         │
│ Side-  │            Contenu page                 │
│ bar    │                                         │
│        │                                         │
│ - Dash │                                         │
│ - Proj │                                         │
│ - Equip│                                         │
│ - Clien│                                         │
│ - Admin│                                         │
│        │                                         │
└────────┴─────────────────────────────────────────┘
```

---

## Pages principales

### 1. Landing Page (/)
- Titre "SenPV" + description
- Boutons "S'inscrire" / "Se connecter"
- Pas de contenu marketing complexe

### 2. Auth (/auth/login, /auth/register)
- Formulaire centre
- Pas de sidebar
- Lien entre login et register
- Bouton Google OAuth (optionnel)

### 3. Dashboard (/dashboard)
Adapte selon le role (voir `02_features.md` Module 14).

### 4. Liste Projets (/projects)
```
┌──────────────────────────────────────────┐
│ Mes Projets                [+ Nouveau]   │
├──────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐       │
│ │ Maison Dakar │ │ Villa Saly   │       │
│ │ 5.4 kWc      │ │ 3.2 kWc      │       │
│ │ [Etude]      │ │ [Brouillon]  │       │
│ │ 26/08/2026   │ │ 25/08/2026   │       │
│ └──────────────┘ └──────────────┘       │
└──────────────────────────────────────────┘
```

### 5. Detail Projet (/projects/[id])
- Tabs ou navigation interne : Vue d'ensemble | Carte | Panneaux | 3D | Simulation | Schema | Devis | Rapport
- Vue d'ensemble : resume KPI + liens vers chaque section

### 6. Carte (/projects/[id]/map)
```
┌──────────────────────────────────────────┐
│ ┌─ Toolbar ─────────────────────────┐    │
│ │ Zone | Ajouter | Select | Suppr.  │    │
│ └───────────────────────────────────┘    │
│                                          │
│            MapLibre GL JS                │
│         (satellite tiles)                │
│                                          │
│     [polygone toit dessine]              │
│                                          │
│ ┌─ Panel lateral ─────────┐             │
│ │ Zone 1 : 80m2           │             │
│ │ Orientation : 180°      │             │
│ │ Inclinaison : 15°       │             │
│ │ Type : plat             │             │
│ └─────────────────────────┘             │
└──────────────────────────────────────────┘
```

### 7. Panneaux (/projects/[id]/panels)
- Grille de panneaux (calpinage) sur la carte
- Toolbar : outils d'ajout/suppression/selection
- Badge compteur panneaux (bottom-left)
- Configuration strings

### 8. 3D (/projects/[id]/3d)
- Canvas React Three Fiber plein ecran
- Controles orbit (rotation, zoom, pan)
- Toit 3D avec panneaux solaires
- Pas d'iframe (integre directement)

### 9. Simulation (/projects/[id]/simulation)
```
┌──────────────────────────────────────────┐
│ Resultats de simulation                  │
├──────────────────────────────────────────┤
│ ┌─ KPI ─────────────────────────────┐   │
│ │ 8 250 kWh/an  │ 1 650 kWh/kWc    │   │
│ │ 5.45 kWc      │ PR 82.3%         │   │
│ └───────────────────────────────────┘   │
│                                          │
│ ┌─ Graphique production mensuelle ──┐   │
│ │ ████ ████ ████ ████ ████ ████ ... │   │
│ │ Jan  Fev  Mar  Avr  Mai  Jun      │   │
│ └───────────────────────────────────┘   │
│                                          │
│ [Relancer simulation] [Optimiser]        │
└──────────────────────────────────────────┘
```

### 10. Schema unifilaire (/projects/[id]/schematic)
```
┌──────────────────────────────────────────┐
│ ┌─ Palette ───┐ ┌─ React Flow ────────┐ │
│ │ [panneau]   │ │                      │ │
│ │ [onduleur]  │ │  PV ── DC ── INV    │ │
│ │ [disj DC]   │ │            │         │ │
│ │ [disj AC]   │ │  AC ── Compteur     │ │
│ │ [parafoud]  │ │            │         │ │
│ │ [compteur]  │ │       SENELEC       │ │
│ │ [terre]     │ │                      │ │
│ └─────────────┘ └──────────────────────┘ │
│ ┌─ Validation ────────────────────────┐  │
│ │ ✓ Tensions OK                       │  │
│ │ ⚠ Vmp hors plage MPPT             │  │
│ └─────────────────────────────────────┘  │
│ [Generer] [Valider] [Exporter SVG]       │
└──────────────────────────────────────────┘
```

### 11. Devis (/projects/[id]/quote) — installer uniquement
- Editeur de lignes (description, qte, PU)
- Calculs temps reel (sous-total, marge, TVA, TTC)
- Apercu PDF
- Gestion statuts (draft -> sent -> accepted/rejected)

### 12. Rapport (/projects/[id]/report)
- Boutons generation : rapport complet, devis seul, schema seul
- Historique des rapports generes
- Telechargement PDF

---

## Composants partages

### UI (shadcn/ui)
- Button, Input, Select, Dialog, Dropdown, Table, Tabs, Card, Badge, Toast, Tooltip, Skeleton, Sheet

### Composants custom
| Composant | Fichier | Usage |
|-----------|---------|-------|
| StatusBadge | `components/ui/StatusBadge.tsx` | Badges colores par statut projet/devis |
| KPICard | `components/dashboard/KPICard.tsx` | Cartes KPI dashboard |
| PipelineBoard | `components/dashboard/PipelineBoard.tsx` | Kanban installateur |
| LocaleSwitcher | `components/layout/LocaleSwitcher.tsx` | Switch FR/EN |

---

## Stores Zustand

| Store | Fichier | Contenu |
|-------|---------|---------|
| project | `store/project.ts` | Projet courant, zones, layouts |
| map | `store/map.ts` | Etat carte, mode dessin, zoom |
| schematic | `store/schematic.ts` | Noeuds/aretes React Flow |
| equipment | `store/equipment.ts` | Catalogue charge |

---

## Responsive

- Desktop : sidebar + contenu
- Tablet : sidebar collapsible (sheet)
- Mobile : sidebar cachee, navigation hamburger
- Carte et 3D : plein ecran sur mobile

---

## Palette de couleurs

| Usage | Couleur | Hex |
|-------|---------|-----|
| Primaire (SenPV) | Bleu fonce | #1e3a5f |
| Solaire | Ambre | #f59e0b |
| Succes / economie | Vert | #10b981 |
| Erreur | Rouge | #ef4444 |
| Warning | Orange | #f97316 |
| Fond | Blanc/Gris | #ffffff / #f9fafb |

---

## Conventions frontend

- Composants dans `src/components/<domain>/`
- Pages dans `src/app/[locale]/`
- Toute chaine affichee passe par `useTranslations()` (next-intl)
- Pas de CSS modules, pas de styled-components — Tailwind uniquement
- Dynamic import avec `ssr: false` pour MapLibre, React Three Fiber, React Flow
