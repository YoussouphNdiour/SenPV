# 01 — Project Overview

> Vue d'ensemble complète du projet SenPV.

---

## Qu'est-ce que SenPV ?

SenPV est une plateforme SaaS de dimensionnement d'installations solaires photovoltaiques pour le Senegal. Elle remplace le projet SolarIntel (v1) qui etait un monolithe `index.html` + ArcGIS + CrewAI/Ollama.

### Deux modes d'utilisation

1. **SaaS ouvert (particulier)** — tout particulier s'inscrit, dessine son toit sur une carte, simule une installation PV, et obtient un rapport complet (production, economies SENELEC, retour sur investissement).

2. **Outil professionnel (installateur)** — les installateurs solaires gerent un pipeline commercial (prospects -> devis -> installation), avec fiches clients, devis personnalises (logo, marges, conditions), catalogue d'equipements techniques et schema unifilaire editable.

### Ce que SenPV ne fait PAS

- Pas de systeme multi-agents IA (CrewAI/Ollama supprime — ADR-006)
- Pas de ciblage international — Senegal uniquement (tarifs SENELEC, FCFA, TMY Dakar)
- Pas de logo graphique — le texte "SenPV" suffit

---

## Origine du projet

SenPV est une refonte complete de **SolarIntel** (v1), qui etait :
- Un monolithe `index.html` (2100+ lignes de Vanilla JS)
- ArcGIS JS SDK 4.30 (licence payante, ~2MB)
- Un 3D viewer separe en iframe (React Three Fiber dans `solarintel-3d/`)
- CrewAI + Ollama pour la generation de briefs techniques (trop lourd, supprime)
- Pas de base de donnees, pas d'authentification, pas de multi-utilisateurs

### Objectifs de la refonte

| Objectif | SolarIntel v1 | SenPV v2 |
|----------|---------------|----------|
| Framework | Vanilla JS CDN | Next.js 15 + FastAPI |
| Carte | ArcGIS (payant) | MapLibre GL JS (gratuit) |
| 3D | iframe separee | React Three Fiber integre |
| Auth | Aucune | NextAuth + JWT + 3 roles |
| BDD | Aucune | PostgreSQL + PostGIS |
| Multi-users | Non | Oui (particular/installer/admin) |
| Devis | Non | Oui (logo, marges, TVA, PDF) |
| Schema unifilaire | Non | React Flow + networkx |
| i18n | Non | FR/EN (next-intl) |
| Deploy | Manuel | Docker + Traefik + Portainer |

---

## Cible geographique

- **Pays** : Senegal uniquement
- **Monnaie** : FCFA (Franc CFA)
- **Fournisseur electrique** : SENELEC (4 tranches tarifaires : DPP, DMP, DGP, PP)
- **Donnees meteo** : TMY via PVGIS (coordonnees Dakar par defaut : 14.7167, -17.4677)
- **Projection** : UTM zone 28N (EPSG:32628) pour le calpinage
- **Langue par defaut** : Francais, anglais en option

---

## Roles utilisateurs

| Role | Acces | Description |
|------|-------|-------------|
| `particular` | Projets perso, simulations, rapports | Particulier qui dimensionne son installation |
| `installer` | Multi-projets, fiches clients, devis, catalogue equipements, schema unifilaire | Professionnel installateur solaire |
| `admin` | Tout + gestion utilisateurs, metriques plateforme, catalogue global | Administrateur de la plateforme |

---

## Parcours utilisateur

### Particulier
1. Inscription (email/Google) -> dashboard vide
2. Nouveau projet -> saisie adresse ou clic sur carte
3. Dessin du toit -> polygone sur MapLibre
4. Calpinage auto -> grille de panneaux generee
5. Ajustement manuel -> ajouter/supprimer/deplacer panneaux
6. Vue 3D -> visualisation du toit avec panneaux
7. Simulation -> production kWh, economies SENELEC, ROI
8. Rapport PDF -> telechargeable
9. Historique -> retrouver ses projets passes

### Installateur
- Meme parcours +
- Multi-projets par client
- Fiches clients (nom, adresse, telephone, conso SENELEC)
- Catalogue equipements perso (panneaux + onduleurs avec specs completes)
- Devis avec logo, lignes, marges, TVA, conditions de paiement
- Schema unifilaire auto-genere + editable
- Pipeline commercial (prospect -> etude -> devis -> signe -> installe)

### Admin
- Tous les utilisateurs, tous les projets
- Catalogue global d'equipements
- Metriques plateforme (nb utilisateurs, nb projets, kWc total)

---

## Etat d'avancement

Au 2026-09-01 : **13/17 prompts completes** (~170+ tests passants, 0 bugs ouverts).

| Phase | Prompts | Statut |
|-------|---------|--------|
| Fondations (00-03) | Setup, DB, Auth, i18n | Termines |
| Donnees & CRUD (04-05) | Equipment, Projects | Termines |
| Cartographie (06-08) | Map, Panels, 3D | Termines |
| Simulation (09-11) | pvlib, SENELEC, Financial | Termines |
| Documents (12-13) | Schematic, Quote | Termines |
| Restants (14-16) | Report, Dashboard, Deploy | A faire |

---

## Documents de reference

| Fichier | Contenu |
|---------|---------|
| `docs/architecture.md` | Spec complete (~800 lignes) |
| `CLAUDE.md` | Instructions pour Claude Code |
| `docs/PROGRESS.md` | Suivi d'avancement |
| `docs/DECISIONS.md` | ADR (Architecture Decision Records) |
| `docs/BUGS.md` | Suivi des bugs |
| `docs/MODEL_STRATEGY.md` | Strategie Opus/Sonnet/Haiku |
| `docs/prompts/00-16` | 17 prompts sequentiels |
