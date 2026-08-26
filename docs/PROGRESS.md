# SenPV — Suivi d'Avancement

> Suivi prompt par prompt. Cocher chaque prompt une fois complété et testé.

## Avancement global

| # | Prompt | Statut | Date début | Date fin | Notes |
|---|--------|--------|------------|----------|-------|
| 00 | Project Setup | ✅ | 2026-08-26 | 2026-08-26 | Tous critères validés |
| 01 | Database Schema | ✅ | 2026-08-26 | 2026-08-26 | 12 tables, 11 schémas Pydantic, seed data |
| 02 | Auth | ✅ | 2026-08-26 | 2026-08-26 | Backend JWT + NextAuth v5 + proxy.ts + i18n setup |
| 03 | i18n | ✅ | 2026-08-26 | 2026-08-26 | 16 namespaces FR/EN, LocaleSwitcher |
| 04 | Equipment Catalog | ✅ | 2026-08-26 | 2026-08-26 | CRUD + validation specs + 48 tests passants |
| 05 | Project Management | ✅ | 2026-08-26 | 2026-08-26 | CRUD projets + clients, 75 tests passants |
| 06 | Map & Roof Drawing | ✅ | 2026-08-26 | 2026-08-26 | MapLibre + dessin polygones + CRUD zones PostGIS |
| 07 | Panel Placement | ✅ | 2026-08-26 | 2026-08-26 | Calpinage UTM28N + undo + 18 tests algo |
| 08 | 3D Viewer | ✅ | 2026-08-26 | 2026-08-26 | R3F + instancedMesh + 4 types toit + controls |
| 09 | PV Simulation | ✅ | 2026-08-26 | 2026-08-26 | pvlib service + Redis cache + API + Celery + Recharts chart |
| 10 | SENELEC Billing | ⬜ | | | |
| 11 | Financial Analysis | ⬜ | | | |
| 12 | Schematic Editor | ⬜ | | | |
| 13 | Quote Builder | ⬜ | | | |
| 14 | Report Generator | ⬜ | | | |
| 15 | Dashboard | ⬜ | | | |
| 16 | Deploy | ⬜ | | | |

**Légende** : ⬜ À faire | 🔄 En cours | ✅ Terminé | ⚠️ Bloqué

## Notes par prompt

### Prompt 00 — Project Setup
- Blocages : 
- Décisions prises : 
- Bugs rencontrés : 

### Prompt 02 — Auth
- Blocages : Aucun
- Décisions prises : Next.js 16 utilise proxy.ts au lieu de middleware.ts. Setup next-intl minimal pour les messages auth (FR/EN). shadcn base-ui n'a pas asChild sur DropdownMenuTrigger.
- Bugs rencontrés : Aucun

### Prompt 05 — Project Management
- Blocages : SQLite tests ne supportent pas PostGIS (roof_zones) — contourné avec SQL-level delete et skip selectinload
- Décisions prises : Route group (app) pour les pages authentifiées. StatusBadge composant partagé. SQL delete au lieu de ORM cascade pour compatibilité SQLite test.
- Bugs rencontrés : Aucun

### Prompt 06 — Map & Roof Drawing
- Blocages : Aucun
- Décisions prises : Dynamic import pour maplibre-gl (ESM-only). Dessin custom avec events MapLibre (pas de @mapbox/mapbox-gl-draw). CustomEvents pour communiquer token aux handlers map. Tests roof_zones nécessitent PostgreSQL+PostGIS (skip SQLite).
- Bugs rencontrés : Aucun

### Prompt 08 — 3D Viewer
- Blocages : Aucun
- Décisions prises : Dynamic import avec ssr:false pour Canvas R3F. Zustand store dédié pour les contrôles 3D. instancedMesh pour performance >50 panneaux. wgs84ToLocal3D dans geo.ts pour conversion coordonnées. Pop-in animation avec easeOutBack. preserveDrawingBuffer pour capture screenshot.
- Bugs rencontrés : Aucun

### Prompt 09 — PV Simulation
- Blocages : Aucun
- Décisions prises : gamma_pdc doit être divisé par 100 (pvlib attend fraction, pas %). Mock TMY amélioré avec pvlib solar position pour que l'optimiseur converge vers azimuth=180° (sud). Redis graceful fallback quand indisponible. Fallback estimation basée sur 1650 kWh/kWc pour Dakar.
- Bugs rencontrés : Aucun

<!-- Copier ce template pour chaque prompt au fur et à mesure -->

---

## Métriques

| Métrique | Valeur |
|----------|--------|
| Prompts terminés | 10/17 |
| Tests passants | 100 |
| Bugs ouverts | 0 |
| Décisions techniques | 6 |
