# Prompt 02 — Authentification & Autorisation

## Contexte

Implémenter l'authentification (email + Google) et l'autorisation par rôles (particular, installer, admin) pour SenPV.
Frontend : NextAuth.js v5. Backend : JWT validation.

## Dépendances

- Prompt 00 (project setup)
- Prompt 01 (database schema — table `users`, `installer_profiles`)

## Tâches

### 1. Backend — Auth API

**`backend/app/api/auth.py`** :

**POST `/auth/register`**
- Body : `{ email, name, password, role? }`
- Hash le password avec passlib bcrypt
- Role par défaut : `particular`
- Si role `installer`, créer aussi un `InstallerProfile` vide
- Retourne le user créé (sans password_hash) + JWT token

**POST `/auth/login`**
- Body : `{ email, password }`
- Vérifie password avec passlib
- Retourne JWT token + user info

**GET `/auth/me`**
- Header : `Authorization: Bearer <token>`
- Retourne le profil utilisateur courant
- Si installateur, inclure `installer_profile`

**PUT `/auth/profile`**
- Met à jour name, locale
- Si installateur : met à jour company_name, address, phone, siret, payment_terms

**POST `/auth/profile/logo`**
- Upload du logo installateur (multipart/form-data)
- Sauvegarder dans `/data/uploads/logos/{user_id}.{ext}`
- Mettre à jour `installer_profiles.logo_path`
- Accepter : PNG, JPG, SVG. Max 2MB.

**`backend/app/dependencies.py`** :
- `get_current_user(token)` — décode JWT, charge user depuis BDD
- `require_role(roles: list)` — dependency qui vérifie le rôle
- `require_installer` — shortcut pour require_role(['installer', 'admin'])
- `require_admin` — shortcut pour require_role(['admin'])

### 2. Backend — JWT

- Créer les tokens avec python-jose
- Payload : `{ sub: user_id, role: user_role, exp: ... }`
- Expiration : 24h (configurable dans Settings)
- Secret key depuis `Settings.secret_key`

### 3. Frontend — NextAuth.js

**`frontend/src/lib/auth.ts`** — Configuration NextAuth v5 :
- Provider `Credentials` : appelle `/auth/login` sur le backend
- Provider `Google` (optionnel, préparer la config) : crée le user côté backend si premier login
- Session strategy : `jwt`
- Callbacks : inclure `role` et `id` dans le token et la session

**`frontend/src/app/api/auth/[...nextauth]/route.ts`** — Route handler NextAuth

**`frontend/src/app/[locale]/auth/login/page.tsx`** :
- Formulaire email + password
- Bouton "Connexion avec Google" (grisé si pas configuré)
- Lien vers inscription
- Messages d'erreur i18n
- Redirection vers `/dashboard` après login

**`frontend/src/app/[locale]/auth/register/page.tsx`** :
- Formulaire : nom, email, password, confirmation password
- Sélection rôle : Particulier / Installateur (radio buttons)
- Si installateur : champs supplémentaires (nom entreprise, téléphone)
- Validation côté client
- Redirection vers `/dashboard` après inscription

### 4. Frontend — Protection des routes

**`frontend/src/middleware.ts`** :
- Protéger toutes les routes sauf `/`, `/auth/*`
- Rediriger vers `/auth/login` si pas de session
- Vérifier le rôle pour les routes protégées :
  - `/clients/*` → installer ou admin seulement
  - `/admin/*` → admin seulement

### 5. Frontend — Composants auth

**`frontend/src/components/layout/UserMenu.tsx`** :
- Avatar/initiales + nom
- Dropdown : Profil, Paramètres, Déconnexion
- Afficher le rôle (badge)

### 6. Backend — Seed admin

Créer `backend/app/seed.py` :
- Script pour créer un admin par défaut si aucun admin n'existe
- Email/password depuis variables d'environnement (`ADMIN_EMAIL`, `ADMIN_PASSWORD`)

## Critères d'acceptance

- [ ] Inscription avec email + password fonctionne
- [ ] Login retourne un JWT valide
- [ ] `/auth/me` retourne le profil avec le bon rôle
- [ ] Un particulier ne peut pas accéder à `/clients`
- [ ] Un non-admin ne peut pas accéder à `/admin`
- [ ] Upload logo installateur fonctionne (PNG, JPG)
- [ ] Middleware Next.js redirige vers login si pas authentifié
- [ ] Déconnexion vide la session
- [ ] Messages d'erreur en FR et EN
- [ ] Seed admin fonctionne

## Tests

- `test_auth.py` : register, login, me, profile update, logo upload
- `test_permissions.py` : accès par rôle (particular, installer, admin)
