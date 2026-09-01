# SenPV — Décisions Techniques (ADR)

> Architecture Decision Records — chaque décision technique importante est documentée ici avec son contexte, les alternatives considérées et la justification.

---

## ADR-001 — MapLibre GL JS au lieu d'ArcGIS

- **Date** : 2026-08-26
- **Statut** : Accepté

**Contexte** :
Le projet SolarIntel (v1) utilisait ArcGIS JS SDK 4.30 qui nécessite une licence et pèse ~2MB.

**Alternatives considérées** :
1. ArcGIS JS SDK — puissant mais licence payante, lourd
2. Leaflet — léger mais limité en 3D et performances vectorielles
3. MapLibre GL JS — open source, vector tiles, performant

**Décision** :
MapLibre GL JS + Deck.gl pour les couches de données. Open source, gratuit, performances similaires à Mapbox/ArcGIS.

**Conséquences** :
- Pas de licence à gérer
- Geocoding via Nominatim (gratuit) au lieu d'ArcGIS Geocoder
- Tiles satellite à configurer (OpenStreetMap standard ou Mapbox si token)

---

## ADR-002 — React Flow pour le schéma unifilaire

- **Date** : 2026-08-26
- **Statut** : Accepté

**Contexte** :
Le schéma unifilaire est un diagramme électrique interactif. Besoin d'un éditeur de graphe avec drag & drop, nœuds custom, et arêtes connectables.

**Alternatives considérées** :
1. Canvas custom (HTML5 Canvas / Konva.js) — contrôle total mais tout à développer
2. D3.js — flexible mais bas niveau pour de l'interactivité
3. React Flow — composants React, nœuds custom, arêtes, minimap, intégré

**Décision** :
React Flow (frontend) + networkx (backend). React Flow pour l'UI, networkx pour la logique de graphe et la validation.

**Conséquences** :
- UI interactive out-of-the-box (drag, zoom, connect)
- Nœuds custom pour les symboles électriques
- Le backend valide le graphe (pas de logique critique côté client)

---

## ADR-003 — networkx pour la validation électrique

- **Date** : 2026-08-26
- **Statut** : Accepté

**Contexte** :
Le schéma unifilaire doit être validé électriquement (tensions, courants, calibres). Cette validation est un problème de parcours de graphe.

**Alternatives considérées** :
1. Validation procédurale (if/else) — simple mais ne scale pas
2. networkx — librairie de graphes Python mature, parcours, analyse
3. Base de données graphe (Neo4j) — overkill pour un graphe par projet

**Décision** :
networkx en mémoire. Le graphe est sérialisé en JSONB dans PostgreSQL et reconstruit à la demande.

**Conséquences** :
- Validation propre par parcours de nœuds
- Auto-dimensionnement en cascade (propagation)
- Pas de service supplémentaire à maintenir

---

## ADR-004 — WeasyPrint au lieu de ReportLab

- **Date** : 2026-08-26
- **Statut** : Accepté

**Contexte** :
SolarIntel v1 utilisait ReportLab pour les PDFs. Le code était verbeux et difficile à maintenir (positionnement pixel par pixel).

**Alternatives considérées** :
1. ReportLab — puissant mais API bas niveau, code verbeux
2. WeasyPrint — HTML/CSS → PDF, templates Jinja2, maintenable
3. Puppeteer/Playwright — headless browser, lourd en dépendances

**Décision** :
WeasyPrint avec templates HTML/CSS Jinja2. Les graphiques sont en SVG inline (matplotlib).

**Conséquences** :
- Templates HTML lisibles et modifiables
- CSS pour le layout (flexbox, grid, @page)
- Dépendance système (libpango, libcairo) → gérée dans le Dockerfile

---

## ADR-005 — PostgreSQL + PostGIS (pas de graph DB)

- **Date** : 2026-08-26
- **Statut** : Accepté

**Contexte** :
Le projet a des données géospatiales (polygones de toit) et des données relationnelles (users, projects, quotes).

**Alternatives considérées** :
1. PostgreSQL + PostGIS — une seule BDD pour tout
2. PostgreSQL + MongoDB (JSONB pour les specs) — complexité de 2 BDD
3. PostgreSQL + Neo4j (pour les schémas) — overkill

**Décision** :
PostgreSQL + PostGIS uniquement. JSONB pour les données semi-structurées (specs, schemas). networkx en mémoire pour les graphes.

**Conséquences** :
- Une seule BDD à maintenir et sauvegarder
- PostGIS pour les calculs géospatiaux (aire, distance, containment)
- JSONB pour la flexibilité (specs équipements variables)

---

## ADR-006 — Suppression de CrewAI/Ollama

- **Date** : 2026-08-26
- **Statut** : Accepté

**Contexte** :
SolarIntel v1 avait un système multi-agents IA (CrewAI + Ollama) pour générer des briefs techniques. Trop lourd, complexe, et non essentiel au produit.

**Décision** :
Supprimer complètement. Le rapport est généré à partir des données de simulation et des templates, sans IA.

**Conséquences** :
- Pas de dépendance Ollama (pas de GPU requis)
- Pas de CrewAI (grosse dépendance supprimée)
- Rapports déterministes et instantanés

---

## ADR-007 — Next.js 16 proxy.ts au lieu de middleware.ts

- **Date** : 2026-08-26
- **Statut** : Accepté

**Contexte** :
Next.js 16 a déprécié `middleware.ts` en faveur de `proxy.ts` pour la protection des routes et la redirection.

**Décision** :
Utiliser `proxy.ts` avec `export function proxy()` pour la protection des routes (auth, rôles, locale).

**Conséquences** :
- Les prompts suivants qui touchent au routing doivent utiliser `proxy.ts`, pas `middleware.ts`
- Le prompt 03 (i18n) doit intégrer la détection de locale dans `proxy.ts`

---

## ADR-008 — SQLite pour les tests (sans PostGIS)

- **Date** : 2026-08-26
- **Statut** : Accepté

**Contexte** :
Les tests backend utilisent SQLite en mémoire pour la rapidité. Mais SQLite ne supporte pas PostGIS (colonne `Geometry` sur `roof_zones`).

**Décision** :
- Utiliser SQL-level DELETE au lieu de ORM cascade pour la suppression de projets dans les tests
- Skip `selectinload` pour les relations géospatiales dans les tests SQLite
- Les tests PostGIS-spécifiques (calpinage, zones) seront testés contre PostgreSQL réel

**Conséquences** :
- Les tests CRUD simples tournent vite (SQLite in-memory)
- Les tests géospatiaux nécessitent `docker compose -f docker-compose.dev.yml up postgres`

---

## ADR-009 — Route group `(app)` pour les pages authentifiées

- **Date** : 2026-08-26
- **Statut** : Accepté

**Contexte** :
Les pages authentifiées (dashboard, projects, equipment, clients) partagent un layout commun (AppLayout avec sidebar + header). Les pages auth (login, register) n'ont pas ce layout.

**Décision** :
Utiliser un route group Next.js `(app)/layout.tsx` qui wrappe `AppLayout` pour toutes les pages authentifiées.

**Conséquences** :
- `src/app/[locale]/(app)/` contient les pages avec sidebar
- `src/app/[locale]/auth/` est hors du route group, sans sidebar
- StatusBadge est un composant partagé réutilisable

---

## ADR-010 — Dessin custom MapLibre au lieu de mapbox-gl-draw

- **Date** : 2026-08-26
- **Statut** : Accepté

**Contexte** :
Le prompt 06 suggère d'utiliser `@mapbox/mapbox-gl-draw` ou un dessin custom. MapLibre GL JS v6 est ESM-only et mapbox-gl-draw a des problèmes de compatibilité.

**Décision** :
Implémentation custom du dessin de polygones avec les événements MapLibre (`click`, `dblclick`, `mousemove`). Le state est géré dans un store Zustand dédié (`map.ts`).

**Conséquences** :
- Pas de dépendance supplémentaire
- Contrôle total sur l'UX de dessin
- Les CustomEvents (`senpv:delete-zone`, `senpv:finish-zone`) permettent de communiquer le token auth aux handlers map initialisés dans un `useEffect` asynchrone

---

## ADR-011 — Dynamic import pour maplibre-gl

- **Date** : 2026-08-26
- **Statut** : Accepté

**Contexte** :
maplibre-gl v6 est un module ESM-only sans export default. L'import statique cause des erreurs TypeScript et des problèmes de SSR dans Next.js.

**Décision** :
Utiliser `const maplibregl = await import("maplibre-gl")` dans un `useEffect` asynchrone. Le ref map est typé `any` pour éviter les conflits de types avec les méthodes MapLibre.

**Conséquences** :
- La carte se charge après le premier rendu (pas de SSR pour le canvas WebGL)
- Le CSS maplibre est aussi importé dynamiquement
- Le pattern est cohérent avec `CreateProjectDialog.tsx` (prompt 05)

---

## ADR-012 — gamma_pdc : conversion %/°C → fraction/°C pour pvlib

- **Date** : 2026-08-26
- **Statut** : Accepté

**Contexte** :
Les datasheets panneaux donnent le coefficient de température Pmax en %/°C (ex: -0.350%/°C). pvlib attend `gamma_pdc` en fraction/°C (ex: -0.350). Le champ `temp_coeff_pmax_pct_per_c` dans les specs JSONB stocke la valeur en %/°C.

**Décision** :
Diviser par 100 dans `pvlib_service.py` : `gamma_pdc = panel_specs['temp_coeff_pmax_pct_per_c'] / 100`

**Conséquences** :
- Sans cette conversion, la production serait fausse de ~100x
- La convention de stockage en JSONB reste en %/°C (cohérent avec les datasheets)
- La conversion se fait uniquement au point d'entrée pvlib

---

<!-- Ajouter les nouvelles décisions ci-dessous en incrémentant le numéro -->
