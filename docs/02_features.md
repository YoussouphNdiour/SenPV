# 02 — Features

> Liste exhaustive des fonctionnalites de SenPV, organisees par module.

---

## Module 1 — Authentification & Roles (Prompt 02)

- Inscription par email (nom, email, mot de passe)
- Inscription via Google OAuth (optionnel)
- Connexion JWT (access token + refresh)
- 3 roles : `particular`, `installer`, `admin`
- Profil installateur : nom entreprise, adresse, telephone, NINEA, logo, conditions de paiement
- Protection des routes (proxy.ts dans Next.js 16)
- Changement de langue (FR/EN) dans le profil

## Module 2 — Internationalisation (Prompt 03)

- 16 namespaces de traduction (common, auth, dashboard, projects, equipment, map, panels, viewer3d, simulation, senelec, financial, schematic, quote, report, admin, errors)
- Francais par defaut, anglais en option
- LocaleSwitcher dans le header
- Toutes les chaines UI passent par `useTranslations()` (next-intl)

## Module 3 — Catalogue Equipements (Prompt 04)

### Panneaux solaires
- CRUD complet (creer, lire, modifier, supprimer)
- Specs techniques JSONB : Pmax, Voc, Vmp, Isc, Imp, rendement, coeff temperature, NOCT, cellules, type cellule, dimensions, poids, garantie
- Catalogue global (admin) + catalogue perso (installateur)
- Validation des specs (Pydantic)
- 3 panneaux pre-charges : JA Solar 545W, Canadian Solar 550W, Jinko 540W

### Onduleurs
- CRUD complet
- Specs techniques JSONB : puissance PV max, tension max, tension demarrage, plage MPPT, courants max, nb MPPT, strings par MPPT, puissance AC, rendement, protections, dimensions, IP, garantie
- 3 onduleurs pre-charges : Huawei SUN2000-5KTL, Growatt MIN 5000TL-X, Sungrow SG5.0RS

## Module 4 — Gestion de Projets (Prompt 05)

- CRUD projets (nom, adresse, lat/lon, statut, notes)
- 5 statuts : draft, study, quote, signed, installed
- Association client optionnelle (FK)
- CRUD clients (nom, adresse, telephone, email, conso mensuelle kWh, tranche SENELEC, notes)
- Filtrage par utilisateur (chaque user ne voit que ses projets)
- StatusBadge composant partage (couleurs par statut)

## Module 5 — Carte & Dessin de Toit (Prompt 06)

- Carte interactive MapLibre GL JS
- Recherche d'adresse (geocoding Nominatim)
- Dessin de polygones (zones de toit) directement sur la carte
- Implementation custom du dessin (pas de mapbox-gl-draw — ADR-010)
- Sauvegarde PostGIS (POLYGON, SRID 4326)
- Orientation, inclinaison, type de toit (flat/gable/hip/shed)
- Calcul automatique de l'aire (m2)
- CRUD zones (creer, modifier, supprimer)

## Module 6 — Placement de Panneaux / Calpinage (Prompt 07)

- Algorithme de calpinage automatique :
  - Projection UTM zone 28N (EPSG:32628)
  - Grille de panneaux dans le polygone de toit
  - Rotation selon l'orientation
  - Clipping aux bords du polygone
  - Espacement configurable (spacing_x, spacing_y)
- Placement manuel (ajouter/supprimer des panneaux)
- Configuration strings (nb strings, panneaux par string)
- Undo/redo
- Layout GeoJSON sauvegarde en JSONB

## Module 7 — Visualisation 3D (Prompt 08)

- React Three Fiber integre (pas d'iframe — ADR dans architecture)
- 4 types de toit : flat, gable, hip, shed
- instancedMesh pour performance (>50 panneaux)
- Animation pop-in (easeOutBack)
- Controles : rotation, zoom, pan
- Zustand store dedie pour les controles 3D
- Screenshot (preserveDrawingBuffer)
- Dynamic import avec ssr:false

## Module 8 — Simulation PV (Prompt 09)

- pvlib ModelChain (simulation complete)
- Donnees meteo TMY via PVGIS
- Parametres : lat, lon, tilt, azimuth, pertes, albedo
- Conversion gamma_pdc : %/C -> fraction/C (ADR-012)
- Production mensuelle (12 mois) + annuelle
- Productivite specifique (kWh/kWc)
- Performance ratio
- Cache Redis (resultats de simulation)
- Fallback estimation : 1650 kWh/kWc pour Dakar
- Tache Celery pour simulations longues
- Graphique Recharts (barres production mensuelle)
- Optimisation tilt/azimuth automatique

## Module 9 — Facturation SENELEC (Prompt 10)

- Grille tarifaire progressive (4 tranches) :
  - DPP : 0-150 kWh -> 90.47 FCFA/kWh
  - DMP : 151-250 kWh -> 101.64 FCFA/kWh
  - DGP : >250 kWh -> 112.65 FCFA/kWh
  - PP : Professionnel -> 118.00 FCFA/kWh
- TVA 18% + redevance mensuelle 872 FCFA
- Calcul facture mensuelle sans PV
- Calcul economies avec PV (autoconsommation)
- Comparaison avant/apres

## Module 10 — Analyse Financiere (Prompt 11)

- Calculs sur 25 ans avec degradation (0.5%/an)
- VAN (Valeur Actuelle Nette) avec taux d'actualisation
- TRI (Taux de Rendement Interne) par methode Newton
- LCOE (Cout de l'Energie Actualisee)
- Payback period (temps de retour)
- Cashflow annuel cumule (25 ans)
- Prise en compte inflation tarifs SENELEC
- Graphique Recharts (courbe cashflow cumule)

## Module 11 — Schema Unifilaire (Prompt 12)

### Backend (networkx)
- Auto-generation du graphe electrique depuis la configuration PV
- Composants : panneaux, strings, coffret DC, parafoudre, disjoncteur DC, onduleur, disjoncteur AC, parafoudre AC, tableau AC, compteur, reseau SENELEC, terre
- Validation electrique :
  - Tension string <= Vmax onduleur
  - Courant string <= Imax MPPT
  - Nb strings <= nb entrees
  - Tension MPPT dans la plage
  - Noeuds non connectes
  - Calibre disjoncteur DC
- Propagation en cascade (modification -> re-validation)
- Layout hierarchique manuel (pas de pygraphviz)

### Frontend (React Flow)
- Noeuds custom pour chaque composant electrique
- Aretes custom (section cable, type DC/AC)
- Palette de symboles (drag & drop)
- Panel de validation (erreurs/warnings)
- Export SVG pour inclusion dans le rapport PDF

## Module 12 — Devis (Prompt 13)

- CRUD devis (installer uniquement)
- Reference auto-generee : DEV-YYYY-NNNN
- Lignes editables : description, quantite, prix unitaire
- Ajout depuis le catalogue d'equipements
- Calculs temps reel : sous-total, marge (%), TVA (18%), total TTC
- Conditions de paiement (texte libre)
- Validite (jours, defaut 30)
- 4 statuts : draft, sent, accepted, rejected
- PDF WeasyPrint avec logo installateur
- Apercu fidele au PDF dans l'editeur

## Module 13 — Rapport PDF (Prompt 14) [A FAIRE]

- Rapport complet multi-pages :
  - Couverture (SenPV + logo installateur)
  - Resume executif (KPI)
  - Configuration technique (panneaux, onduleur)
  - Production solaire (graphique barres + tableau)
  - Analyse economique (graphique cashflow + tableau)
  - Schema unifilaire (SVG pleine page)
  - Devis (si installateur)
  - Mentions legales
- 3 modes d'export : full_report, quote_only, schematic_only
- Generation en background (Celery)
- Graphiques matplotlib -> SVG inline
- WeasyPrint (HTML/CSS -> PDF)

## Module 14 — Dashboard (Prompt 15) [A FAIRE]

### Particulier
- KPI : nb projets, kWc total, economies/an
- Liste projets recents (5 derniers)
- CTA "Nouveau projet" si vide

### Installateur
- KPI : nb clients, nb projets, kWc total, CA devis acceptes, projets en cours
- Pipeline kanban (5 colonnes : draft/study/quote/signed/installed)
- Drag & drop pour changer statut
- Graphique projets/mois (6 derniers mois)

### Admin
- KPI : total users, total projets, total kWc, nb installateurs
- Tableau utilisateurs (changer role)
- Graphique inscriptions/mois

## Module 15 — Deploiement (Prompt 16) [A FAIRE]

- Docker Compose production (7 services)
- Traefik reverse proxy (HTTPS auto Let's Encrypt)
- Portainer (UI gestion Docker)
- Dockerfiles multi-stage (frontend + backend)
- Scripts : init.sh (migrations, seed), backup.sh (BDD + uploads)
- docker-compose.dev.yml pour le developpement local
- Healthchecks PostgreSQL et Redis
- Variables d'environnement documentees (.env.example)
