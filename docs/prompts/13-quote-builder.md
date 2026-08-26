# Prompt 13 — Générateur de Devis

## Contexte

Les installateurs peuvent créer des devis professionnels avec leur logo, les lignes d'équipement, les marges, la TVA et les conditions de paiement. Le devis est téléchargeable en PDF séparément ou intégré dans le rapport complet.

## Dépendances

- Prompt 04 (equipment — catalogue pour pré-remplir les lignes)
- Prompt 05 (project management — client associé au projet)
- Prompt 12 (schematic — schéma unifilaire intégré au devis optionnel)

## Tâches

### 1. Backend — API Quotes

**`backend/app/api/quotes.py`** :

**POST `/projects/{id}/quotes`**
- Rôle requis : installer
- Body :
```json
{
  "line_items": [
    {"description": "Panneau JA Solar JAM72S30-545W", "quantity": 10, "unit_price_fcfa": 185000},
    {"description": "Onduleur Huawei SUN2000-5KTL", "quantity": 1, "unit_price_fcfa": 650000},
    {"description": "Structure de montage toiture", "quantity": 1, "unit_price_fcfa": 350000},
    {"description": "Câblage DC/AC + protections", "quantity": 1, "unit_price_fcfa": 250000},
    {"description": "Main d'œuvre installation", "quantity": 1, "unit_price_fcfa": 400000}
  ],
  "margin_pct": 15.0,
  "tax_rate_pct": 18.0,
  "payment_terms": "50% à la commande, 50% à la mise en service",
  "validity_days": 30
}
```
- Calcul automatique : subtotal, margin, tax_amount, total
- Générer la référence : `DEV-{YYYY}-{NNNN}` (auto-incrémenté par installateur)
- Sauvegarder en BDD

**GET `/projects/{id}/quotes`**
- Liste des devis du projet (tri par date desc)

**GET `/projects/{id}/quotes/{qid}`**
- Détail d'un devis

**PUT `/projects/{id}/quotes/{qid}`**
- Modifier les lignes, la marge, la TVA, les conditions
- Recalculer les totaux

**PUT `/projects/{id}/quotes/{qid}/status`**
- Body : `{ status: "sent" | "accepted" | "rejected" }`
- Changer le statut du devis

### 2. Backend — Génération PDF devis

**`backend/app/services/pdf.py`** — ajouter la méthode `generate_quote_pdf()` :

**Template HTML `backend/app/templates/quote.html`** :
```
┌─────────────────────────────────────────┐
│  [Logo installateur]    DEVIS           │
│  Nom entreprise         Réf: DEV-2026-42│
│  Adresse                Date: 26/08/2026│
│  Téléphone              Validité: 30j   │
│─────────────────────────────────────────│
│  Client :                               │
│  Nom, Adresse, Téléphone                │
│  Projet : Nom du projet                 │
│  Adresse installation : ...             │
│─────────────────────────────────────────│
│  # │ Description          │ Qté │ PU    │ Total  │
│  1 │ Panneau JA Solar...  │ 10  │185000 │1850000 │
│  2 │ Onduleur Huawei...   │  1  │650000 │ 650000 │
│  3 │ Structure montage    │  1  │350000 │ 350000 │
│  4 │ Câblage + protect.   │  1  │250000 │ 250000 │
│  5 │ Main d'œuvre          │  1  │400000 │ 400000 │
│─────────────────────────────────────────│
│                    Sous-total HT : 3 500 000 FCFA │
│                    Marge (15%)   :   525 000 FCFA │
│                    Total HT      : 4 025 000 FCFA │
│                    TVA (18%)     :   724 500 FCFA │
│                    ──────────────────────────────  │
│                    TOTAL TTC     : 4 749 500 FCFA │
│─────────────────────────────────────────│
│  Conditions de paiement :               │
│  50% à la commande, 50% à la mise en   │
│  service.                               │
│─────────────────────────────────────────│
│  Mention légale : Devis valable 30 jours│
│  Signature client :          Date :     │
└─────────────────────────────────────────┘
```

- Rendu avec WeasyPrint (HTML/CSS → PDF)
- Logo installateur chargé depuis `installer_profiles.logo_path`
- Si pas de logo, afficher le nom de l'entreprise en gras
- Format A4, marges 2cm
- Montants formatés avec séparateurs de milliers

### 3. Frontend — Éditeur de devis

**`frontend/src/app/[locale]/projects/[id]/quote/page.tsx`** :
- Accessible uniquement par les installateurs
- Header : infos installateur (auto-rempli depuis le profil) + infos client (auto-rempli)

**`frontend/src/components/quote/QuoteEditor.tsx`** :
- Table éditable des lignes :
  - Description (texte libre ou sélection depuis le catalogue)
  - Quantité (number input)
  - Prix unitaire FCFA (number input)
  - Total = Qté × PU (calculé auto)
  - Bouton supprimer ligne
- Bouton "Ajouter une ligne"
- Bouton "Ajouter depuis le catalogue" → ouvre un dialog avec le catalogue équipements
  - Sélectionner un panneau/onduleur → pré-remplit description + prix suggéré
- Champs sous le tableau :
  - Marge (% input, défaut 15%)
  - TVA (% input, défaut 18%)
  - Conditions de paiement (textarea)
  - Validité (jours, défaut 30)
- Calculs en temps réel : sous-total, marge, total HT, TVA, total TTC

**`frontend/src/components/quote/LineItemTable.tsx`** :
- Composant table avec drag & drop pour réordonner les lignes
- Résumé des totaux en bas

**`frontend/src/components/quote/QuotePreview.tsx`** :
- Aperçu du devis tel qu'il apparaîtra en PDF
- Mise en page fidèle au template PDF
- Boutons : "Télécharger PDF", "Envoyer" (change statut)

### 4. Frontend — Gestion des statuts

- Badge coloré sur le devis :
  - `draft` → gris
  - `sent` → bleu
  - `accepted` → vert
  - `rejected` → rouge
- Boutons d'action selon le statut :
  - Draft → "Envoyer" (→ sent)
  - Sent → "Marqué accepté" / "Marqué refusé"

### 5. Frontend — Liste des devis

Si un projet a plusieurs devis :
- Liste avec : référence, date, total TTC, statut
- Clic → ouvre l'éditeur avec les données du devis

## Critères d'acceptance

- [ ] Un installateur peut créer un devis avec des lignes personnalisées
- [ ] Le bouton "Ajouter depuis le catalogue" pré-remplit les infos
- [ ] Les calculs (sous-total, marge, TVA, TTC) sont corrects en temps réel
- [ ] La référence du devis est auto-générée (DEV-YYYY-NNNN)
- [ ] Le PDF du devis est généré correctement (WeasyPrint)
- [ ] Le logo installateur apparaît dans le PDF (si uploadé)
- [ ] Les infos client et projet sont pré-remplies
- [ ] Les montants sont formatés en FCFA avec séparateurs de milliers
- [ ] Les statuts fonctionnent (draft → sent → accepted/rejected)
- [ ] Un particulier ne peut pas accéder à la page devis
- [ ] L'aperçu du devis est fidèle au PDF
- [ ] Labels traduits FR/EN

## Tests

- `test_quotes.py` : CRUD, calculs (marge, TVA, TTC), permissions
- `test_quote_pdf.py` : génération PDF, logo, format A4
