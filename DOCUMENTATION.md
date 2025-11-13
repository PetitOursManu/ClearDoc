# Documentation - Configuration de l'Application

<div align="center">

[🇫🇷 Français](#-français) | [🇬🇧 English](#-english)

</div>

---

## 🇫🇷 Français

### 🔧 Comment cacher/afficher le bouton d'édition

#### Fichier à modifier
📁 **`src/components/PayslipCard.tsx`**

#### Ligne à modifier
Cherchez cette section au début du composant (lignes 26-31) :

```typescript
// ============================================
// CONFIGURATION : Affichage du bouton d'édition
// ============================================
// Pour CACHER le bouton d'édition, changez cette valeur à false
// Pour AFFICHER le bouton d'édition, changez cette valeur à true
const SHOW_EDIT_BUTTON = true;
// ============================================
```

#### Instructions

##### ✅ Pour AFFICHER le bouton d'édition (par défaut)
```typescript
const SHOW_EDIT_BUTTON = true;
```

##### ❌ Pour CACHER le bouton d'édition
```typescript
const SHOW_EDIT_BUTTON = false;
```

#### Résultat
- **`true`** : Le bouton d'édition (crayon) apparaît au survol de chaque carte
- **`false`** : Le bouton d'édition est complètement masqué

---

### ➕ Comment cacher/afficher le bouton d'ajout

#### Fichier à modifier
📁 **`src/components/AddPayslipDialog.tsx`**

#### Ligne à modifier
Cherchez cette section au début du composant (lignes 33-38) :

```typescript
// ============================================
// CONFIGURATION : Affichage du bouton d'ajout
// ============================================
// Pour CACHER le bouton d'ajout, changez cette valeur à false
// Pour AFFICHER le bouton d'ajout, changez cette valeur à true
export const SHOW_ADD_BUTTON = true;
// ============================================
```

#### Instructions

##### ✅ Pour AFFICHER le bouton d'ajout (par défaut)
```typescript
export const SHOW_ADD_BUTTON = true;
```

##### ❌ Pour CACHER le bouton d'ajout
```typescript
export const SHOW_ADD_BUTTON = false;
```

---

### 📖 Comment modifier la limite de caractères pour "Voir plus"

#### Fichier à modifier
📁 **`src/components/PayslipCard.tsx`**

#### Ligne à modifier
Cherchez cette section au début du composant (lignes 40-45) :

```typescript
// ============================================
// CONFIGURATION : Limite de caractères pour "Voir plus"
// ============================================
// Nombre de caractères avant de tronquer la description
const DESCRIPTION_CHAR_LIMIT = 150;
// ============================================
```

#### Instructions

Modifiez la valeur selon vos besoins :

```typescript
const DESCRIPTION_CHAR_LIMIT = 150;  // Par défaut
const DESCRIPTION_CHAR_LIMIT = 200;  // Plus de texte visible
const DESCRIPTION_CHAR_LIMIT = 100;  // Moins de texte visible
```

#### Comportement
- Si la description dépasse la limite, elle sera tronquée avec "..."
- Un bouton **"Voir plus"** / **"Voir moins"** apparaîtra automatiquement
- Le bouton permet d'afficher/masquer le texte complet

---

### 📝 Comment ajouter une nouvelle description manuellement dans le code

#### Méthode 1 : Utiliser l'interface (Recommandé pour tester)

1. Cliquez sur le bouton **"+ Ajouter une description"** dans l'en-tête
2. Remplissez le formulaire avec :
   - **Titre** : Le nom de la ligne de paie
   - **Catégorie** : Choisissez parmi les catégories disponibles
   - **URL de l'image** : Lien vers une image Pexels (ex: `https://images.pexels.com/photos/...`)
   - **Description** : Explication détaillée
3. Cliquez sur **"Ajouter"**
4. **IMPORTANT** : Ouvrez la console du navigateur (F12)
5. Copiez l'objet affiché dans la console
6. Collez-le dans le fichier `src/data/payslipData.ts`

#### Méthode 2 : Ajouter directement dans le code

##### Fichier à modifier
📁 **`src/data/payslipData.ts`**

##### Étapes

1. Ouvrez le fichier `src/data/payslipData.ts`
2. Ajoutez un nouvel objet à la fin du tableau `payslipItems` :

```typescript
{
  id: '13', // Incrémentez le dernier ID
  title: 'Votre titre',
  description: 'Votre description détaillée...',
  imageUrl: 'https://images.pexels.com/photos/XXXXX/pexels-photo-XXXXX.jpeg?auto=compress&cs=tinysrgb&w=800',
  category: 'salaire', // ou 'cotisations', 'net', 'employeur', 'autres'
  keywords: ['mot1', 'mot2', 'mot3'] // Mots-clés pour la recherche
}
```

##### Exemple complet

```typescript
export const payslipItems: PayslipItem[] = [
  // ... éléments existants ...
  {
    id: '13',
    title: 'Indemnité de transport',
    description: 'L\'indemnité de transport est une aide financière versée par l\'employeur pour couvrir les frais de déplacement domicile-travail. Elle peut être obligatoire selon la convention collective.',
    imageUrl: 'https://images.pexels.com/photos/1181406/pexels-photo-1181406.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'salaire',
    keywords: ['transport', 'déplacement', 'indemnité', 'trajet']
  }
];
```

#### Catégories disponibles
- `'salaire'` : Éléments de rémunération
- `'cotisations'` : Cotisations sociales
- `'net'` : Net à payer
- `'employeur'` : Charges patronales
- `'autres'` : Autres éléments

#### Conseils pour les images
- Utilisez des images de **Pexels** (gratuites et libres de droits)
- Format recommandé : 800x600 pixels
- Ajoutez `?auto=compress&cs=tinysrgb&w=800` à la fin de l'URL pour optimiser

#### Note importante
⚠️ Après modification du fichier `payslipData.ts`, sauvegardez le fichier. Le changement sera automatiquement appliqué grâce au rechargement à chaud (hot reload) de Vite.

---

### 🎯 Résumé des configurations

| Fonctionnalité | Fichier | Constante | Valeur par défaut |
|----------------|---------|-----------|-------------------|
| Bouton d'édition | `PayslipCard.tsx` | `SHOW_EDIT_BUTTON` | `true` |
| Bouton d'ajout | `AddPayslipDialog.tsx` | `SHOW_ADD_BUTTON` | `true` |
| Limite "Voir plus" | `PayslipCard.tsx` | `DESCRIPTION_CHAR_LIMIT` | `150` caractères |
| Données | `payslipData.ts` | `payslipItems` | 12 éléments |

---

## 🇬🇧 English

### 🔧 How to hide/show the edit button

#### File to modify
📁 **`src/components/PayslipCard.tsx`**

#### Line to modify
Look for this section at the beginning of the component (lines 26-31):

```typescript
// ============================================
// CONFIGURATION: Edit button display
// ============================================
// To HIDE the edit button, change this value to false
// To SHOW the edit button, change this value to true
const SHOW_EDIT_BUTTON = true;
// ============================================
```

#### Instructions

##### ✅ To SHOW the edit button (default)
```typescript
const SHOW_EDIT_BUTTON = true;
```

##### ❌ To HIDE the edit button
```typescript
const SHOW_EDIT_BUTTON = false;
```

#### Result
- **`true`**: The edit button (pencil) appears on hover over each card
- **`false`**: The edit button is completely hidden

---

### ➕ How to hide/show the add button

#### File to modify
📁 **`src/components/AddPayslipDialog.tsx`**

#### Line to modify
Look for this section at the beginning of the component (lines 33-38):

```typescript
// ============================================
// CONFIGURATION: Add button display
// ============================================
// To HIDE the add button, change this value to false
// To SHOW the add button, change this value to true
export const SHOW_ADD_BUTTON = true;
// ============================================
```

#### Instructions

##### ✅ To SHOW the add button (default)
```typescript
export const SHOW_ADD_BUTTON = true;
```

##### ❌ To HIDE the add button
```typescript
export const SHOW_ADD_BUTTON = false;
```

---

### 📖 How to modify the character limit for "See more"

#### File to modify
📁 **`src/components/PayslipCard.tsx`**

#### Line to modify
Look for this section at the beginning of the component (lines 40-45):

```typescript
// ============================================
// CONFIGURATION: Character limit for "See more"
// ============================================
// Number of characters before truncating the description
const DESCRIPTION_CHAR_LIMIT = 150;
// ============================================
```

#### Instructions

Modify the value according to your needs:

```typescript
const DESCRIPTION_CHAR_LIMIT = 150;  // Default
const DESCRIPTION_CHAR_LIMIT = 200;  // More visible text
const DESCRIPTION_CHAR_LIMIT = 100;  // Less visible text
```

#### Behavior
- If the description exceeds the limit, it will be truncated with "..."
- A **"See more"** / **"See less"** button will appear automatically
- The button allows showing/hiding the full text

---

### 📝 How to manually add a new description in the code

#### Method 1: Use the interface (Recommended for testing)

1. Click the **"+ Add description"** button in the header
2. Fill in the form with:
   - **Title**: The name of the payslip line
   - **Category**: Choose from available categories
   - **Image URL**: Link to a Pexels image (e.g., `https://images.pexels.com/photos/...`)
   - **Description**: Detailed explanation
3. Click **"Add"**
4. **IMPORTANT**: Open the browser console (F12)
5. Copy the object displayed in the console
6. Paste it into the `src/data/payslipData.ts` file

#### Method 2: Add directly in the code

##### File to modify
📁 **`src/data/payslipData.ts`**

##### Steps

1. Open the `src/data/payslipData.ts` file
2. Add a new object at the end of the `payslipItems` array:

```typescript
{
  id: '13', // Increment the last ID
  title: 'Your title',
  description: 'Your detailed description...',
  imageUrl: 'https://images.pexels.com/photos/XXXXX/pexels-photo-XXXXX.jpeg?auto=compress&cs=tinysrgb&w=800',
  category: 'salaire', // or 'cotisations', 'net', 'employeur', 'autres'
  keywords: ['word1', 'word2', 'word3'] // Keywords for search
}
```

##### Complete example

```typescript
export const payslipItems: PayslipItem[] = [
  // ... existing items ...
  {
    id: '13',
    title: 'Transport allowance',
    description: 'The transport allowance is financial assistance paid by the employer to cover home-to-work travel expenses. It may be mandatory depending on the collective agreement.',
    imageUrl: 'https://images.pexels.com/photos/1181406/pexels-photo-1181406.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'salaire',
    keywords: ['transport', 'travel', 'allowance', 'commute']
  }
];
```

#### Available categories
- `'salaire'`: Compensation elements
- `'cotisations'`: Social contributions
- `'net'`: Net pay
- `'employeur'`: Employer charges
- `'autres'`: Other items

#### Tips for images
- Use **Pexels** images (free and royalty-free)
- Recommended format: 800x600 pixels
- Add `?auto=compress&cs=tinysrgb&w=800` at the end of the URL to optimize

#### Important note
⚠️ After modifying the `payslipData.ts` file, save the file. The change will be automatically applied thanks to Vite's hot reload feature.

---

### 🎯 Configuration summary

| Feature | File | Constant | Default value |
|---------|------|----------|---------------|
| Edit button | `PayslipCard.tsx` | `SHOW_EDIT_BUTTON` | `true` |
| Add button | `AddPayslipDialog.tsx` | `SHOW_ADD_BUTTON` | `true` |
| "See more" limit | `PayslipCard.tsx` | `DESCRIPTION_CHAR_LIMIT` | `150` characters |
| Data | `payslipData.ts` | `payslipItems` | 12 items |

---

<div align="center">

**Made with ❤️ for better payslip understanding**

**Fait avec ❤️ pour une meilleure compréhension des fiches de paie**

</div>
