# Prompt 07 — Placement des Panneaux (Calpinage)

## Contexte

Après le dessin du toit (prompt 06), SenPV place automatiquement les panneaux solaires dans la zone de toit (calpinage). L'utilisateur peut ensuite ajouter/supprimer/déplacer des panneaux manuellement.

## Dépendances

- Prompt 04 (equipment — catalogue panneaux pour les dimensions)
- Prompt 06 (map — zones de toit dessinées)

## Tâches

### 1. Backend — Algorithme de calpinage

**`backend/app/services/calpinage.py`** :

L'algorithme de calpinage place le maximum de panneaux dans un polygone de toit :

```python
def compute_calpinage(polygon_wgs84, panel_specs, orientation_deg, tilt_deg,
                      spacing_x=0.02, spacing_y=0.02):
    """
    Place les panneaux dans le polygone de toit.
    
    Args:
        polygon_wgs84: Shapely Polygon en WGS84
        panel_specs: dict avec dimensions_mm {length, width}
        orientation_deg: azimuth du toit (0=Nord, 180=Sud)
        tilt_deg: inclinaison du toit
        spacing_x, spacing_y: espacement entre panneaux en mètres
    
    Returns:
        list[dict]: positions des panneaux [{center_lat, center_lon, rotation_deg}, ...]
    """
    # 1. Projeter le polygone en mètres (UTM zone 28N pour le Sénégal)
    # 2. Calculer la bounding box du polygone projeté
    # 3. Créer une grille de rectangles (dimensions panneau + spacing)
    # 4. Rotation de la grille selon l'orientation du toit
    # 5. Filtrer : ne garder que les panneaux entièrement à l'intérieur du polygone
    # 6. Re-projeter les centres en WGS84
    # 7. Retourner la liste des positions
```

**Points clés** :
- Projection UTM zone 28N (EPSG:32628) pour le Sénégal — calculs en mètres
- Dimensions panneau en mètres (convertir depuis mm)
- Rotation de la grille alignée avec l'orientation du toit
- Un panneau doit être ENTIÈREMENT dans le polygone (pas de dépassement)
- Considérer l'inclinaison : sur un toit incliné, la surface projetée est réduite (`cos(tilt)`)
- Retourner aussi le nombre de strings suggéré (basé sur la tension onduleur si disponible)

### 2. Backend — API Panel Layouts

**`backend/app/api/panel_layouts.py`** :

**POST `/projects/{id}/layouts`**
- Body : `{ roof_zone_id, panel_model_id, inverter_model_id?, spacing_x?, spacing_y? }`
- Charger la zone de toit (polygone) et le panneau (dimensions)
- Exécuter `compute_calpinage()`
- Sauvegarder le layout avec `layout_geojson` contenant les positions
- Calculer `num_panels`, `num_strings`, `panels_per_string`
- Retourner le layout avec les positions

**PUT `/projects/{id}/layouts/{lid}`**
- Modifier le layout (ajout/suppression de panneaux manuels)
- `layout_geojson` mis à jour

**POST `/projects/{id}/layouts/{lid}/add-panel`**
- Body : `{ lat, lon }`
- Ajouter un panneau à une position spécifique
- Vérifier que le point est dans la zone de toit
- Mettre à jour `num_panels`, `layout_geojson`

**DELETE `/projects/{id}/layouts/{lid}/panels/{index}`**
- Supprimer un panneau par index
- Mettre à jour `num_panels`, `layout_geojson`

**GET `/projects/{id}/layouts`**
- Lister les layouts avec positions pour affichage carte

### 3. Frontend — Affichage des panneaux sur la carte

**`frontend/src/components/panels/PanelGrid.tsx`** :
- Utilise Deck.gl `PolygonLayer` pour afficher les panneaux
- Chaque panneau = rectangle positionné et orienté
- Couleur : bleu foncé (#1e3a5f) normal, bleu clair (#4a90d9) au survol
- Quand le calpinage se termine, les panneaux apparaissent en animation (pop-in)

### 4. Frontend — Toolbar panneaux

**`frontend/src/components/panels/PanelToolbar.tsx`** :
- Intégrée dans la toolbar carte (extends DrawingTools)
- Modes supplémentaires :
  - **Ajouter** : clic sur la carte → place un panneau (POST add-panel)
  - **Sélectionner** : clic sur un panneau → popup info (modèle, puissance, position)
  - **Supprimer** : clic sur un panneau → supprime (DELETE)
  - **Annuler** : undo dernière action (stack d'historique local)
  - **Tout effacer** : supprime tous les panneaux de la zone (avec confirmation)

### 5. Frontend — Badge compteur

**`frontend/src/components/panels/PanelBadge.tsx`** :
- Badge fixe en bas à gauche de la carte
- Affiche : `{count} panneaux — {kwc} kWc`
- Se met à jour en temps réel à chaque ajout/suppression
- `kWc = count × panel.pmax_w / 1000`

### 6. Frontend — Sélection du panneau et de l'onduleur

Avant le calpinage, l'utilisateur doit choisir :
- Le modèle de panneau (dropdown depuis le catalogue)
- Le modèle d'onduleur (dropdown, optionnel à ce stade)
- L'espacement entre panneaux (slider ou input, défaut 2cm)

Ce choix peut être dans le panel latéral de la zone ou dans un dialog.

### 7. Frontend — Undo/Redo

Implémenter un historique d'actions local (Zustand) :
```typescript
interface PanelHistory {
  action: 'add' | 'remove' | 'calpinage' | 'clear';
  panels: PanelPosition[];  // état avant l'action
}
```
- "Annuler" restaure l'état précédent et appelle PUT layout
- Stack de 20 actions max

## Critères d'acceptance

- [ ] Le calpinage auto place les panneaux dans le polygone sans dépassement
- [ ] L'orientation des panneaux suit l'orientation du toit
- [ ] L'espacement entre panneaux est respecté
- [ ] Les panneaux s'affichent sur la carte (Deck.gl)
- [ ] Mode "Ajouter" : clic → panneau placé (vérifié dans la zone)
- [ ] Mode "Supprimer" : clic sur panneau → supprimé
- [ ] Mode "Sélectionner" : clic → popup info
- [ ] Le badge compteur se met à jour en temps réel
- [ ] Undo fonctionne (dernière action annulée)
- [ ] "Tout effacer" supprime tous les panneaux (avec confirmation)
- [ ] Le choix du modèle de panneau utilise le catalogue (prompt 04)
- [ ] Layout sauvegardé en BDD (positions GeoJSON)
- [ ] Tous les labels traduits FR/EN

## Tests

- `test_calpinage.py` : placement dans un rectangle, un triangle, un L
- `test_panel_layouts.py` : CRUD layouts, add/remove panneaux
