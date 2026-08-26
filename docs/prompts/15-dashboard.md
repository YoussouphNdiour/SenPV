# Prompt 15 — Dashboard

## Contexte

Dashboard personnalisé selon le rôle de l'utilisateur. C'est la page d'accueil après connexion.

## Dépendances

- Prompt 05 (project management — liste des projets)
- Prompt 09 (simulation — données de production)

## Tâches

### 1. Frontend — Dashboard Particulier

**`frontend/src/app/[locale]/dashboard/page.tsx`** :

Le dashboard s'adapte selon `session.user.role`.

**Pour un particulier** :
- **Header** : "Bienvenue, {nom}" + bouton "Nouveau projet"
- **Cartes KPI** (ligne de 3) :
  - Nombre de projets
  - Puissance totale installée (kWc) — somme de tous les projets simulés
  - Économies totales estimées (FCFA/an)
- **Liste des projets récents** (5 derniers) :
  - Card par projet : nom, adresse, statut (badge), puissance, date
  - Clic → `/projects/{id}`
- **Projet vide** : si aucun projet, afficher un CTA "Créez votre premier projet solaire"

### 2. Frontend — Dashboard Installateur

**Pour un installateur** :
- **Header** : "Bienvenue, {nom}" + nom entreprise + bouton "Nouveau projet"
- **Cartes KPI** (ligne de 5) :
  - Nombre de clients
  - Nombre de projets
  - Puissance totale (kWc)
  - CA total devis acceptés (FCFA)
  - Projets en cours (statut ≠ draft et ≠ installed)
- **Pipeline commercial** :
  - Kanban board simplifié (5 colonnes) :
    - Brouillon | Étude | Devis | Signé | Installé
  - Chaque projet = une card (nom client, puissance, montant devis)
  - Drag & drop pour changer de statut (PUT `/projects/{id}` avec nouveau status)
  - Compteur par colonne
- **Projets récents** (tableau) :
  - Colonnes : Client, Projet, Puissance, Statut, Devis (FCFA), Date
  - Tri et filtre
- **Graphique** :
  - Recharts BarChart : nombre de projets par mois (6 derniers mois)

### 3. Frontend — Dashboard Admin

**Pour un admin** :
- **Cartes KPI** (ligne de 4) :
  - Total utilisateurs
  - Total projets
  - Total kWc dimensionnés
  - Total installateurs actifs
- **Tableau utilisateurs récents** :
  - Colonnes : Nom, Email, Rôle, Inscrit le, Nb projets
  - Bouton changer rôle (dropdown)
- **Graphique** :
  - Inscriptions par mois (6 derniers mois)
  - Projets créés par mois
- **Catalogue global** :
  - Lien vers la page équipements en mode admin

### 4. Backend — API Dashboard

**`backend/app/api/dashboard.py`** (ou enrichir les routes existantes) :

**GET `/dashboard/stats`**
- Retourne les KPI selon le rôle du user :
  - Particulier : nb projets, total kWc, total savings
  - Installateur : nb clients, nb projets, total kWc, CA devis acceptés, projets en cours
  - Admin : total users, total projects, total kWc, nb installers
- Calcul via des requêtes SQL agrégées (COUNT, SUM)

**GET `/dashboard/recent-projects`**
- 5 derniers projets du user (ou tous pour admin)
- Inclure le kWc et le montant devis si disponible

**GET `/dashboard/pipeline`** (installateur)
- Projets groupés par statut
- Incluant : client name, kWc, quote total

**GET `/dashboard/charts`**
- Données pour les graphiques (projets par mois, inscriptions par mois)

### 5. Frontend — Composants

**`frontend/src/components/dashboard/KPICard.tsx`** :
- Card avec icône, valeur principale (grande police), label
- Variantes de couleur selon le type

**`frontend/src/components/dashboard/PipelineBoard.tsx`** :
- Kanban board avec 5 colonnes
- Cards draggables (utiliser `@dnd-kit/core` ou HTML drag API)
- Chaque card : nom client, nom projet, badge puissance kWc

**`frontend/src/components/dashboard/RecentProjectsTable.tsx`** :
- Table shadcn/ui avec les projets récents
- Colonnes adaptées au rôle

## Critères d'acceptance

- [ ] Le dashboard s'affiche selon le rôle (particulier/installateur/admin)
- [ ] Les KPI sont calculés correctement
- [ ] Le pipeline kanban affiche les projets dans la bonne colonne
- [ ] Le drag & drop du kanban change le statut du projet
- [ ] Les projets récents sont cliquables et mènent au projet
- [ ] Le graphique "projets par mois" s'affiche
- [ ] Le CTA "Nouveau projet" fonctionne
- [ ] L'admin peut changer le rôle d'un utilisateur
- [ ] L'état vide (aucun projet) affiche un CTA
- [ ] Labels traduits FR/EN
- [ ] Le dashboard est responsive (mobile friendly)

## Tests

- `test_dashboard.py` : stats par rôle, recent projects, pipeline data
