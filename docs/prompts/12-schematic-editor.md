# Prompt 12 — Éditeur Schéma Unifilaire

## Contexte

Éditeur de schéma unifilaire (single-line diagram) interactif avec React Flow côté frontend et networkx côté backend. Le schéma est auto-généré à partir de la configuration PV (panneaux, strings, onduleur), puis l'utilisateur peut le modifier par drag & drop.

Référence architecture : `docs/architecture.md` section 5.2 (Graph Engineering).

## Dépendances

- Prompt 04 (equipment — specs panneaux et onduleurs)
- Prompt 07 (panel placement — layout avec nb panneaux, strings, onduleur)

## Tâches

### 1. Backend — Service graphe électrique

**`backend/app/services/schematic_graph.py`** :

Implémenter les 3 fonctions décrites dans `docs/architecture.md` §5.2 :

**`generate_schematic(panel_layout, panel_specs, inverter_specs)`**
- Crée un graphe networkx DiGraph
- Nœuds : panneaux (groupés en strings), string combiners, coffret DC, parafoudre DC, disjoncteur DC, onduleur, disjoncteur AC, parafoudre AC, coffret AC, compteur bidirectionnel, réseau SENELEC, terre
- Arêtes : câbles DC (entre panneaux et onduleur), câbles AC (onduleur vers réseau)
- Attributs sur chaque nœud : type, specs, ratings calculés
- Attributs sur chaque arête : cable_type (dc/ac), section_mm2

**`validate_electrical(G, panel_specs, inverter_specs, panel_layout)`**
- Validation tension string ≤ Vmax onduleur
- Validation courant string ≤ Imax MPPT
- Validation nb strings ≤ nb entrées MPPT × strings/MPPT
- Validation tension Vmp dans la plage MPPT
- Vérification nœuds non connectés
- Vérification calibre disjoncteurs
- Retourne une liste d'erreurs avec severity (critical/warning) et message

**`graph_to_reactflow(G)`**
- Convertit le graphe networkx en format React Flow (nodes + edges JSON)
- Layout automatique hiérarchique (de gauche à droite : panneaux → onduleur → réseau)
- Positions calculées proprement avec espacement régulier

**`reactflow_to_graph(nodes, edges)`**
- Conversion inverse : React Flow → networkx (pour re-validation après édition)

### 2. Backend — Auto-dimensionnement

**`backend/app/services/schematic_graph.py`** (dans le même fichier) :

```python
def calc_dc_breaker_rating(panel_specs, panel_layout):
    """Calibre disjoncteur DC = Isc × 1.25, arrondi au calibre normalisé supérieur."""
    min_rating = panel_specs['isc_a'] * 1.25
    standard_ratings = [6, 10, 16, 20, 25, 32, 40, 50, 63]
    return next(r for r in standard_ratings if r >= min_rating)

def calc_ac_breaker_rating(inverter_specs):
    """Calibre disjoncteur AC = Iac nominal × 1.25."""
    min_rating = inverter_specs['rated_ac_current_a'] * 1.25
    standard_ratings = [6, 10, 16, 20, 25, 32, 40, 50, 63]
    return next(r for r in standard_ratings if r >= min_rating)

def calc_cable_section(current_a, length_m, voltage_drop_pct=3):
    """Section câble en mm² selon le courant et la chute de tension admissible."""
    resistivity = 0.0225  # cuivre, ohm.mm²/m
    section = (2 * resistivity * length_m * current_a) / (voltage_drop_pct / 100 * 230)
    standard_sections = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50]
    return next(s for s in standard_sections if s >= section)

def propagate_changes(G, changed_node_id):
    """Recalcule les attributs des nœuds en aval du nœud modifié."""
    # Parcours BFS depuis le nœud modifié
    # Recalcule les ratings/sections pour chaque nœud traversé
```

### 3. Backend — API Schematic

**`backend/app/api/schematics.py`** :

**POST `/projects/{id}/schematic/generate`**
- Charge le panel_layout et les specs
- Appelle `generate_schematic()` + `validate_electrical()`
- Convertit en React Flow avec `graph_to_reactflow()`
- Sauvegarde en BDD (table `schematics`)
- Retourne `{ nodes, edges, validation_errors }`

**GET `/projects/{id}/schematic`**
- Charge le schéma existant depuis la BDD
- Retourne `{ nodes, edges, validation_errors }`

**PUT `/projects/{id}/schematic`**
- Body : `{ nodes, edges }` (format React Flow)
- Convertit en networkx avec `reactflow_to_graph()`
- Re-valide avec `validate_electrical()`
- Met à jour en BDD
- Retourne `{ validation_errors }`

**POST `/projects/{id}/schematic/validate`**
- Body : `{ nodes, edges }`
- Valide sans sauvegarder
- Retourne `{ validation_errors }`

**POST `/projects/{id}/schematic/export-svg`**
- Génère un SVG du schéma (simplifié) pour inclusion dans le PDF
- Sauvegarde le SVG dans `schematics.svg_snapshot`

### 4. Frontend — Nœuds custom React Flow

**`frontend/src/components/schematic/nodes/`** :

Créer un composant React Flow custom pour chaque type de symbole électrique :

**`PanelNode.tsx`** — Panneau PV
- Icône : rectangle avec cellules (SVG)
- Label : "PV" + numéro
- Handles : 1 sortie (droite)

**`StringNode.tsx`** — String (groupe de panneaux en série)
- Icône : rectangle avec "nS" (n = nb panneaux)
- Label : "String 1", "String 2"
- Handles : 1 entrée (gauche), 1 sortie (droite)

**`InverterNode.tsx`** — Onduleur
- Icône : symbole onduleur normalisé (rectangle avec ~ et =)
- Label : modèle + puissance nominale
- Handles : n entrées MPPT (gauche), 1 sortie AC (droite), 1 terre (bas)
- Couleur de fond différente

**`BreakerNode.tsx`** — Disjoncteur DC ou AC
- Icône : symbole disjoncteur normalisé
- Label : calibre (ex: "25A")
- Afficher "DC" ou "AC" selon le contexte
- Handles : 1 entrée, 1 sortie

**`SurgeNode.tsx`** — Parafoudre
- Icône : symbole parafoudre normalisé
- Label : "Type 2"
- Handles : 1 entrée, 1 sortie, 1 terre (bas)

**`JunctionBoxNode.tsx`** — Coffret DC / AC
- Icône : rectangle pointillé
- Label : "Coffret DC" ou "Coffret AC"
- Handles : n entrées, 1 sortie

**`MeterNode.tsx`** — Compteur bidirectionnel
- Icône : cercle avec flèches bidirectionnelles
- Label : "Compteur"
- Handles : 1 entrée, 1 sortie

**`GridNode.tsx`** — Réseau SENELEC
- Icône : symbole réseau (lignes parallèles)
- Label : "SENELEC"
- Handles : 1 entrée

**`GroundNode.tsx`** — Mise à la terre
- Icône : symbole terre normalisé (3 lignes horizontales)
- Handles : 1 entrée (haut)

### 5. Frontend — Arête custom

**`frontend/src/components/schematic/edges/CableEdge.tsx`** :
- Arête avec label indiquant la section du câble (ex: "4mm²")
- Couleur : rouge pour DC, bleu pour AC, vert pour terre
- Style : ligne pleine pour DC, tirets pour AC

### 6. Frontend — Éditeur principal

**`frontend/src/components/schematic/SchematicEditor.tsx`** :
- React Flow canvas avec les nœuds custom
- Toolbar en haut :
  - "Générer automatiquement" → POST generate
  - "Valider" → POST validate
  - "Exporter SVG" → POST export-svg
- Panel de validation à droite :
  - Liste des erreurs/warnings avec icônes (rouge = critique, jaune = warning)
  - Clic sur une erreur → highlight le nœud concerné
- Fond : grille pointillée
- MiniMap (React Flow) en bas à droite

**`frontend/src/components/schematic/SymbolPalette.tsx`** :
- Palette de symboles à gauche (draggable)
- L'utilisateur peut drag & drop un nouveau composant sur le canvas
- Composants disponibles : tous les types de nœuds ci-dessus

### 7. Frontend — Page schéma

**`frontend/src/app/[locale]/projects/[id]/schematic/page.tsx`** :
- Charge le schéma existant ou propose de le générer
- Bouton "Générer automatiquement" si pas de schéma
- Éditeur pleine page avec toolbar et panels

### 8. Frontend — Store

**`frontend/src/store/schematic.ts`** :
```typescript
interface SchematicStore {
  nodes: Node[];
  edges: Edge[];
  validationErrors: ValidationError[];
  loading: boolean;
  generateSchematic: (projectId: string) => Promise<void>;
  loadSchematic: (projectId: string) => Promise<void>;
  saveSchematic: (projectId: string) => Promise<void>;
  validateSchematic: (projectId: string) => Promise<void>;
  updateNodes: (nodes: Node[]) => void;
  updateEdges: (edges: Edge[]) => void;
}
```

## Critères d'acceptance

- [ ] L'auto-génération crée un schéma complet à partir de la config PV
- [ ] Le schéma affiche tous les composants (panneaux → strings → DC → onduleur → AC → réseau)
- [ ] Chaque symbole électrique est reconnaissable (icônes normalisées)
- [ ] La validation détecte les erreurs de tension (string Voc > Vmax onduleur)
- [ ] La validation détecte les erreurs de courant (Isc > Imax MPPT)
- [ ] La validation détecte les nœuds non connectés
- [ ] Les erreurs s'affichent dans le panel de validation
- [ ] Drag & drop : l'utilisateur peut déplacer les nœuds
- [ ] Drag & drop : l'utilisateur peut ajouter de nouveaux composants depuis la palette
- [ ] L'utilisateur peut connecter/déconnecter des nœuds
- [ ] Le calibre des disjoncteurs est auto-calculé
- [ ] Les câbles affichent la section (mm²) et le type (DC/AC)
- [ ] Export SVG fonctionne
- [ ] Sauvegarde en BDD fonctionne
- [ ] Labels traduits FR/EN

## Tests

- `test_schematic_graph.py` :
  - Génération avec 10 panneaux, 2 strings, 1 onduleur → graphe correct
  - Validation : tension OK → pas d'erreur critique
  - Validation : tension trop haute → erreur critique
  - Validation : nœud flottant → warning
  - Conversion graphe → React Flow → graphe (round-trip)
  - Auto-dimensionnement disjoncteurs (calibres normalisés)
