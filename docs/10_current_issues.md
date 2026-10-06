# 10 — Current Issues

> Problemes connus, limitations et points d'attention du projet SenPV.

---

## Bugs ouverts

**Aucun bug ouvert** au 2026-09-01. Tous les prompts completes (00-13) ont passe leurs tests sans bugs reportes.

Voir `docs/BUGS.md` pour le suivi detaille.

---

## Limitations connues

### Tests SQLite vs PostGIS (ADR-008)
- Les tests backend utilisent SQLite in-memory (rapide)
- SQLite ne supporte pas PostGIS (colonne `Geometry`)
- Les tests CRUD simples fonctionnent, mais les tests geospatiaux (calpinage, zones) necessitent PostgreSQL reel
- Workaround : SQL-level DELETE au lieu de ORM cascade, skip selectinload pour les relations geospatiales
- Impact : certains tests de regression spatiale ne peuvent pas tourner en CI sans PostgreSQL

### mapbox-gl-draw incompatible (ADR-010)
- `@mapbox/mapbox-gl-draw` n'est pas compatible avec MapLibre GL JS v6 (ESM-only)
- Solution : implementation custom du dessin de polygones
- Impact : plus de code a maintenir, mais controle total sur l'UX

### PVGIS API availability
- L'API PVGIS peut etre indisponible (timeout, maintenance)
- Fallback en place : estimation basee sur 1650 kWh/kWc pour Dakar
- Impact : les simulations fallback sont moins precises

### Redis optionnel
- Redis est utilise pour le cache et Celery
- Le backend fonctionne sans Redis (graceful fallback)
- Impact sans Redis : pas de cache simulations, pas de taches Celery (generation PDF synchrone)

### Next.js 16 proxy.ts (ADR-007)
- Next.js 16 a deprecie `middleware.ts` en faveur de `proxy.ts`
- Pattern plus recent, moins documente dans l'ecosysteme
- Impact : les tutoriels/exemples standard ne s'appliquent pas directement

---

## Prompts restants

### Prompt 14 — Report Generator [A FAIRE]
- **Risque** : WeasyPrint necessite des dependances systeme (pango, cairo)
- **Point d'attention** : graphiques matplotlib -> SVG doivent etre bien dimensionnes pour A4
- **Dependance** : toutes les donnees des prompts precedents doivent etre accessibles

### Prompt 15 — Dashboard [A FAIRE]
- **Risque** : kanban drag & drop (DnD Kit ou HTML API) peut etre complexe
- **Point d'attention** : requetes SQL agregees (COUNT, SUM) doivent etre performantes
- **Dependance** : donnees projets et simulations

### Prompt 16 — Deploy [A FAIRE]
- **Risque** : configuration Traefik/Let's Encrypt depend du DNS
- **Point d'attention** : le VPS doit avoir les ports 80/443 ouverts
- **Dependance** : tous les prompts precedents

---

## Dettes techniques

### A corriger avant la production
1. **Variables d'environnement** : `.env.example` doit etre complete avec tous les secrets
2. **CORS** : configurer les origines autorisees (pas de `*` en prod)
3. **Rate limiting** : pas en place sur l'API (risque de spam)
4. **Validation upload** : verifier taille/type des fichiers (logos, etc.)
5. **Pagination** : les listes (projets, equipements, clients) doivent etre paginies
6. **Error handling** : messages d'erreur i18n cote frontend

### Nice-to-have (post-MVP)
1. **Tests E2E** : Playwright ou Cypress pour les parcours complets
2. **Monitoring** : Sentry ou equivalent pour le tracking d'erreurs
3. **Analytics** : suivi utilisation (sans tracking invasif)
4. **PWA** : mode offline pour la consultation de rapports
5. **Export CSV** : donnees de simulation exportables
6. **Multi-language** : wolof, arabe (au-dela de FR/EN)

---

## Performance

### Points d'attention
- **Simulation pvlib** : peut prendre 5-10s pour une simulation complete
  - Mitigation : cache Redis + Celery task en background
- **Calpinage** : complexite O(n) avec le nombre de panneaux
  - Mitigation : rarement >100 panneaux par zone
- **WeasyPrint** : generation PDF peut prendre 2-5s
  - Mitigation : Celery task en background
- **MapLibre** : chargement initial des tiles peut etre lent
  - Mitigation : lazy loading, indicateur de chargement
- **React Flow** : performance correcte jusqu'a ~50 noeuds
  - Mitigation : rarement plus de 30 composants dans un schema

---

## Securite

### En place
- JWT avec expiration
- Hash bcrypt pour les mots de passe (passlib)
- HTTPS via Traefik/Let's Encrypt
- Cascade delete (pas de donnees orphelines)
- Validation Pydantic sur toutes les entrees

### A renforcer
- Rate limiting sur les endpoints auth
- CSRF protection (NextAuth le gere partiellement)
- Content Security Policy headers
- Input sanitization (XSS prevention)
- SQL injection : couvert par SQLAlchemy ORM (pas de raw SQL)
