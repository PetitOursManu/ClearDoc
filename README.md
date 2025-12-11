# Application de Gestion des Fiches de Paie

Application React/TypeScript pour la gestion des fiches de paie avec base de données CouchDB et support de fichiers séparés.

## 🚀 Déploiement sur Vercel

### Configuration des variables d'environnement

L'application supporte deux modes de configuration :

#### **Mode 1 : Configuration de base (une seule base CouchDB)**

Variables **obligatoires** :
```bash
VITE_COUCHDB_URL=https://votre-instance.couchdb.com          # URL complète de votre instance CouchDB
VITE_COUCHDB_DATABASE=payslips                               # Nom de la base de données (string)
VITE_COUCHDB_USERNAME=votre-username                         # Nom d'utilisateur CouchDB (string)
VITE_COUCHDB_PASSWORD=votre-password                         # Mot de passe CouchDB (string)
```

Variables **optionnelles** :
```bash
VITE_COUCHDB_TIMEOUT=10000                                   # Timeout en millisecondes (number, défaut: 10000)
VITE_COUCHDB_DEBUG=false                                     # Activer les logs debug (boolean, défaut: false)
```

#### **Mode 2 : Configuration avec fichiers séparés**

Variables **obligatoires de base** (identiques au Mode 1) :
```bash
VITE_COUCHDB_URL=https://votre-instance.couchdb.com
VITE_COUCHDB_DATABASE=payslips
VITE_COUCHDB_USERNAME=votre-username
VITE_COUCHDB_PASSWORD=votre-password
```

Variable **d'activation** :
```bash
VITE_USE_SEPARATE_FILES=true                                 # Active le mode fichiers séparés (boolean)
```

**Choisissez UNE des 3 options suivantes pour chaque type de données :**

##### **Option A : URLs directes vers endpoints CouchDB**
```bash
# URLs complètes vers des endpoints CouchDB spécifiques (string)
VITE_DESCRIPTIONS_FILE_URL=https://votre-instance.couchdb.com/descriptions/_all_docs?include_docs=true
VITE_CATEGORIES_FILE_URL=https://votre-instance.couchdb.com/categories/_all_docs?include_docs=true
```

##### **Option B : Bases de données CouchDB séparées**
```bash
# Noms des bases de données séparées (string)
VITE_DESCRIPTIONS_DATABASE=descriptions
VITE_CATEGORIES_DATABASE=categories
```

##### **Option C : Fichiers JSON statiques**
```bash
# URLs vers des fichiers JSON hébergés sur CDN/serveur statique (string)
VITE_DESCRIPTIONS_JSON_URL=https://votre-cdn.com/data/descriptions.json
VITE_CATEGORIES_JSON_URL=https://votre-cdn.com/data/categories.json
```

### Configuration via Dashboard Vercel

1. **Allez dans votre projet Vercel**
2. **Onglet "Settings" → "Environment Variables"**
3. **Ajoutez les variables selon votre mode choisi :**

**Pour le Mode 1 (base simple) :**
| Variable | Type | Exemple | Description |
|----------|------|---------|-------------|
| `VITE_COUCHDB_URL` | string | `https://admin:pass@instance.couchdb.com` | URL complète avec auth |
| `VITE_COUCHDB_DATABASE` | string | `payslips` | Nom de la base |
| `VITE_COUCHDB_USERNAME` | string | `admin` | Utilisateur CouchDB |
| `VITE_COUCHDB_PASSWORD` | string | `motdepasse123` | Mot de passe |
| `VITE_COUCHDB_TIMEOUT` | number | `15000` | Timeout (optionnel) |
| `VITE_COUCHDB_DEBUG` | boolean | `true` | Debug mode (optionnel) |

**Pour le Mode 2 (fichiers séparés) :**
Ajoutez toutes les variables du Mode 1, plus :

| Variable | Type | Exemple | Description |
|----------|------|---------|-------------|
| `VITE_USE_SEPARATE_FILES` | boolean | `true` | Active le mode séparé |

**Puis choisissez UNE option :**

**Option A - URLs directes :**
| Variable | Type | Exemple |
|----------|------|---------|
| `VITE_DESCRIPTIONS_FILE_URL` | string | `https://instance.com/descriptions/_all_docs?include_docs=true` |
| `VITE_CATEGORIES_FILE_URL` | string | `https://instance.com/categories/_all_docs?include_docs=true` |

**Option B - Bases séparées :**
| Variable | Type | Exemple |
|----------|------|---------|
| `VITE_DESCRIPTIONS_DATABASE` | string | `descriptions` |
| `VITE_CATEGORIES_DATABASE` | string | `categories` |

**Option C - JSON statiques :**
| Variable | Type | Exemple |
|----------|------|---------|
| `VITE_DESCRIPTIONS_JSON_URL` | string | `https://cdn.example.com/descriptions.json` |
| `VITE_CATEGORIES_JSON_URL` | string | `https://cdn.example.com/categories.json` |

### Configuration via CLI Vercel

```bash
# Installation de la CLI
npm i -g vercel

# Configuration Mode 1 (base simple)
vercel env add VITE_COUCHDB_URL
vercel env add VITE_COUCHDB_DATABASE
vercel env add VITE_COUCHDB_USERNAME
vercel env add VITE_COUCHDB_PASSWORD

# Configuration Mode 2 (fichiers séparés)
# Ajoutez d'abord toutes les variables du Mode 1, puis :
vercel env add VITE_USE_SEPARATE_FILES

# Option A - URLs directes
vercel env add VITE_DESCRIPTIONS_FILE_URL
vercel env add VITE_CATEGORIES_FILE_URL

# OU Option B - Bases séparées
vercel env add VITE_DESCRIPTIONS_DATABASE
vercel env add VITE_CATEGORIES_DATABASE

# OU Option C - JSON statiques
vercel env add VITE_DESCRIPTIONS_JSON_URL
vercel env add VITE_CATEGORIES_JSON_URL

# Déploiement
vercel --prod
```

## 🛠️ Développement local

1. **Installation :**
   ```bash
   npm install
   ```

2. **Configuration :**
   ```bash
   # Copiez le fichier d'exemple
   cp .env.example .env.local
   
   # Éditez .env.local avec vos valeurs
   nano .env.local
   ```

3. **Démarrage :**
   ```bash
   npm run dev
   ```

## 📊 Structure des données selon le mode

### Mode 1 : Base unique

Toutes les données sont dans une seule base CouchDB `payslips` :

```json
{
  "_id": "payslip_001",
  "type": "payslip",
  "employee": "John Doe",
  "items": [...]
}
```

### Mode 2 : Fichiers séparés

#### Option A : URLs directes CouchDB
- Endpoints CouchDB spécifiques
- Authentification automatique
- Format : `https://instance.com/db/_all_docs?include_docs=true`

#### Option B : Bases CouchDB séparées

**Base `descriptions` :**
```json
{
  "_id": "desc_001",
  "type": "description",
  "id": "salaire_base",
  "title": "Salaire de base",
  "description": "Rémunération fixe mensuelle"
}
```

**Base `categories` :**
```json
{
  "_id": "cat_001",
  "type": "category",
  "id": "salaire",
  "title": "Salaire",
  "color": "#4CAF50"
}
```

#### Option C : Fichiers JSON statiques

**descriptions.json :**
```json
[
  {
    "id": "salaire_base",
    "title": "Salaire de base",
    "description": "Rémunération fixe mensuelle"
  },
  {
    "id": "heures_sup",
    "title": "Heures supplémentaires",
    "description": "Heures travaillées au-delà de la durée légale"
  }
]
```

**categories.json :**
```json
[
  {
    "id": "salaire",
    "title": "Salaire"
  },
  {
    "id": "cotisations",
    "title": "Cotisations"
  }
]
```

## 🔄 Priorité de chargement des données

L'application utilise cette priorité pour charger descriptions et catégories :

1. **URL directe** (`VITE_*_FILE_URL`) - Priorité maximale
2. **Base de données séparée** (`VITE_*_DATABASE`) - Si `VITE_USE_SEPARATE_FILES=true`
3. **Fichier JSON statique** (`VITE_*_JSON_URL`) - Fallback externe
4. **Vue dans base principale** - Fallback CouchDB
5. **Données par défaut** - Fallback ultime

## 🔒 Sécurité

### Variables sensibles
- `VITE_COUCHDB_USERNAME` et `VITE_COUCHDB_PASSWORD` : **Ne jamais commiter**
- Utilisez les variables d'environnement Vercel pour la production
- Le fichier `.env.local` est ignoré par Git

### Authentification
- **CouchDB** : Basic Auth automatique pour URLs CouchDB
- **JSON statiques** : Aucune authentification (public)
- **CORS** : Configurez votre CouchDB pour autoriser votre domaine

## 📱 Fonctionnalités

- ✅ **Gestion CRUD** des fiches de paie
- ✅ **Sources multiples** : CouchDB, JSON statiques, URLs directes
- ✅ **Cache local** pour mode hors ligne
- ✅ **Fallback automatique** en cas d'erreur
- ✅ **Recherche et filtrage** avancés
- ✅ **Interface responsive** mobile/desktop
- ✅ **Mode sombre/clair**
- ✅ **Support multilingue** (FR/EN)

## 🔧 Technologies

- **Frontend :** React 18, TypeScript, Vite
- **UI :** Tailwind CSS, shadcn/ui
- **Base de données :** CouchDB (flexible)
- **Déploiement :** Vercel
- **État :** React Context + Hooks personnalisés

## 🚨 Dépannage

### Erreurs courantes

**"Connexion au serveur impossible"**
- Vérifiez `VITE_COUCHDB_URL`
- Testez l'URL dans votre navigateur
- Vérifiez les identifiants

**"Format de données non reconnu"**
- Vérifiez la structure de vos fichiers JSON
- Consultez les logs avec `VITE_COUCHDB_DEBUG=true`

**"CORS Error"**
- Configurez CORS sur votre serveur CouchDB
- Ajoutez votre domaine Vercel aux origines autorisées

### Logs de debug

Activez les logs détaillés :
```bash
VITE_COUCHDB_DEBUG=true
```

Les logs montrent :
- URLs utilisées pour chaque source
- Réponses des serveurs
- Fallbacks activés
- Erreurs détaillées

## 📞 Support

Pour des questions spécifiques :
1. Vérifiez les logs avec `VITE_COUCHDB_DEBUG=true`
2. Testez vos URLs manuellement
3. Vérifiez la structure de vos données JSON
