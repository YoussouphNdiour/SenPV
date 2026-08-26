# Prompt 08 — Visualisation 3D

## Contexte

Intégrer le viewer 3D directement dans l'app Next.js (React Three Fiber). Plus d'iframe, plus de sous-projet séparé. Le viewer affiche le bâtiment, le toit, et les panneaux solaires en 3D interactive.

Code source de référence : l'ancien `solarintel-3d/` (React Three Fiber + Zustand + Three.js).

## Dépendances

- Prompt 07 (panel placement — positions des panneaux)

## Tâches

### 1. Frontend — Composants 3D

Migrer et adapter les composants depuis l'ancien `solarintel-3d/src/components/` :

**`frontend/src/components/viewer3d/RoofScene.tsx`** :
- Scène Three.js principale
- Canvas React Three Fiber avec `<Canvas shadows camera={{ position: [20, 20, 20] }}>`
- Éclairage : directional light (soleil), ambient light
- Fond : ciel gradient (bleu clair)
- OrbitControls (rotation, zoom, pan)
- Grid helper (optionnel, toggleable)

**`frontend/src/components/viewer3d/Building.tsx`** :
- Bâtiment simplifié (parallélépipède)
- Dimensions dérivées de la zone de toit (bounding box du polygone)
- Hauteur par défaut : 3m (paramétrable)
- Matériau : gris clair (#e0e0e0)

**`frontend/src/components/viewer3d/RoofMesh.tsx`** :
- Toit généré à partir du type sélectionné :
  - **Plat** : simple plan horizontal
  - **Deux pans (gable)** : forme en V inversé, angle = inclinaison
  - **Quatre pans (hip)** : pyramide tronquée
  - **Mono-pente (shed)** : plan incliné
- Matériau : rouge tuile (#c45a3c) semi-transparent
- Les dimensions suivent le polygone de toit réel

**`frontend/src/components/viewer3d/SolarPanels3D.tsx`** :
- Un mesh par panneau positionné sur le toit
- Position calculée à partir des coordonnées du layout (WGS84 → coordonnées locales 3D)
- Dimensions du panneau depuis les specs equipment
- Matériau : bleu foncé (#1a2744) avec reflet métallique (MeshStandardMaterial, metalness=0.3)
- Animation d'apparition (pop-in scale) au chargement
- Survol : highlight (émission légère)

**`frontend/src/components/viewer3d/Controls.tsx`** :
- Panel de contrôle overlay sur le viewer 3D
- Toggles :
  - Afficher/masquer le bâtiment
  - Afficher/masquer les panneaux
  - Afficher/masquer la grille
  - Type de toit (dropdown)
- Sliders :
  - Inclinaison du toit (0-45°)
  - Rotation du bâtiment (0-360°)
  - Hauteur du bâtiment
- Boutons :
  - Reset vue (recentrer caméra)
  - Capture screenshot (canvas.toDataURL)

### 2. Frontend — Page 3D du projet

**`frontend/src/app/[locale]/projects/[id]/3d/page.tsx`** :
- Charge les données du projet (zones, layouts, equipment specs)
- Affiche le viewer 3D en pleine zone de contenu
- Panel de contrôle à droite ou overlay
- Bouton retour vers la vue carte

### 3. Conversion coordonnées

**`frontend/src/lib/geo.ts`** — ajouter :
```typescript
/**
 * Convertit les coordonnées WGS84 des panneaux en coordonnées locales 3D.
 * Le centre du toit = origin (0,0,0).
 * X = est, Y = altitude, Z = sud.
 */
function wgs84ToLocal3D(
  lat: number, lon: number,
  centerLat: number, centerLon: number,
  tiltDeg: number
): { x: number; y: number; z: number }
```

### 4. Optimisation

- Utiliser `instancedMesh` pour les panneaux si > 50 panneaux (performance)
- Lazy load du canvas 3D (`dynamic(() => import(...), { ssr: false })`)
- Le viewer 3D ne doit pas bloquer le chargement de la page

## Critères d'acceptance

- [ ] Le viewer 3D s'affiche dans la page projet (pas d'iframe)
- [ ] Le bâtiment s'affiche avec les bonnes dimensions
- [ ] Les 4 types de toit s'affichent correctement (plat, gable, hip, shed)
- [ ] Les panneaux sont positionnés sur le toit aux bonnes positions
- [ ] OrbitControls : rotation, zoom, pan fonctionnent
- [ ] Les toggles (bâtiment, panneaux, grille) fonctionnent
- [ ] Les sliders (inclinaison, rotation, hauteur) mettent à jour la scène en temps réel
- [ ] Animation pop-in des panneaux au chargement
- [ ] Le viewer est lazy-loaded (pas de SSR)
- [ ] Performance OK avec 50+ panneaux (instancedMesh)
- [ ] Capture screenshot fonctionne
- [ ] Labels traduits FR/EN
