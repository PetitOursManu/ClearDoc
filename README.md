# Application de Gestion des Fiches de Paie

Application React/TypeScript pour la gestion des fiches de paie avec base de données CouchDB et support de fichiers séparés.

## 🚀 Déploiement sur Vercel

### Configuration des variables d'environnement

1. **Via le Dashboard Vercel :**
   - Allez dans votre projet Vercel
   - Onglet "Settings" → "Environment Variables"
   - Ajoutez les variables suivantes :

   **Configuration de base :**
   ```
   VITE_COUCHDB_URL=https://votre-instance.couchdb.com
   VITE_COUCHDB_DATABASE=payslips
   VITE_COUCHDB_USERNAME=votre-username
   VITE_COUCHDB_PASSWORD=votre-password
   VITE_COUCHDB_TIMEOUT=10000
   VITE_COUCHDB_DEBUG=false
   ```

   **Configuration pour fichiers séparés :**
   ```
   VITE_USE_SEPARATE_FILES=true
   
   # Option 1: URLs directes vers des endpoints CouchDB
   VITE_DESCRIPTIONS_FILE_URL=https://votre-instance.couchdb.com/descriptions/_all_docs?include_docs=true
   VITE_CATEGORIES_FILE_URL=https://votre-instance.couchdb.com/categories/_all_docs?include_docs=true
   
   # Option 2: Bases de données séparées
   VITE_DESCRIPTIONS_DATABASE=descriptions
   VITE_CATEGORIES_DATABASE=categories
   
   # Option 3: Fichiers JSON statiques
   VITE_DESCRIPTIONS_JSON_URL=https://votre-cdn.com/data/descriptions.json
   VITE_CATEGORIES_JSON_URL=https://votre-cdn.com/data/categories.json
   ```

2. **Via la CLI Vercel :**
   ```bash
   # Configuration de base
   vercel env add VITE_COUCHDB_URL
   vercel env add VITE_COUCHDB_DATABASE
   vercel env add VITE_COUCHDB_USERNAME
   vercel env add VITE_COUCHDB_PASSWORD
   
   # Configuration fichiers séparés
   vercel env add VITE_USE_SEPARATE_FILES
   vercel env add VITE_DESCRIPTIONS_FILE_URL
   vercel env add VITE_CATEGORIES_FILE_URL
   ```

### Déploiement

```bash
# Installer la CLI Vercel
npm i -g vercel

# Déployer
vercel --prod
```

## 🛠️ Développement local

1. **Installation :**
   ```bash
   npm install
   ```

2. **Configuration :**
   - Copiez `.env.example` vers `.env.local`
   - Configurez vos variables CouchDB et fichiers séparés

3. **Démarrage :**
   ```bash
   npm run dev
   ```

## 📊 Configuration des sources de données

### Option 1: Bases de données CouchDB séparées

Créez des bases de données séparées pour les descriptions et catégories :
- `descriptions` : contient les documents de descriptions
- `categories` : contient les documents de catégories

### Option 2: Fichiers JSON statiques

Hébergez des fichiers JSON sur un CDN ou serveur statique :

**descriptions.json :**
```json
[
  {
    "id": "salaire_base",
    "title": "Salaire de base",
    "description": "Rémunération fixe mensuelle"
  }
]
```

**categories.json :**
```json
[
  {
    "id": "salaire",
    "title": "Salaire"
  }
]
```

### Option 3: URLs directes CouchDB

Utilisez des URLs directes vers des endpoints CouchDB spécifiques.

## 🔧 Structure de données

### Documents de descriptions :
```json
{
  "_id": "desc_001",
  "type": "description",
  "id": "salaire_base",
  "title": "Salaire de base",
  "description": "Rémunération fixe mensuelle",
  "category": "salaire"
}
```

### Documents de catégories :
```json
{
  "_id": "cat_001",
  "type": "category",
  "id": "salaire",
  "title": "Salaire",
  "color": "#4CAF50"
}
```

## 🔒 Sécurité

- Les identifiants CouchDB sont stockés dans les variables d'environnement
- Authentification Basic Auth avec CouchDB
- Support des fichiers JSON statiques sans authentification
- Les variables sensibles ne sont jamais commitées dans Git

## 📱 Fonctionnalités

- ✅ Gestion CRUD des fiches de paie
- ✅ Support de sources de données multiples
- ✅ Descriptions et catégories depuis fichiers séparés
- ✅ Cache local pour mode hors ligne
- ✅ Recherche et filtrage
- ✅ Support multilingue (FR/EN)
- ✅ Mode sombre/clair
- ✅ Interface responsive
- ✅ Synchronisation avec CouchDB

## 🔧 Technologies

- **Frontend :** React 18, TypeScript, Vite
- **UI :** Tailwind CSS, shadcn/ui
- **Base de données :** CouchDB (multiple sources)
- **Déploiement :** Vercel
- **État :** React Context API

## 📋 Priorité des sources de données

L'application utilise la priorité suivante pour charger les données :

1. **URL directe** (`VITE_*_FILE_URL`)
2. **Base de données séparée** (`VITE_*_DATABASE`)
3. **Fichier JSON statique** (`VITE_*_JSON_URL`)
4. **Vue dans base principale** (fallback)
5. **Données par défaut** (en cas d'erreur)
