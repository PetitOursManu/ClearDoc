# 📋 ClearDoc

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![React](https://img.shields.io/badge/React-18.3.1-61dafb.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-3178c6.svg)
![Vite](https://img.shields.io/badge/Vite-5.4.8-646cff.svg)

Une application web moderne pour comprendre et gérer les lignes de votre fiche de paie avec chargement de données depuis un serveur distant.

*A modern web application to understand and manage your payslip line items with remote data loading.*

[🇫🇷 Français](#-français) | [🇬🇧 English](#-english)

</div>

---

## 🇫🇷 Français

### 📖 Description

**ClearDoc** est une application web interactive conçue pour aider les employés et les professionnels RH à comprendre facilement les différentes lignes d'une fiche de paie. Les données sont chargées dynamiquement depuis un serveur JSON distant (comme CouchDB, PouchDB, ou tout autre API REST). Chaque élément est présenté avec une description détaillée, une image illustrative et une catégorisation claire.

L'application offre une interface intuitive avec des fonctionnalités de recherche, de filtrage et de gestion de contenu, le tout dans un design moderne et responsive.

### 📸 Aperçu de l'Application

![ClearDoc Interface en Français](https://i.postimg.cc/xT5M56Dn/Clear-Doc-French.png)

*Interface principale de ClearDoc en français avec recherche, filtres par catégorie et cartes détaillées*

### ✨ Fonctionnalités Principales

#### 🌐 **Chargement de Données Distant**
- **Récupération JSON depuis serveur** : Charge les données depuis n'importe quel serveur REST (CouchDB, PouchDB, API personnalisée)
- **Authentification Basic Auth** : Support de l'authentification HTTP Basic
- **Cache local** : Sauvegarde automatique des données pour utilisation hors ligne
- **Données de secours** : Fallback automatique en cas d'échec de connexion
- **Rafraîchissement automatique** : Mise à jour de l'interface dès réception des données

#### 🔍 **Recherche et Filtrage**
- **Recherche en temps réel** : Trouvez instantanément les lignes de paie par mots-clés
- **Filtrage par catégorie** : 
  - 💰 Salaire
  - 🏥 Cotisations sociales
  - ✅ Net à payer
  - 🏢 Charges patronales
  - 📌 Autres éléments

#### 📝 **Gestion de Contenu**
- **Ajout de nouvelles descriptions** : Interface intuitive pour créer de nouveaux éléments
- **Édition en ligne** : Modifiez les descriptions et catégories directement
- **Sortie console** : Copiez facilement le code généré pour l'intégrer manuellement

#### 📖 **Affichage Intelligent**
- **Descriptions extensibles** : Bouton "Voir plus/Voir moins" pour les textes longs
- **Limite configurable** : Personnalisez la longueur d'affichage (150 caractères par défaut)
- **Images illustratives** : Visuels de haute qualité pour chaque ligne de paie

#### 🎨 **Interface Moderne**
- **Design responsive** : Optimisé pour mobile, tablette et desktop
- **Cartes interactives** : Effets de survol et animations fluides
- **Thème cohérent** : Interface élégante avec shadcn/ui
- **Interface bilingue** : Basculez facilement entre français et anglais

### 🚀 Installation

```bash
# Cloner le repository
git clone https://github.com/votre-username/cleardoc.git

# Accéder au dossier
cd cleardoc

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

L'application sera accessible sur `http://localhost:5173`

### 🔧 Configuration du Serveur de Données

ClearDoc charge ses données depuis un serveur JSON distant. Pour configurer votre propre serveur de données :

#### 1. **Localisation du fichier de configuration**

Le fichier de configuration se trouve dans : `src/config/apiConfig.ts`

#### 2. **Paramètres de configuration**

Ouvrez le fichier `apiConfig.ts` et modifiez les paramètres suivants :

```typescript
export const API_CONFIG = {
  // URL de votre serveur JSON (CouchDB, PouchDB, API REST, etc.)
  url: 'https://votre-serveur.com/api/payslip-data',
  
  // Identifiants pour l'authentification Basic Auth
  auth: {
    username: 'votre_nom_utilisateur',
    password: 'votre_mot_de_passe'
  },
  
  // Timeout en millisecondes (optionnel)
  timeout: 10000,
  
  // Activer/désactiver les logs de debug
  debug: true
};
```

#### 3. **Exemples de configuration pour différents serveurs**

##### CouchDB
```typescript
url: 'https://mon-couchdb.com:5984/payslips/_all_docs?include_docs=true'
```

##### PouchDB Server
```typescript
url: 'http://localhost:5984/payslips/_all_docs?include_docs=true'
```

##### API REST personnalisée
```typescript
url: 'https://api.monentreprise.com/v1/payslip-descriptions'
```

##### Fichier JSON statique
```typescript
url: 'https://mon-site.com/data/payslips.json'
```

#### 4. **Format des données JSON attendu**

Votre serveur doit retourner un tableau JSON avec la structure suivante :

```json
[
  {
    "id": "1",
    "title": "Salaire de base",
    "description": "Le salaire de base est la rémunération fixe convenue...",
    "imageUrl": "https://example.com/image.jpg",
    "category": "salary",
    "keywords": ["salaire", "base", "fixe"]
  },
  {
    "id": "2",
    "title": "Prime d'ancienneté",
    "description": "Prime accordée en fonction de l'ancienneté...",
    "imageUrl": "https://example.com/image2.jpg",
    "category": "salary",
    "keywords": ["prime", "ancienneté"]
  }
]
```

**Formats alternatifs supportés :**

Si votre serveur retourne un objet contenant le tableau, ClearDoc recherchera automatiquement dans les propriétés suivantes :
- `items`
- `data`
- `payslipItems`

Exemple :
```json
{
  "data": [
    { "id": "1", "title": "...", ... }
  ]
}
```

#### 5. **Authentification**

Si votre serveur nécessite une authentification Basic Auth :

1. Créez vos identifiants sur votre serveur (ex: avec htpasswd pour Apache/Nginx)
2. Renseignez le nom d'utilisateur et le mot de passe dans `apiConfig.ts`
3. L'application encodera automatiquement les identifiants en Base64

#### 6. **Gestion des erreurs et fallback**

- **Cache local** : Les données sont automatiquement sauvegardées dans le localStorage
- **Mode hors ligne** : En cas d'échec de connexion, les données en cache sont utilisées
- **Données de secours** : Si aucun cache n'est disponible, des données par défaut sont chargées depuis `src/data/fallbackData.ts`

#### 7. **Test de la configuration**

Pour vérifier que votre configuration fonctionne :

1. Ouvrez la console du navigateur (F12)
2. Rechargez l'application
3. Vous devriez voir :
   - `🔄 Récupération des données depuis: [votre URL]`
   - `✅ Données récupérées avec succès: [données]`
   - `✅ Données mises à jour automatiquement: X éléments`

En cas d'erreur, vérifiez :
- L'URL est correcte et accessible
- Les identifiants sont valides
- Le serveur autorise les requêtes CORS depuis votre domaine
- Le format JSON est correct

### 🛠️ Technologies Utilisées

- **React 18.3.1** - Framework UI
- **TypeScript 5.5.3** - Typage statique
- **Vite 5.4.8** - Build tool ultra-rapide
- **Tailwind CSS 3.4.13** - Framework CSS utility-first
- **shadcn/ui** - Composants UI modernes et accessibles
- **Lucide React** - Icônes élégantes

### 📁 Structure du Projet

```
cleardoc/
├── src/
│   ├── components/          # Composants React
│   │   ├── PayslipCard.tsx       # Carte d'affichage
│   │   ├── AddPayslipDialog.tsx  # Dialog d'ajout
│   │   ├── EditDialog.tsx        # Dialog d'édition
│   │   └── Header.tsx            # En-tête avec toggle de langue
│   ├── config/
│   │   └── apiConfig.ts     # Configuration du serveur de données
│   ├── contexts/
│   │   └── LanguageContext.tsx   # Contexte de langue
│   ├── data/
│   │   ├── payslipData.ts   # Données des fiches de paie (obsolète)
│   │   └── fallbackData.ts  # Données de secours
│   ├── hooks/
│   │   └── usePayslipData.ts     # Hook pour charger les données
│   ├── types/
│   │   └── payslip.ts       # Types TypeScript
│   └── App.tsx              # Composant principal
├── DOCUMENTATION.md         # Guide de configuration
└── README.md               # Ce fichier
```

### ⚙️ Configuration Avancée

Consultez le fichier `DOCUMENTATION.md` pour :
- Activer/désactiver le bouton d'édition
- Activer/désactiver le bouton d'ajout
- Modifier la limite de caractères pour "Voir plus"
- Ajouter de nouvelles descriptions manuellement
- Personnaliser les traductions

### 🔒 Sécurité

- **HTTPS recommandé** : Utilisez toujours HTTPS pour les connexions distantes
- **Variables d'environnement** : Pour la production, utilisez des variables d'environnement pour les identifiants sensibles
- **CORS** : Configurez correctement les en-têtes CORS sur votre serveur
- **Validation** : Les données reçues sont validées avant affichage

### 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

### 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

---

## 🇬🇧 English

### 📖 Description

**ClearDoc** is an interactive web application designed to help employees and HR professionals easily understand the different line items on a payslip. Data is dynamically loaded from a remote JSON server (such as CouchDB, PouchDB, or any REST API). Each element is presented with a detailed description, an illustrative image, and clear categorization.

The application offers an intuitive interface with search, filtering, and content management features, all in a modern and responsive design.

### 📸 Application Preview

![ClearDoc Interface in English](https://i.postimg.cc/WpFsX3Br/Clear-Doc-English.png)

*ClearDoc main interface in English with search, category filters, and detailed cards*

### ✨ Key Features

#### 🌐 **Remote Data Loading**
- **JSON fetching from server**: Load data from any REST server (CouchDB, PouchDB, custom API)
- **Basic Auth authentication**: HTTP Basic authentication support
- **Local cache**: Automatic data saving for offline use
- **Fallback data**: Automatic fallback in case of connection failure
- **Automatic refresh**: Interface updates as soon as data is received

#### 🔍 **Search and Filtering**
- **Real-time search**: Instantly find payslip lines by keywords
- **Category filtering**: 
  - 💰 Salary
  - 🏥 Social contributions
  - ✅ Net pay
  - 🏢 Employer charges
  - 📌 Other items

#### 📝 **Content Management**
- **Add new descriptions**: Intuitive interface to create new items
- **Inline editing**: Modify descriptions and categories directly
- **Console output**: Easily copy generated code for manual integration

#### 📖 **Smart Display**
- **Expandable descriptions**: "See more/See less" button for long texts
- **Configurable limit**: Customize display length (150 characters by default)
- **Illustrative images**: High-quality visuals for each payslip line

#### 🎨 **Modern Interface**
- **Responsive design**: Optimized for mobile, tablet, and desktop
- **Interactive cards**: Hover effects and smooth animations
- **Consistent theme**: Elegant interface with shadcn/ui
- **Bilingual interface**: Easily switch between French and English

### 🚀 Installation

```bash
# Clone the repository
git clone https://github.com/your-username/cleardoc.git

# Navigate to folder
cd cleardoc

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### 🔧 Data Server Configuration

ClearDoc loads its data from a remote JSON server. To configure your own data server:

#### 1. **Configuration file location**

The configuration file is located at: `src/config/apiConfig.ts`

#### 2. **Configuration parameters**

Open the `apiConfig.ts` file and modify the following parameters:

```typescript
export const API_CONFIG = {
  // URL of your JSON server (CouchDB, PouchDB, REST API, etc.)
  url: 'https://your-server.com/api/payslip-data',
  
  // Credentials for Basic Auth authentication
  auth: {
    username: 'your_username',
    password: 'your_password'
  },
  
  // Timeout in milliseconds (optional)
  timeout: 10000,
  
  // Enable/disable debug logs
  debug: true
};
```

#### 3. **Configuration examples for different servers**

##### CouchDB
```typescript
url: 'https://my-couchdb.com:5984/payslips/_all_docs?include_docs=true'
```

##### PouchDB Server
```typescript
url: 'http://localhost:5984/payslips/_all_docs?include_docs=true'
```

##### Custom REST API
```typescript
url: 'https://api.mycompany.com/v1/payslip-descriptions'
```

##### Static JSON file
```typescript
url: 'https://my-site.com/data/payslips.json'
```

#### 4. **Expected JSON data format**

Your server must return a JSON array with the following structure:

```json
[
  {
    "id": "1",
    "title": "Base salary",
    "description": "Base salary is the fixed compensation agreed upon...",
    "imageUrl": "https://example.com/image.jpg",
    "category": "salary",
    "keywords": ["salary", "base", "fixed"]
  },
  {
    "id": "2",
    "title": "Seniority bonus",
    "description": "Bonus granted based on seniority...",
    "imageUrl": "https://example.com/image2.jpg",
    "category": "salary",
    "keywords": ["bonus", "seniority"]
  }
]
```

**Supported alternative formats:**

If your server returns an object containing the array, ClearDoc will automatically search in the following properties:
- `items`
- `data`
- `payslipItems`

Example:
```json
{
  "data": [
    { "id": "1", "title": "...", ... }
  ]
}
```

#### 5. **Authentication**

If your server requires Basic Auth authentication:

1. Create your credentials on your server (e.g., with htpasswd for Apache/Nginx)
2. Enter the username and password in `apiConfig.ts`
3. The application will automatically encode the credentials in Base64

#### 6. **Error handling and fallback**

- **Local cache**: Data is automatically saved in localStorage
- **Offline mode**: In case of connection failure, cached data is used
- **Fallback data**: If no cache is available, default data is loaded from `src/data/fallbackData.ts`

#### 7. **Testing the configuration**

To verify that your configuration works:

1. Open the browser console (F12)
2. Reload the application
3. You should see:
   - `🔄 Récupération des données depuis: [your URL]`
   - `✅ Données récupérées avec succès: [data]`
   - `✅ Données mises à jour automatiquement: X éléments`

In case of error, check:
- The URL is correct and accessible
- The credentials are valid
- The server allows CORS requests from your domain
- The JSON format is correct

### 🛠️ Technologies Used

- **React 18.3.1** - UI Framework
- **TypeScript 5.5.3** - Static typing
- **Vite 5.4.8** - Ultra-fast build tool
- **Tailwind CSS 3.4.13** - Utility-first CSS framework
- **shadcn/ui** - Modern and accessible UI components
- **Lucide React** - Elegant icons

### 📁 Project Structure

```
cleardoc/
├── src/
│   ├── components/          # React components
│   │   ├── PayslipCard.tsx       # Display card
│   │   ├── AddPayslipDialog.tsx  # Add dialog
│   │   ├── EditDialog.tsx        # Edit dialog
│   │   └── Header.tsx            # Header with language toggle
│   ├── config/
│   │   └── apiConfig.ts     # Data server configuration
│   ├── contexts/
│   │   └── LanguageContext.tsx   # Language context
│   ├── data/
│   │   ├── payslipData.ts   # Payslip data (deprecated)
│   │   └── fallbackData.ts  # Fallback data
│   ├── hooks/
│   │   └── usePayslipData.ts     # Hook to load data
│   ├── types/
│   │   └── payslip.ts       # TypeScript types
│   └── App.tsx              # Main component
├── DOCUMENTATION.md         # Configuration guide
└── README.md               # This file
```

### ⚙️ Advanced Configuration

See the `DOCUMENTATION.md` file for:
- Enable/disable edit button
- Enable/disable add button
- Modify character limit for "See more"
- Add new descriptions manually
- Customize translations

### 🔒 Security

- **HTTPS recommended**: Always use HTTPS for remote connections
- **Environment variables**: For production, use environment variables for sensitive credentials
- **CORS**: Properly configure CORS headers on your server
- **Validation**: Received data is validated before display

### 🤝 Contributing

Contributions are welcome! Feel free to:
1. Fork the project
2. Create a branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

<div align="center">

**Made with ❤️ for better payslip understanding**

**Fait avec ❤️ pour une meilleure compréhension des fiches de paie**

</div>
