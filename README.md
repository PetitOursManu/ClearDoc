# 📋 Payslip Explainer / Explicateur de Fiche de Paie

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![React](https://img.shields.io/badge/React-18.3.1-61dafb.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-3178c6.svg)
![Vite](https://img.shields.io/badge/Vite-5.4.8-646cff.svg)

Une application web moderne pour comprendre et gérer les lignes de votre fiche de paie.

*A modern web application to understand and manage your payslip line items.*

[🇫🇷 Français](#-français) | [🇬🇧 English](#-english)

</div>

---

## 🇫🇷 Français

### 📖 Description

**Payslip Explainer** est une application web interactive conçue pour aider les employés et les professionnels RH à comprendre facilement les différentes lignes d'une fiche de paie. Chaque élément est présenté avec une description détaillée, une image illustrative et une catégorisation claire.

L'application offre une interface intuitive avec des fonctionnalités de recherche, de filtrage et de gestion de contenu, le tout dans un design moderne et responsive.

### ✨ Fonctionnalités Principales

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

#### ⚙️ **Configuration Facile**
- **Toggles de fonctionnalités** : Activez/désactivez les boutons d'édition et d'ajout via des constantes
- **Documentation complète** : Guide détaillé pour toutes les configurations
- **Données hardcodées** : Contrôle total sur le contenu via le code source

### 🚀 Installation

```bash
# Cloner le repository
git clone https://github.com/votre-username/payslip-explainer.git

# Accéder au dossier
cd payslip-explainer

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

L'application sera accessible sur `http://localhost:5173`

### 🛠️ Technologies Utilisées

- **React 18.3.1** - Framework UI
- **TypeScript 5.5.3** - Typage statique
- **Vite 5.4.8** - Build tool ultra-rapide
- **Tailwind CSS 3.4.13** - Framework CSS utility-first
- **shadcn/ui** - Composants UI modernes et accessibles
- **Lucide React** - Icônes élégantes

### 📁 Structure du Projet

```
payslip-explainer/
├── src/
│   ├── components/          # Composants React
│   │   ├── PayslipCard.tsx       # Carte d'affichage
│   │   ├── AddPayslipDialog.tsx  # Dialog d'ajout
│   │   └── EditDialog.tsx        # Dialog d'édition
│   ├── data/
│   │   └── payslipData.ts   # Données des fiches de paie
│   ├── types/
│   │   └── payslip.ts       # Types TypeScript
│   └── App.tsx              # Composant principal
├── DOCUMENTATION.md         # Guide de configuration
└── README.md               # Ce fichier
```

### ⚙️ Configuration

Consultez le fichier `DOCUMENTATION.md` pour :
- Activer/désactiver le bouton d'édition
- Activer/désactiver le bouton d'ajout
- Modifier la limite de caractères pour "Voir plus"
- Ajouter de nouvelles descriptions manuellement

### 📸 Captures d'écran

*(Ajoutez vos captures d'écran ici)*

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

**Payslip Explainer** is an interactive web application designed to help employees and HR professionals easily understand the different line items on a payslip. Each element is presented with a detailed description, an illustrative image, and clear categorization.

The application offers an intuitive interface with search, filtering, and content management features, all in a modern and responsive design.

### ✨ Key Features

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

#### ⚙️ **Easy Configuration**
- **Feature toggles**: Enable/disable edit and add buttons via constants
- **Complete documentation**: Detailed guide for all configurations
- **Hardcoded data**: Full control over content via source code

### 🚀 Installation

```bash
# Clone the repository
git clone https://github.com/your-username/payslip-explainer.git

# Navigate to folder
cd payslip-explainer

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### 🛠️ Technologies Used

- **React 18.3.1** - UI Framework
- **TypeScript 5.5.3** - Static typing
- **Vite 5.4.8** - Ultra-fast build tool
- **Tailwind CSS 3.4.13** - Utility-first CSS framework
- **shadcn/ui** - Modern and accessible UI components
- **Lucide React** - Elegant icons

### 📁 Project Structure

```
payslip-explainer/
├── src/
│   ├── components/          # React components
│   │   ├── PayslipCard.tsx       # Display card
│   │   ├── AddPayslipDialog.tsx  # Add dialog
│   │   └── EditDialog.tsx        # Edit dialog
│   ├── data/
│   │   └── payslipData.ts   # Payslip data
│   ├── types/
│   │   └── payslip.ts       # TypeScript types
│   └── App.tsx              # Main component
├── DOCUMENTATION.md         # Configuration guide
└── README.md               # This file
```

### ⚙️ Configuration

See the `DOCUMENTATION.md` file for:
- Enable/disable edit button
- Enable/disable add button
- Modify character limit for "See more"
- Add new descriptions manually

### 📸 Screenshots

*(Add your screenshots here)*

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
