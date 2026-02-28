# ClearDoc

Application React/TypeScript pour stocker et consulter des descriptions textuelles de fiches de paie. Chaque entrée possède un identifiant unique, un titre, une description, une catégorie, des mots-clés et une image optionnelle.

## Stack technique

- **Frontend :** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend :** Node.js, Express
- **Base de données :** SQLite (`data/cleardoc.db`)
- **Auth :** JWT (cookie httpOnly) + bcrypt
- **Environnement cible :** Debian / Yunohost

## Prérequis

- Node.js 18+
- `build-essential` et `python3` (requis par `better-sqlite3` pour la compilation native)

```bash
apt install build-essential python3
```

## Installation

```bash
npm install
```

## Configuration

Créez un fichier `.env` à la racine (jamais commité) :

```bash
JWT_SECRET=votre_secret_tres_long_et_aleatoire
PORT=3001
```

Optionnel :

```bash
VITE_API_URL=          # Laisser vide en production (même serveur)
VITE_API_TIMEOUT=10000 # Timeout des requêtes en ms
```

## Première utilisation

### 1. Créer le compte administrateur

```bash
npm run setup-admin
```

Ce script interactif demande un identifiant et un mot de passe (min. 8 caractères). Il ne doit être lancé qu'une seule fois. Pour remplacer le compte existant, relancez-le et confirmez.

### 2. Démarrer le serveur

```bash
npm run server
# ou en production :
npm start
```

Le serveur crée automatiquement au premier démarrage :
- `data/cleardoc.db` — base SQLite
- `data/uploads/` — dossier des images uploadées

### 3. Démarrer le frontend (développement)

```bash
npm run dev
```

Le frontend Vite est accessible sur `http://localhost:5173`. Les appels `/api` et `/uploads` sont proxifiés automatiquement vers Express (`http://localhost:3001`).

## Production

```bash
npm run build   # compile le frontend dans dist/
npm start       # Express sert dist/ + API sur le port 3001
```

En production, Express sert à la fois le frontend buildé et l'API depuis le même port.

## Structure des données

### Schéma SQLite

| Table | Colonnes |
|---|---|
| `documents` | `id`, `title`, `description`, `image_path`, `category`, `keywords`, `created_at`, `updated_at` |
| `categories` | `id`, `title` |
| `descriptions` | `id`, `title`, `description` |
| `admin_users` | `id`, `username`, `password_hash`, `created_at` |
| `login_logs` | `id`, `username`, `success`, `ip`, `logged_at` |
| `login_attempts` | `ip`, `count`, `blocked_until` |

### Catégories par défaut

Insérées automatiquement au premier démarrage : `salaire`, `cotisations`, `net`, `employeur`, `autres`.

### Format d'un document

```json
{
  "id": "uuid",
  "title": "Salaire de base",
  "description": "Rémunération fixe mensuelle définie par le contrat de travail.",
  "imageUrl": "/uploads/fichier.jpg",
  "category": "salaire",
  "keywords": ["salaire", "brut", "fixe"]
}
```

## API

### Authentification

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Connexion (cookie httpOnly JWT 1h) |
| `POST` | `/api/auth/logout` | Déconnexion |
| `GET` | `/api/auth/me` | Vérification du token |

### Documents (lecture publique, écriture protégée)

| Méthode | Route | Auth |
|---|---|---|
| `GET` | `/api/documents` | Non |
| `GET` | `/api/documents/:id` | Non |
| `POST` | `/api/documents` | Oui |
| `PUT` | `/api/documents/:id` | Oui |
| `DELETE` | `/api/documents/:id` | Oui |

### Upload

| Méthode | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/api/upload` | Oui | Champ `image` (multipart), 10 Mo max |

Les images sont stockées dans `data/uploads/` et servies via `/uploads/fichier.jpg`.

### Catégories et descriptions

| Méthode | Route | Auth |
|---|---|---|
| `GET` | `/api/categories` | Non |
| `PUT` | `/api/categories` | Oui |
| `GET` | `/api/descriptions` | Non |
| `POST` | `/api/descriptions` | Oui |
| `PUT` | `/api/descriptions/:id` | Oui |
| `DELETE` | `/api/descriptions/:id` | Oui |

## Sécurité

- Mots de passe hashés avec **bcrypt** (coût 12)
- Token JWT stocké en **cookie httpOnly** (inaccessible au JavaScript)
- **5 tentatives de connexion** maximum par IP, blocage 15 minutes
- Toutes les connexions (réussies ou non) sont loggées en base avec date, heure et IP
- Expiration automatique du token après **1 heure** avec redirection vers `/admin/login`
- Le cookie est `secure` en production (HTTPS uniquement)

## Interface admin

Un bouton discret (icône bouclier) dans le header redirige vers `/admin/login`.

Une fois connecté :
- Un indicateur avec le nom d'utilisateur apparaît dans le header
- Un bouton **Déconnexion** est visible
- Les cartes affichent des boutons **Modifier** et **Supprimer**
- Un bouton **Ajouter une entrée** apparaît dans la liste

## Données persistantes

Le dossier `data/` (base SQLite + images) est ajouté au `.gitignore` et ne sera jamais écrasé par un `git pull` ou une mise à jour du code.

## Scripts disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Frontend Vite en développement (port 5173) |
| `npm run build` | Compilation TypeScript + build Vite |
| `npm run server` | Serveur Express (port 3001) |
| `npm start` | Alias de `npm run server` |
| `npm run setup-admin` | Création du compte administrateur (interactif) |
