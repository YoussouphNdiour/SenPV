# SenPV — Guide de Dépannage

> Solutions aux problèmes courants rencontrés pendant le développement et en production.

---

## Développement

### PostgreSQL / PostGIS

**Erreur : `relation "spatial_ref_sys" does not exist`**
- PostGIS n'est pas activé sur la base
- Solution : `CREATE EXTENSION postgis;` ou utiliser l'image `postgis/postgis`

**Erreur : `could not connect to server`**
- PostgreSQL n'est pas démarré ou mauvais port
- Vérifier : `docker compose ps` et `docker compose logs postgres`

**Erreur Alembic : `Target database is not up to date`**
- Des migrations non appliquées existent
- Solution : `alembic upgrade head`

### WeasyPrint

**Erreur : `OSError: no library called "pango" was found`**
- Dépendances système manquantes
- macOS : `brew install pango cairo gdk-pixbuf libffi`
- Ubuntu : `apt install libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0`

### pvlib

**Erreur : `pvlib.iotools.get_pvgis_tmy() timeout`**
- API PVGIS inaccessible (pas d'internet ou API down)
- Le fallback estimation simplifiée devrait prendre le relais
- Vérifier les logs pour confirmer le fallback

### Node.js / Next.js

**Erreur : `Module not found: Can't resolve 'maplibre-gl'`**
- Dépendance pas installée : `npm install maplibre-gl`

**Erreur : `window is not defined` (SSR)**
- MapLibre/Three.js utilisé côté serveur
- Solution : `dynamic(() => import(...), { ssr: false })`

### React Flow

**Erreur : `useReactFlow must be used within a ReactFlowProvider`**
- Composant utilisant React Flow hooks hors du provider
- Solution : wrapper le composant parent avec `<ReactFlowProvider>`

---

## Production / Docker

### Traefik

**Erreur : `404 page not found` sur le domaine**
- Labels Docker mal configurés
- Vérifier : `docker compose logs traefik`
- Vérifier que le DNS pointe vers le VPS

**Erreur : `certificate not found`**
- Let's Encrypt n'a pas pu émettre le certificat
- Vérifier que les ports 80/443 sont ouverts
- Vérifier le DNS (A record → IP du VPS)
- Vérifier l'email ACME dans `.env`

### Docker Compose

**Erreur : `port is already allocated`**
- Un autre service utilise le port
- Solution : `docker ps` pour trouver le conflit, ou changer le port

**Erreur : `no space left on device`**
- Disque plein
- Nettoyer : `docker system prune -a` (attention : supprime les images non utilisées)

### Base de données

**Restaurer un backup** :
```bash
gunzip < backup.sql.gz | docker compose exec -T postgres psql -U senpv senpv
```

---

## Template pour nouveaux problèmes

### Problème : [description courte]

**Symptôme** : 
**Contexte** :
**Cause** :
**Solution** :
```bash
# commande de résolution
```
