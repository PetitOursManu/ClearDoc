# 📋 ClearDoc

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![React](https://img.shields.io/badge/React-18.3.1-61dafb.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-3178c6.svg)
![Vite](https://img.shields.io/badge/Vite-5.4.8-646cff.svg)

Une application web moderne pour comprendre et gérer les lignes de votre fiche de paie avec navigation par URL.

*A modern web application to understand and manage your payslip line items with URL navigation.*

[🇫🇷 Français](#-français) | [🇬🇧 English](#-english)

</div>

---

## 🇫🇷 Français

### 📖 Description

**ClearDoc** est une application web interactive conçue pour aider les employés et les professionnels RH à comprendre facilement les différentes lignes d'une fiche de paie. Les données sont chargées dynamiquement depuis un serveur JSON distant. Chaque élément est accessible via une URL unique et est présenté avec une description détaillée, une image illustrative et une catégorisation claire.

### ✨ Fonctionnalités Principales

#### 🔗 **Navigation par URL**
- **Liens directs** : Chaque description possède une URL unique (ex: `#1` pour l'ID 1)
- **Partage facile** : Partagez directement le lien d'une description spécifique
- **Navigation intuitive** : Cliquez sur une carte pour accéder à sa vue détaillée
- **Bouton retour** : Retournez facilement à la liste principale

#### 🌐 **Chargement de Données Distant**
- **Récupération JSON** : Charge les données depuis n'importe quel serveur REST
- **Cache local** : Sauvegarde automatique pour utilisation hors ligne
- **Rafraîchissement** : Bouton pour mettre à jour les données manuellement
- **Gestion d'erreurs** : Fallback automatique en cas d'échec de connexion

#### 🔍 **Recherche et Filtrage**
- **Recherche en temps réel** : Trouvez instantanément les lignes de paie
- **Filtrage par catégorie** : 
  - 💰 Salaire
  - 🏥 Cotisations sociales
  - ✅ Net à payer
  - 🏢 Charges patronales
  - 📌 Autres éléments

#### 🎨 **Interface Moderne**
- **Design responsive** : Optimisé pour tous les appareils
- **Mode sombre** : Basculez entre thème clair et sombre
- **Bilingue** : Interface disponible en français et anglais
- **Animations fluides** : Transitions et effets de survol élégants

### 🚀 Installation

```bash
# Cloner le repository
git clone https://github.com/PetitOursManu/ClearDoc.git

# Accéder au dossier
cd ClearDoc

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

L'application sera accessible sur `http://localhost:5173`

### 🔧 Configuration

#### Configuration du serveur de données

Le fichier de configuration se trouve dans : `src/config/apiConfig.ts`

```typescript
export const API_CONFIG = {
  url: 'https://votre-serveur.com/api/payslip-data',
  auth: {
    username: 'votre_nom_utilisateur',
    password: 'votre_mot_de_passe'
  }
};
```

#### Format des données JSON

Votre serveur doit retourner un tableau JSON avec cette structure :

```json
[
  {
    "id": "1",
    "title": "Salaire de base",
    "description": "Le salaire de base est...",
    "imageUrl": "https://example.com/image.jpg",
    "category": "salaire",
    "keywords": ["salaire", "base"]
  }
]
```

### 📁 Structure du Projet

```
ClearDoc/
├── src/
│   ├── components/          # Composants React
│   │   ├── PayslipCard.tsx       # Carte d'affichage
│   │   ├── PayslipDetail.tsx     # Vue détaillée
│   │   ├── SearchBar.tsx         # Barre de recherche
│   │   └── CategoryFilter.tsx    # Filtres par catégorie
│   ├── config/
│   │   └── apiConfig.ts     # Configuration API
│   ├── contexts/
│   │   └── LanguageContext.tsx   # Gestion multilingue
│   ├── hooks/
│   │   └── usePayslipData.ts     # Hook de données
│   └── App.tsx              # Composant principal
└── README.md               # Documentation
```

### 🛠️ Technologies Utilisées

- **React 18.3.1** - Framework UI
- **TypeScript 5.5.3** - Typage statique
- **Vite 5.4.8** - Build tool ultra-rapide
- **Tailwind CSS 3.4.13** - Framework CSS
- **shadcn/ui** - Composants UI modernes
- **Lucide React** - Icônes

---

## 🇬🇧 English

### 📖 Description

**ClearDoc** is an interactive web application designed to help employees and HR professionals easily understand payslip line items. Data is dynamically loaded from a remote JSON server. Each item is accessible via a unique URL and presented with detailed descriptions, illustrative images, and clear categorization.

### ✨ Key Features

#### 🔗 **URL Navigation**
- **Direct links**: Each description has a unique URL (e.g., `#1` for ID 1)
- **Easy sharing**: Share specific description links directly
- **Intuitive navigation**: Click on a card to access its detailed view
- **Back button**: Easily return to the main list

#### 🌐 **Remote Data Loading**
- **JSON fetching**: Load data from any REST server
- **Local cache**: Automatic saving for offline use
- **Refresh**: Manual data update button
- **Error handling**: Automatic fallback on connection failure

#### 🔍 **Search and Filtering**
- **Real-time search**: Instantly find payslip lines
- **Category filtering**: 
  - 💰 Salary
  - 🏥 Social contributions
  - ✅ Net pay
  - 🏢 Employer charges
  - 📌 Other items

#### 🎨 **Modern Interface**
- **Responsive design**: Optimized for all devices
- **Dark mode**: Toggle between light and dark themes
- **Bilingual**: Interface available in French and English
- **Smooth animations**: Elegant transitions and hover effects

### 🚀 Installation

```bash
# Clone the repository
git clone https://github.com/PetitOursManu/ClearDoc.git

# Navigate to folder
cd ClearDoc

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### 🔧 Configuration

#### Data server configuration

The configuration file is located at: `src/config/apiConfig.ts`

```typescript
export const API_CONFIG = {
  url: 'https://your-server.com/api/payslip-data',
  auth: {
    username: 'your_username',
    password: 'your_password'
  }
};
```

#### JSON data format

Your server must return a JSON array with this structure:

```json
[
  {
    "id": "1",
    "title": "Base salary",
    "description": "Base salary is...",
    "imageUrl": "https://example.com/image.jpg",
    "category": "salary",
    "keywords": ["salary", "base"]
  }
]
```

### 📁 Project Structure

```
ClearDoc/
├── src/
│   ├── components/          # React components
│   │   ├── PayslipCard.tsx       # Display card
│   │   ├── PayslipDetail.tsx     # Detailed view
│   │   ├── SearchBar.tsx         # Search bar
│   │   └── CategoryFilter.tsx    # Category filters
│   ├── config/
│   │   └── apiConfig.ts     # API configuration
│   ├── contexts/
│   │   └── LanguageContext.tsx   # Multilingual management
│   ├── hooks/
│   │   └── usePayslipData.ts     # Data hook
│   └── App.tsx              # Main component
└── README.md               # Documentation
```

### 🛠️ Technologies Used

- **React 18.3.1** - UI Framework
- **TypeScript 5.5.3** - Static typing
- **Vite 5.4.8** - Ultra-fast build tool
- **Tailwind CSS 3.4.13** - CSS Framework
- **shadcn/ui** - Modern UI components
- **Lucide React** - Icons

---

### 🤝 Contributing

Contributions are welcome! Feel free to:
1. Fork the project
2. Create a branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### 📄 License

This project is licensed under the MIT License.

---

<div align="center">

**Made with ❤️ for better payslip understanding**

[⬆ Back to top](#-cleardoc)

</div>
