# 13 — Gap Fill & Verification

> Verification de completude : ce qui est fait, ce qui manque, et les ecarts entre spec et implementation.

---

## Matrice de verification par prompt

### ✓ Prompt 00 — Project Setup
| Critere | Statut | Notes |
|---------|--------|-------|
| Next.js 15 + TypeScript initialise | ✓ | App Router |
| FastAPI + Python 3.12 initialise | ✓ | pyproject.toml |
| Docker Compose dev | ✓ | PostgreSQL + Redis |
| .env.example | ✓ | |
| shadcn/ui installe | ✓ | |
| Tailwind CSS configure | ✓ | |

### ✓ Prompt 01 — Database Schema
| Critere | Statut | Notes |
|---------|--------|-------|
| 12 tables creees | ✓ | Alembic migration |
| PostGIS active | ✓ | Geometry column sur roof_zones |
| Index equipment | ✓ | type, is_global, owner_id |
| Schemas Pydantic (11) | ✓ | Create/Update/Read |
| Seed data (3 panneaux + 3 onduleurs) | ✓ | default_equipment.json |
| Tarifs SENELEC | ✓ | senelec_tariffs.json |

### ✓ Prompt 02 — Auth
| Critere | Statut | Notes |
|---------|--------|-------|
| JWT login/register | ✓ | Backend |
| NextAuth v5 | ✓ | Frontend |
| proxy.ts (Next.js 16) | ✓ | ADR-007 |
| 3 roles (particular/installer/admin) | ✓ | |
| Protection des routes | ✓ | |

### ✓ Prompt 03 — i18n
| Critere | Statut | Notes |
|---------|--------|-------|
| next-intl configure | ✓ | |
| 16 namespaces | ✓ | FR + EN |
| LocaleSwitcher | ✓ | Dans le header |

### ✓ Prompt 04 — Equipment Catalog
| Critere | Statut | Notes |
|---------|--------|-------|
| CRUD panneaux | ✓ | API + frontend |
| CRUD onduleurs | ✓ | API + frontend |
| Validation specs JSONB | ✓ | Pydantic |
| Catalogue global + perso | ✓ | is_global + owner_id |
| 48 tests passants | ✓ | |

### ✓ Prompt 05 — Project Management
| Critere | Statut | Notes |
|---------|--------|-------|
| CRUD projets | ✓ | |
| CRUD clients | ✓ | |
| 5 statuts | ✓ | draft/study/quote/signed/installed |
| StatusBadge | ✓ | Composant partage |
| Route group (app) | ✓ | ADR-009 |
| 75 tests passants | ✓ | |

### ✓ Prompt 06 — Map & Roof Drawing
| Critere | Statut | Notes |
|---------|--------|-------|
| MapLibre GL JS | ✓ | ADR-001 |
| Dessin polygone custom | ✓ | ADR-010 |
| CRUD zones PostGIS | ✓ | |
| Geocoding Nominatim | ✓ | |
| Dynamic import | ✓ | ADR-011 |

### ✓ Prompt 07 — Panel Placement
| Critere | Statut | Notes |
|---------|--------|-------|
| Calpinage UTM28N | ✓ | EPSG:32628 |
| Rotation/clipping | ✓ | |
| Undo/redo | ✓ | |
| 18 tests algo | ✓ | |

### ✓ Prompt 08 — 3D Viewer
| Critere | Statut | Notes |
|---------|--------|-------|
| React Three Fiber integre | ✓ | Pas d'iframe |
| 4 types de toit | ✓ | flat/gable/hip/shed |
| instancedMesh | ✓ | Performance |
| Pop-in animation | ✓ | easeOutBack |

### ✓ Prompt 09 — PV Simulation
| Critere | Statut | Notes |
|---------|--------|-------|
| pvlib ModelChain | ✓ | |
| TMY PVGIS | ✓ | |
| Cache Redis | ✓ | Graceful fallback |
| Celery task | ✓ | |
| Fallback estimation | ✓ | 1650 kWh/kWc |
| gamma_pdc /100 | ✓ | ADR-012 |
| Graphique Recharts | ✓ | Barres mensuelles |

### ✓ Prompt 10 — SENELEC Billing
| Critere | Statut | Notes |
|---------|--------|-------|
| 4 tranches tarifaires | ✓ | DPP/DMP/DGP/PP |
| TVA 18% + redevance | ✓ | |
| Calcul economies | ✓ | |
| 15 tests | ✓ | |

### ✓ Prompt 11 — Financial Analysis
| Critere | Statut | Notes |
|---------|--------|-------|
| NPV | ✓ | Taux actualisation |
| IRR | ✓ | Newton-Raphson |
| LCOE | ✓ | |
| Payback | ✓ | |
| Cashflow 25 ans | ✓ | Degradation + inflation |
| 13 tests | ✓ | |

### ✓ Prompt 12 — Schematic Editor
| Critere | Statut | Notes |
|---------|--------|-------|
| Auto-generation networkx | ✓ | |
| Validation electrique | ✓ | 6 types de validation |
| React Flow editor | ✓ | Noeuds custom |
| Export SVG | ✓ | Pour PDF |
| 29 tests | ✓ | |

### ✓ Prompt 13 — Quote Builder
| Critere | Statut | Notes |
|---------|--------|-------|
| CRUD devis | ✓ | Installer only |
| Reference auto DEV-YYYY-NNNN | ✓ | |
| Calculs (marge, TVA, TTC) | ✓ | Temps reel |
| PDF WeasyPrint + logo | ✓ | |
| 4 statuts | ✓ | draft/sent/accepted/rejected |

---

## Gaps identifies — Prompts restants

### Prompt 14 — Report Generator [GAP]
| Critere | Statut | Risque |
|---------|--------|--------|
| Template report.html | A faire | Moyen — WeasyPrint deja utilise pour les devis |
| Graphiques matplotlib SVG | A faire | Faible — code fourni dans le prompt |
| Celery task rapport | A faire | Faible — pattern deja en place |
| 3 modes export | A faire | Faible |

### Prompt 15 — Dashboard [GAP]
| Critere | Statut | Risque |
|---------|--------|--------|
| Dashboard par role | A faire | Faible |
| Kanban drag & drop | A faire | Moyen — DnD Kit a integrer |
| API stats agregees | A faire | Faible — SQL COUNT/SUM |
| Graphiques Recharts | A faire | Faible — deja utilise |

### Prompt 16 — Deploy [GAP]
| Critere | Statut | Risque |
|---------|--------|--------|
| Dockerfiles production | A faire | Faible — patterns standards |
| Traefik + Let's Encrypt | A faire | Moyen — depend du DNS/VPS |
| Scripts init/backup | A faire | Faible |
| Portainer | A faire | Faible — ajout service Docker |

---

## Ecarts spec vs implementation

### Ecarts acceptes (decisions documentees)

| Ecart | Raison | ADR |
|-------|--------|-----|
| proxy.ts au lieu de middleware.ts | Next.js 16 | ADR-007 |
| Dessin custom au lieu de mapbox-gl-draw | Incompatibilite ESM | ADR-010 |
| SQLite tests sans PostGIS | Rapidite CI | ADR-008 |
| Layout hierarchique manuel | Pas de pygraphviz | ADR dans prompt 12 |
| mppt_voltage_range_v string ou liste | Flexibilite parsing | Decision prompt 12 |

### Ecarts potentiels a verifier

| Element | A verifier |
|---------|-----------|
| CORS configuration | Pas de `*` en production |
| Rate limiting | Non implemente |
| Pagination API | A verifier sur les listes |
| Upload validation | Taille/type fichiers logos |
| Error messages i18n | Frontend error handling |

---

## Resume

```
Prompts completes : 13/17 (76%)
Tests passants    : 170+
Bugs ouverts      : 0
ADR documentes    : 12
Gaps critiques    : 0
Gaps restants     : 3 prompts (14, 15, 16) — tous bien specifies
```

La couverture fonctionnelle est solide. Les 3 prompts restants sont bien documentes et les patterns necessaires (WeasyPrint, Recharts, Celery, Docker) sont deja en place dans le projet.
