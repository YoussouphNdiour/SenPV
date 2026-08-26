# Prompt 05 — Gestion des Projets & Clients

## Contexte

CRUD complet pour les projets et les fiches clients. Un projet est l'unité centrale de SenPV : il regroupe la localisation, les zones de toit, les panneaux, la simulation, le schéma et le devis.

## Dépendances

- Prompt 01 (database — tables `projects`, `clients`)
- Prompt 02 (auth — rôles)

## Tâches

### 1. Backend — CRUD Projects

**`backend/app/api/projects.py`** :

**GET `/projects`**
- Filtré par `user_id` du token (un user ne voit que ses projets)
- Admin voit tout
- Query params : `status`, `search`, `page`, `per_page`, `sort_by`, `order`
- Retourne : id, name, address, lat, lon, status, client (si lié), created_at, updated_at
- Inclure le nombre de panneaux et la puissance totale (kWc) si disponible

**POST `/projects`**
- Body : `{ name, address?, lat, lon, client_id?, notes? }`
- `lat` et `lon` obligatoires (coordonnées GPS)
- `client_id` optionnel (installateur lie un projet à un client)
- Status initial : `draft`
- Vérifier que `client_id` appartient à l'installateur courant

**GET `/projects/{id}`**
- Détail complet avec relations : roof_zones, panel_layouts, simulations, quotes
- Vérifier que le projet appartient à l'utilisateur (ou admin)

**PUT `/projects/{id}`**
- Modifier name, address, lat, lon, status, client_id, notes
- Vérifier ownership

**DELETE `/projects/{id}`**
- Cascade : supprime zones, layouts, simulations, schematic, quotes, reports
- Vérifier ownership
- Confirmation requise (le frontend doit demander confirmation)

### 2. Backend — CRUD Clients

**`backend/app/api/clients.py`** :
- Accessible uniquement par les installateurs et admins
- CRUD complet : GET list, POST, GET detail, PUT, DELETE
- Filtré par `installer_id` du token
- Un client a : name, address, phone, email, monthly_kwh, senelec_tariff_tier, notes
- GET list inclut le nombre de projets associés

### 3. Frontend — Liste des projets

**`frontend/src/app/[locale]/projects/page.tsx`** :
- Table ou grille de cards (toggle vue liste/grille)
- Colonnes : Nom, Adresse, Statut (badge coloré), Client, Puissance, Date
- Filtres : statut (dropdown), recherche texte
- Bouton "Nouveau projet" → dialog de création
- Clic sur un projet → navigation vers `/projects/{id}`

**Statuts avec couleurs** :
- `draft` → gris
- `study` → bleu
- `quote` → orange
- `signed` → vert
- `installed` → vert foncé

### 4. Frontend — Création de projet

**Dialog/page de création** :
- Champ nom (obligatoire)
- Champ adresse (optionnel, texte libre)
- Carte MapLibre miniature pour choisir la localisation :
  - Clic sur la carte → place un marqueur → remplit lat/lon
  - Recherche d'adresse (geocoding) → centre la carte
  - Coordonnées par défaut : Dakar (14.6928, -17.4467)
- Sélection client (dropdown, installateur uniquement)
- Notes (textarea optionnel)

### 5. Frontend — Vue projet

**`frontend/src/app/[locale]/projects/[id]/page.tsx`** :
- Header : nom du projet, statut (badge éditable), adresse
- Barre de navigation projet (onglets ou sidebar) :
  - Vue d'ensemble
  - Carte & Toit (→ `/projects/{id}/map`)
  - Panneaux (→ `/projects/{id}/panels`)
  - Vue 3D (→ `/projects/{id}/3d`)
  - Simulation (→ `/projects/{id}/simulation`)
  - Schéma unifilaire (→ `/projects/{id}/schematic`)
  - Devis (→ `/projects/{id}/quote`) — installateur only
  - Rapport (→ `/projects/{id}/report`)
- Vue d'ensemble : résumé des infos clés, client associé, dates, progression

### 6. Frontend — Fiches clients

**`frontend/src/app/[locale]/clients/page.tsx`** :
- Accessible uniquement par les installateurs
- Table : Nom, Téléphone, Email, Conso (kWh/mois), Nb projets
- Bouton "Ajouter un client"
- Dialog de création/édition avec tous les champs
- Clic sur un client → liste de ses projets filtrée

### 7. Frontend — Store

**`frontend/src/store/project.ts`** :
```typescript
interface ProjectStore {
  projects: Project[];
  currentProject: ProjectDetail | null;
  loading: boolean;
  fetchProjects: (filters?) => Promise<void>;
  fetchProject: (id: string) => Promise<void>;
  createProject: (data: CreateProject) => Promise<Project>;
  updateProject: (id: string, data: UpdateProject) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  updateStatus: (id: string, status: ProjectStatus) => Promise<void>;
}
```

## Critères d'acceptance

- [ ] CRUD projets fonctionne (créer, lister, modifier, supprimer)
- [ ] Un utilisateur ne voit que SES projets
- [ ] Un admin voit tous les projets
- [ ] La suppression de projet cascade correctement (zones, layouts, etc.)
- [ ] CRUD clients fonctionne (installateur uniquement)
- [ ] Un particulier ne peut pas accéder à `/clients`
- [ ] La carte miniature dans la création de projet fonctionne
- [ ] Les statuts s'affichent avec les bonnes couleurs
- [ ] Le filtre par statut et la recherche fonctionnent
- [ ] Navigation par onglets dans la vue projet
- [ ] Tous les labels traduits FR/EN

## Tests

- `test_projects.py` : CRUD, ownership, cascade delete
- `test_clients.py` : CRUD, permissions installateur
