# 📚 Documentation ClearDoc

## 🎯 Configuration du Mode Debug

### Activation/Désactivation des messages console

Par défaut, l'application **n'affiche aucun message dans la console du navigateur** pour une expérience utilisateur propre.

Pour activer le mode debug et voir les messages de diagnostic :

1. **Ouvrez le fichier** : `src/config/debugConfig.ts`

2. **Modifiez la valeur de `DEBUG_MODE`** :

```typescript
// Pour ACTIVER les messages console (mode développement)
export const DEBUG_MODE = true;

// Pour DÉSACTIVER les messages console (mode production)
export const DEBUG_MODE = false;
```

### Messages affichés en mode debug

Quand `DEBUG_MODE = true`, vous verrez dans la console :

- 🔄 Tentatives de récupération des données
- ✅ Succès du chargement des données
- ❌ Erreurs de connexion
- ⚠️ Utilisation du cache ou des données de fallback
- 📝 Détails des nouveaux éléments ajoutés
- 🔍 Informations de débogage diverses

### Fonctions de debug disponibles

Le fichier `debugConfig.ts` fournit plusieurs fonctions wrapper :

- `debugLog()` - Remplace `console.log()`
- `debugError()` - Remplace `console.error()`
- `debugWarn()` - Remplace `console.warn()`
- `debugInfo()` - Remplace `console.info()`
- `debugTable()` - Remplace `console.table()`
- `debugGroup()` - Remplace `console.group()`
- `debugGroupEnd()` - Remplace `console.groupEnd()`

## ⚙️ Configuration des Fonctionnalités

### Afficher/Masquer le bouton d'édition

Dans le fichier `src/components/PayslipCard.tsx`, modifiez :

```typescript
// Pour AFFICHER le bouton d'édition
export const SHOW_EDIT_BUTTON = true;

// Pour MASQUER le bouton d'édition
export const SHOW_EDIT_BUTTON = false;
```

### Afficher/Masquer le bouton d'ajout

Dans le fichier `src/components/AddPayslipDialog.tsx`, modifiez :

```typescript
// Pour AFFICHER le bouton d'ajout
export const SHOW_ADD_BUTTON = true;

// Pour MASQUER le bouton d'ajout
export const SHOW_ADD_BUTTON = false;
```

### Modifier la limite de caractères pour "Voir plus"

Dans le fichier `src/components/PayslipCard.tsx`, modifiez :

```typescript
// Nombre de caractères avant d'afficher "Voir plus"
const DESCRIPTION_CHAR_LIMIT = 150; // Changez cette valeur selon vos besoins
```

## 🔧 Configuration du Serveur de Données

### Fichier de configuration

Modifiez le fichier `src/config/apiConfig.ts` :

```typescript
export const API_CONFIG = {
  // URL de votre serveur JSON
  url: 'https://votre-serveur.com/api/data',
  
  // Identifiants Basic Auth
  auth: {
    username: 'votre_username',
    password: 'votre_password'
  },
  
  // Timeout en millisecondes
  timeout: 10000
};
```

### Exemples de configuration

#### CouchDB
```typescript
url: 'https://couchdb.example.com:5984/database/_all_docs?include_docs=true'
```

#### PouchDB
```typescript
url: 'http://localhost:5984/database/_all_docs?include_docs=true'
```

#### API REST
```typescript
url: 'https://api.example.com/v1/payslips'
```

#### Fichier JSON statique
```typescript
url: 'https://cdn.example.com/data/payslips.json'
```

## 📝 Ajouter des Descriptions Manuellement

### Option 1 : Via l'interface utilisateur

1. Cliquez sur le bouton "Ajouter une description"
2. Remplissez le formulaire
3. Le code généré s'affiche automatiquement
4. Copiez le code JavaScript ou JSON selon vos besoins

### Option 2 : Directement dans le code (données de fallback)

Modifiez le fichier `src/data/fallbackData.ts` :

```typescript
export const fallbackPayslipItems: PayslipItem[] = [
  {
    id: 'custom_1',
    title: 'Nouveau titre',
    description: 'Description détaillée...',
    imageUrl: 'https://example.com/image.jpg',
    category: 'salaire',
    keywords: ['mot1', 'mot2']
  },
  // Ajoutez d'autres éléments ici
];
```

## 🌍 Personnaliser les Traductions

### Modifier les textes de l'interface

Dans le fichier `src/contexts/LanguageContext.tsx`, modifiez l'objet `translations` :

```typescript
const translations = {
  fr: {
    // Modifiez les textes français ici
    'search.placeholder': 'Votre nouveau texte...',
  },
  en: {
    // Modifiez les textes anglais ici
    'search.placeholder': 'Your new text...',
  }
};
```

### Ajouter une nouvelle langue

1. Ajoutez la langue dans le type :
```typescript
type Language = 'fr' | 'en' | 'es'; // Ajout de l'espagnol
```

2. Ajoutez les traductions :
```typescript
const translations = {
  // ...
  es: {
    'app.title': 'ClearDoc',
    'search.placeholder': 'Buscar...',
    // Ajoutez toutes les traductions
  }
};
```

## 🔍 Résolution des Problèmes

### Les données ne se chargent pas

1. **Activez le mode debug** : `DEBUG_MODE = true` dans `debugConfig.ts`
2. **Vérifiez la console** pour les messages d'erreur
3. **Vérifiez** :
   - L'URL est correcte et accessible
   - Les identifiants sont valides
   - Le serveur autorise les requêtes CORS
   - Le format JSON est correct

### Messages console indésirables

- Assurez-vous que `DEBUG_MODE = false` dans `src/config/debugConfig.ts`
- Vérifiez qu'aucune extension de navigateur n'ajoute des logs

### L'interface ne se met pas à jour

- Vérifiez que les données sont au bon format
- Utilisez le bouton de rafraîchissement manuel
- Videz le cache du navigateur si nécessaire

## 📊 Structure des Données

### Format PayslipItem

```typescript
interface PayslipItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: 'salaire' | 'cotisations' | 'net' | 'employeur' | 'autres';
  keywords: string[];
}
```

### Catégories disponibles

- `salaire` : Éléments de salaire
- `cotisations` : Cotisations sociales
- `net` : Net à payer
- `employeur` : Charges patronales
- `autres` : Autres éléments

## 🚀 Commandes Utiles

```bash
# Développement
npm run dev

# Build de production
npm run build

# Preview du build
npm run preview

# Vérification TypeScript
npm run type-check

# Linting
npm run lint
```

## 📦 Dépendances Principales

- **React** : Framework UI
- **TypeScript** : Typage statique
- **Vite** : Build tool
- **Tailwind CSS** : Styling
- **shadcn/ui** : Composants UI
- **Lucide React** : Icônes

## 🔐 Sécurité

### Bonnes pratiques

1. **Ne jamais commiter** les identifiants réels dans le code
2. **Utiliser HTTPS** pour toutes les connexions distantes
3. **Configurer CORS** correctement sur le serveur
4. **Utiliser des variables d'environnement** en production
5. **Désactiver le mode debug** en production (`DEBUG_MODE = false`)

### Variables d'environnement (production)

Créez un fichier `.env` :

```env
VITE_API_URL=https://api.example.com
VITE_API_USERNAME=username
VITE_API_PASSWORD=password
```

Puis modifiez `apiConfig.ts` :

```typescript
export const API_CONFIG = {
  url: import.meta.env.VITE_API_URL || 'fallback-url',
  auth: {
    username: import.meta.env.VITE_API_USERNAME || '',
    password: import.meta.env.VITE_API_PASSWORD || ''
  }
};
```

## 📞 Support

Pour toute question ou problème :
- Ouvrez une issue sur GitHub
- Consultez la documentation complète
- Activez le mode debug pour diagnostiquer les problèmes

---

© 2025 ClearDoc. Tous droits réservés.
