# Prompt 06 — Carte & Dessin de Toit

## Contexte

Page carte interactive avec MapLibre GL JS pour dessiner les polygones de toit. C'est le point d'entrée principal du workflow projet : l'utilisateur dessine son toit, puis le calpinage (placement automatique des panneaux) se lance.

## Dépendances

- Prompt 00 (project setup — MapLibre installé)
- Prompt 05 (project management — un projet existe avec lat/lon)

## Tâches

### 1. Frontend — Composant carte

**`frontend/src/components/map/MapView.tsx`** :
- Conteneur MapLibre GL JS plein écran (dans la zone de contenu du projet)
- Style de fond : satellite imagery (tiles OpenStreetMap ou Mapbox satellite si token dispo, sinon OSM standard)
- Centre initial : coordonnées du projet (lat, lon) avec zoom 19 (niveau toit)
- Contrôles : zoom +/-, plein écran, géolocalisation
- Couche de dessin pour les polygones (voir ci-dessous)

**`frontend/src/components/map/GeoSearch.tsx`** :
- Barre de recherche d'adresse en haut de la carte
- Geocoding via Nominatim (OpenStreetMap, gratuit, pas de clé API)
- Résultats en dropdown, clic → centre la carte et place un marqueur
- Debounce 300ms sur la frappe

### 2. Frontend — Outils de dessin

**`frontend/src/components/map/DrawingTools.tsx`** :
- Toolbar overlay en haut à gauche de la carte
- Boutons :
  - **Zone** : mode dessin de polygone (clic pour ajouter des points, double-clic pour fermer)
  - **Modifier** : mode édition (déplacer les sommets d'un polygone existant)
  - **Supprimer zone** : clic sur une zone pour la supprimer
  - **Annuler** : undo dernière action

**Implémentation du dessin** :
- Utiliser `@mapbox/mapbox-gl-draw` adapté pour MapLibre, OU implémenter un dessin custom avec les events MapLibre :
  - `click` → ajouter un point au polygone en cours
  - `dblclick` → fermer le polygone
  - `mousemove` → ligne de prévisualisation
- Le polygone est affiché en semi-transparent (fill bleu 30% + stroke bleu 2px)
- Plusieurs zones possibles par projet (multi-zone)

### 3. Frontend — Gestion des zones

Quand un polygone est fermé :
1. Calculer l'aire en m² (projection Mercator → WGS84)
2. Afficher un panel latéral avec les propriétés de la zone :
   - Aire (m²) — calculé automatiquement
   - Orientation (°) — saisie manuelle ou détection automatique depuis la forme
   - Inclinaison (°) — saisie manuelle
   - Type de toit : plat, deux pans, quatre pans, mono-pente (dropdown)
3. Sauvegarder via `POST /projects/{id}/zones` avec le GeoJSON du polygone
4. Déclencher le calpinage automatique (prompt 07)

### 4. Backend — CRUD Roof Zones

**`backend/app/api/roof_zones.py`** :

**POST `/projects/{id}/zones`**
- Body : `{ polygon: GeoJSON, orientation_deg?, tilt_deg?, roof_type? }`
- Convertir le GeoJSON en Geometry PostGIS (SRID 4326)
- Calculer `area_m2` avec `ST_Area(polygon::geography)`
- Attribuer `zone_index` incrémental
- Retourne la zone créée avec l'aire calculée

**GET `/projects/{id}/zones`**
- Liste des zones du projet avec géométries en GeoJSON

**PUT `/projects/{id}/zones/{zid}`**
- Modifier le polygone, l'orientation, l'inclinaison, le type de toit
- Recalculer l'aire si le polygone change

**DELETE `/projects/{id}/zones/{zid}`**
- Supprimer la zone et ses panel_layouts associés (cascade)

### 5. Frontend — Affichage des zones existantes

Quand la page carte s'ouvre pour un projet existant :
- Charger les zones depuis `GET /projects/{id}/zones`
- Afficher chaque zone comme un polygone sur la carte (fill coloré, stroke)
- Couleurs différentes par zone (palette de 6 couleurs)
- Clic sur une zone existante → affiche le panel de propriétés
- Possibilité de modifier le polygone (drag des sommets)

### 6. Frontend — Store carte

**`frontend/src/store/map.ts`** :
```typescript
interface MapStore {
  mapMode: 'navigate' | 'draw-zone' | 'edit-zone' | 'delete-zone' |
           'add-panel' | 'select-panel' | 'delete-panel';
  selectedZoneId: string | null;
  zones: RoofZone[];
  setMapMode: (mode: MapMode) => void;
  setSelectedZone: (id: string | null) => void;
  addZone: (zone: RoofZone) => void;
  updateZone: (id: string, data: Partial<RoofZone>) => void;
  removeZone: (id: string) => void;
}
```

### 7. Frontend — Deck.gl layers (préparation)

**`frontend/src/components/map/PanelLayer.tsx`** :
- Préparer la couche Deck.gl `PolygonLayer` pour afficher les panneaux individuels
- Chaque panneau est un petit rectangle positionné en WGS84
- Couleur : bleu foncé (panneau), bleu clair (sélectionné)
- Cette couche sera utilisée par le prompt 07 (panel placement)

## Critères d'acceptance

- [ ] La carte MapLibre s'affiche centrée sur les coordonnées du projet
- [ ] Zoom niveau 19 (vue toit) par défaut
- [ ] La recherche d'adresse (Nominatim) fonctionne avec debounce
- [ ] Le mode dessin permet de tracer un polygone (clic + double-clic)
- [ ] Le polygone s'affiche en semi-transparent
- [ ] L'aire est calculée automatiquement en m²
- [ ] Le panel de propriétés de zone s'affiche après le dessin
- [ ] Multi-zone : on peut dessiner plusieurs polygones
- [ ] Les zones sont sauvegardées en BDD (PostGIS, SRID 4326)
- [ ] Les zones existantes se rechargent à l'ouverture
- [ ] Modification des sommets par drag fonctionne
- [ ] Suppression d'une zone fonctionne
- [ ] Tous les labels traduits FR/EN

## Tests

- `test_roof_zones.py` : CRUD zones, calcul d'aire, GeoJSON valide
