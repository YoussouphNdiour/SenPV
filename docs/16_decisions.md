# 16 — Decisions

> Synthese de toutes les decisions techniques (ADR) prises pendant le developpement de SenPV.
> Voir `docs/DECISIONS.md` pour le detail complet avec contexte et alternatives.

---

## Index des decisions

| # | Decision | Date | Prompt | Impact |
|---|----------|------|--------|--------|
| ADR-001 | MapLibre GL JS au lieu d'ArcGIS | 2026-08-26 | 06 | Carte gratuite, open source |
| ADR-002 | React Flow pour le schema unifilaire | 2026-08-26 | 12 | Editeur interactif drag & drop |
| ADR-003 | networkx pour la validation electrique | 2026-08-26 | 12 | Parcours de graphe en memoire |
| ADR-004 | WeasyPrint au lieu de ReportLab | 2026-08-26 | 13, 14 | Templates HTML/CSS maintenables |
| ADR-005 | PostgreSQL + PostGIS uniquement | 2026-08-26 | 01 | Une seule BDD pour tout |
| ADR-006 | Suppression de CrewAI/Ollama | 2026-08-26 | — | Pas de dependance GPU/LLM |
| ADR-007 | Next.js 16 proxy.ts | 2026-08-26 | 02 | Routing moderne (depreciation middleware.ts) |
| ADR-008 | SQLite pour les tests (sans PostGIS) | 2026-08-26 | 05 | Tests rapides en memoire |
| ADR-009 | Route group (app) | 2026-08-26 | 05 | Layout partage pages authentifiees |
| ADR-010 | Dessin custom MapLibre | 2026-08-26 | 06 | Pas de mapbox-gl-draw (incompatible ESM) |
| ADR-011 | Dynamic import maplibre-gl | 2026-08-26 | 06 | SSR-safe, ESM-only module |
| ADR-012 | gamma_pdc conversion %/C -> fraction/C | 2026-08-26 | 09 | pvlib attend fraction, datasheets donnent % |

---

## Decisions par categorie

### Frontend
| Decision | Choix | Alternative rejetee | Raison |
|----------|-------|---------------------|--------|
| Framework | Next.js 15 (App Router) | Vanilla JS (SolarIntel v1) | Structure, SSR, routing |
| Carte | MapLibre GL JS | ArcGIS JS SDK | Gratuit, open source, performant |
| 3D | React Three Fiber integre | iframe separee | UX fluide, pas de latence |
| Schema | React Flow | Canvas custom, D3.js | Composants React, drag & drop natif |
| UI | shadcn/ui + Tailwind | Material UI, Ant Design | Leger, accessible, customizable |
| State | Zustand | Redux, Context API | Simple, performant, pas de boilerplate |
| i18n | next-intl | react-i18next | Integration native Next.js |
| Dessin carte | Custom events MapLibre | mapbox-gl-draw | Incompatibilite ESM v6 |

### Backend
| Decision | Choix | Alternative rejetee | Raison |
|----------|-------|---------------------|--------|
| API | FastAPI | Django REST, Express | Async, performant, Python PV |
| Simulation | pvlib | Calculs manuels | Bibliotheque de reference PV |
| Graphe | networkx en memoire | Neo4j, validation procedurale | Leger, parcours natifs |
| PDF | WeasyPrint (HTML/CSS) | ReportLab (API bas niveau) | Templates maintenables |
| ORM | SQLAlchemy 2.0 async | Django ORM, Prisma | Async, PostGIS, mature |
| Taches | Celery + Redis | Dramatiq, RQ | Ecosysteme, monitoring |
| Cache | Redis | Memcached | Aussi broker Celery |

### Infrastructure
| Decision | Choix | Alternative rejetee | Raison |
|----------|-------|---------------------|--------|
| BDD | PostgreSQL + PostGIS | MongoDB, MySQL | Geospatial + relationnel |
| Auth | NextAuth + JWT | Passport, Auth0 | Integre Next.js, gratuit |
| Proxy | Traefik | Nginx, Caddy | Docker-native, HTTPS auto |
| Deploy | Docker Compose | Kubernetes, bare metal | Simple, suffisant pour un VPS |
| Gestion | Portainer | CLI Docker seul | UI web pour monitoring |

### Decisions de migration (SolarIntel -> SenPV)
| Decision | Impact |
|----------|--------|
| Supprimer ArcGIS | Pas de licence payante |
| Supprimer CrewAI/Ollama | Pas de GPU, rapports deterministes |
| Supprimer iframe 3D | Integration native R3F |
| Ajouter PostgreSQL | Persistance, multi-users |
| Ajouter authentification | 3 roles, securite |
| Ajouter i18n | FR + EN |

---

## Decisions implicites (non documentees en ADR)

Ces decisions ont ete prises naturellement sans necessiter de discussion formelle :

| Decision | Raison |
|----------|--------|
| UUID comme PK partout | Standard moderne, pas de collision |
| JSONB pour specs equipements | Schemas variables selon type |
| TIMESTAMPTZ partout | Timezone-aware |
| Cascade delete | Pas de donnees orphelines |
| TVA 18% par defaut | Taux legal Senegal |
| FCFA sans decimales | Pas de centimes en FCFA |
| Fallback 1650 kWh/kWc | Productivite specifique moyenne Dakar |
| 25 ans pour analyse financiere | Duree garantie panneaux |
| 0.5%/an degradation | Standard industrie |
| UTM zone 28N (EPSG:32628) | Zone UTM couvrant le Senegal |

---

## Principes directeurs

1. **Simplicite** — une seule BDD, pas de micro-services, pas d'IA
2. **Localisation** — tout est concu pour le Senegal (SENELEC, FCFA, Dakar)
3. **Open source** — MapLibre, networkx, pvlib, WeasyPrint (pas de licences)
4. **Determinisme** — memes parametres -> memes resultats (pas de LLM)
5. **Autonomie** — chaque prompt peut etre execute independamment
6. **Testabilite** — chaque module a ses tests (170+ au total)
