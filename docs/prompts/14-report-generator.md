# Prompt 14 — Générateur de Rapport PDF

## Contexte

Rapport PDF complet regroupant toutes les données du projet : résumé exécutif, configuration système, production mensuelle, analyse financière, schéma unifilaire et devis. Trois exports possibles : rapport complet, devis seul, schéma seul.

## Dépendances

- Prompt 09 (simulation — résultats production)
- Prompt 11 (financial — analyse financière)
- Prompt 12 (schematic — schéma unifilaire SVG)
- Prompt 13 (quote — devis)

## Tâches

### 1. Backend — Service PDF

**`backend/app/services/pdf.py`** :

Utiliser WeasyPrint avec des templates Jinja2 HTML/CSS :

```python
from weasyprint import HTML
from jinja2 import Environment, FileSystemLoader

def generate_full_report(project, simulation, financial, schematic, quote, installer_profile=None):
    """Génère le rapport complet en PDF A4."""
    env = Environment(loader=FileSystemLoader('app/templates'))
    template = env.get_template('report.html')
    
    html_content = template.render(
        project=project,
        simulation=simulation,
        financial=financial,
        schematic_svg=schematic.svg_snapshot if schematic else None,
        quote=quote,
        installer=installer_profile,
        charts=generate_chart_images(simulation, financial),
        generated_at=datetime.now(),
    )
    
    pdf_bytes = HTML(string=html_content).write_pdf()
    
    # Sauvegarder
    filename = f"rapport_{project.name}_{datetime.now():%Y%m%d_%H%M}.pdf"
    filepath = f"/data/uploads/reports/{project.id}/{filename}"
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'wb') as f:
        f.write(pdf_bytes)
    
    return filepath

def generate_chart_images(simulation, financial):
    """Génère les graphiques en images pour le PDF."""
    # Utiliser matplotlib pour générer les graphiques en SVG/PNG
    # - Barres production mensuelle
    # - Courbe cashflow cumulé 25 ans
    # - Camembert autoconsommation
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    
    charts = {}
    
    # Production mensuelle
    fig, ax = plt.subplots(figsize=(8, 3))
    months = [m['month'] for m in simulation['monthly_production']]
    kwh = [m['kwh'] for m in simulation['monthly_production']]
    ax.bar(months, kwh, color='#f59e0b')
    ax.set_xlabel('Mois')
    ax.set_ylabel('kWh')
    ax.set_title('Production mensuelle')
    buf = io.BytesIO()
    fig.savefig(buf, format='svg', bbox_inches='tight')
    charts['production_monthly'] = buf.getvalue().decode()
    plt.close()
    
    # Cashflow cumulé
    fig, ax = plt.subplots(figsize=(8, 3))
    years = [c['year'] for c in financial['cashflow_25y']]
    cumulative = [c['cumulative_fcfa'] for c in financial['cashflow_25y']]
    ax.plot(years, cumulative, color='#10b981', linewidth=2)
    ax.axhline(y=0, color='gray', linestyle='--')
    ax.fill_between(years, cumulative, alpha=0.1, color='#10b981')
    ax.set_xlabel('Année')
    ax.set_ylabel('FCFA')
    ax.set_title('Flux de trésorerie cumulé')
    buf = io.BytesIO()
    fig.savefig(buf, format='svg', bbox_inches='tight')
    charts['cashflow'] = buf.getvalue().decode()
    plt.close()
    
    return charts
```

### 2. Backend — Template rapport complet

**`backend/app/templates/report.html`** :

Structure du PDF A4 (orientation portrait) :

**Page 1 — Couverture**
- "SenPV" en haut (texte, pas de logo)
- Logo installateur (si professionnel)
- Nom du projet (grande police)
- Adresse / coordonnées
- Date de génération
- Nom du client (si associé)

**Page 2 — Résumé exécutif**
- Tableau récapitulatif :
  - Puissance crête : X kWc
  - Nombre de panneaux : N × modèle
  - Onduleur : modèle
  - Production annuelle : X kWh
  - Productivité : X kWh/kWc
  - Économie annuelle : X FCFA
  - Retour sur investissement : X ans
  - VAN : X FCFA
  - TRI : X %

**Page 3 — Configuration technique**
- Tableau panneaux : modèle, Pmax, Voc, Vmp, Isc, dimensions, quantité
- Tableau onduleur : modèle, puissance, MPPT, rendement
- Paramètres d'installation : inclinaison, orientation, type de toit

**Page 4 — Production solaire**
- Graphique barres production mensuelle (SVG intégré)
- Tableau mensuel : mois, irradiation, production kWh
- Production annuelle totale

**Page 5 — Analyse économique**
- Comparaison facture SENELEC : sans PV vs avec PV
- Graphique cashflow 25 ans (SVG intégré)
- Tableau : payback, VAN, TRI, ROI, LCOE
- Hypothèses : dégradation, inflation, taux d'actualisation

**Page 6 — Schéma unifilaire** (si disponible)
- SVG du schéma unifilaire exporté depuis React Flow
- Pleine page, orientation paysage si nécessaire

**Page 7+ — Devis** (si disponible, installateur)
- Reprise du template devis (prompt 13)
- Intégré dans le rapport

**Dernière page — Mentions**
- "Rapport généré par SenPV"
- Date et heure
- Mention : "Les résultats de simulation sont indicatifs"
- Contact installateur (si professionnel)

### 3. Backend — API Reports

**`backend/app/api/reports.py`** :

**POST `/projects/{id}/report`**
- Génère le rapport complet
- Crée une tâche Celery pour la génération (peut prendre quelques secondes)
- Retourne `{ task_id, status: "processing" }`

**POST `/projects/{id}/report/quote`**
- Génère uniquement le devis en PDF
- Retourne le PDF directement (plus rapide)

**POST `/projects/{id}/report/schematic`**
- Génère uniquement le schéma unifilaire en PDF
- Retourne le PDF

**GET `/reports/{id}/download`**
- Télécharge le PDF généré
- Content-Type: application/pdf
- Content-Disposition: attachment

**GET `/projects/{id}/reports`**
- Liste des rapports générés (historique)

### 4. Backend — Celery task

**`backend/app/tasks/report_task.py`** :
```python
@celery.task(bind=True)
def generate_report_task(self, project_id: str, report_type: str):
    """Génère un rapport PDF en background."""
    # Charger toutes les données du projet
    # Appeler le service PDF
    # Sauvegarder en BDD (table reports)
    # Retourner le report_id
```

### 5. Frontend — Page rapport

**`frontend/src/app/[locale]/projects/[id]/report/page.tsx`** :
- Section "Générer un rapport" :
  - Bouton "Rapport complet" → lance la génération, affiche un spinner
  - Bouton "Devis seul (PDF)" → téléchargement direct
  - Bouton "Schéma unifilaire (PDF)" → téléchargement direct
  - Chaque bouton est désactivé si la donnée n'existe pas (ex: pas de simulation → pas de rapport)
- Section "Rapports générés" :
  - Liste avec : type, date, taille du fichier
  - Bouton télécharger pour chaque
  - Bouton supprimer

### 6. CSS pour WeasyPrint

**`backend/app/templates/report.css`** :
- Police : sans-serif (system font)
- Marges page : 2cm
- Headers/footers avec numéro de page (@page)
- Tableaux avec bordures, alternance de couleurs
- Graphiques SVG inline
- Page break avant chaque section principale
- Palette de couleurs : bleu SenPV (#1e3a5f), solaire (#f59e0b), vert (#10b981)

## Critères d'acceptance

- [ ] Le rapport complet est généré en PDF A4
- [ ] La couverture affiche "SenPV", le nom du projet et le logo installateur
- [ ] Le résumé exécutif contient tous les KPI
- [ ] Le graphique de production mensuelle est intégré (SVG)
- [ ] Le graphique cashflow 25 ans est intégré (SVG)
- [ ] Le schéma unifilaire est intégré en pleine page
- [ ] Le devis est intégré (si installateur)
- [ ] Le devis seul est téléchargeable séparément
- [ ] Le schéma seul est téléchargeable séparément
- [ ] Les montants sont formatés en FCFA
- [ ] La génération fonctionne en background (Celery)
- [ ] L'historique des rapports est consultable
- [ ] Labels traduits FR/EN

## Tests

- `test_report_pdf.py` : génération avec données complètes, vérification du fichier PDF
- `test_report_api.py` : endpoints, permissions, téléchargement
