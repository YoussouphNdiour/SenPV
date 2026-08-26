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

<!-- Ajouter les nouvelles décisions ci-dessous en incrémentant le numéro -->
