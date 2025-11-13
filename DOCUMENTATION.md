# Documentation - Configuration de l'Application

## 🔧 Comment cacher/afficher le bouton d'édition

### Fichier à modifier
📁 **`src/components/PayslipCard.tsx`**

### Ligne à modifier
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

### Instructions

#### ✅ Pour AFFICHER le bouton d'édition (par défaut)
```typescript
const SHOW_EDIT_BUTTON = true;
```

#### ❌ Pour CACHER le bouton d'édition
```typescript
const SHOW_EDIT_BUTTON = false;
```

### Résultat
- **`true`** : Le bouton d'édition (crayon) apparaît au survol de chaque carte
- **`false`** : Le bouton d'édition est complètement masqué

---

## ➕ Comment cacher/afficher le bouton d'ajout

### Fichier à modifier
📁 **`src/components/AddPayslipDialog.tsx`**

### Ligne à modifier
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

### Instructions

#### ✅ Pour AFFICHER le bouton d'ajout (par défaut)
```typescript
export const SHOW_ADD_BUTTON = true;
```

#### ❌ Pour CACHER le bouton d'ajout
```typescript
export const SHOW_ADD_BUTTON = false;
```

---

## 📖 Comment modifier la limite de caractères pour "Voir plus"

### Fichier à modifier
📁 **`src/components/PayslipCard.tsx`**

### Ligne à modifier
Cherchez cette section au début du composant (lignes 40-45) :

```typescript
// ============================================
// CONFIGURATION : Limite de caractères pour "Voir plus"
// ============================================
// Nombre de caractères avant de tronquer la description
const DESCRIPTION_CHAR_LIMIT = 150;
// ============================================
```

### Instructions

Modifiez la valeur selon vos besoins :

```typescript
const DESCRIPTION_CHAR_LIMIT = 150;  // Par défaut
const DESCRIPTION_CHAR_LIMIT = 200;  // Plus de texte visible
const DESCRIPTION_CHAR_LIMIT = 100;  // Moins de texte visible
```

### Comportement
- Si la description dépasse la limite, elle sera tronquée avec "..."
- Un bouton **"Voir plus"** / **"Voir moins"** apparaîtra automatiquement
- Le bouton permet d'afficher/masquer le texte complet

---

## 📝 Comment ajouter une nouvelle description manuellement dans le code

### Méthode 1 : Utiliser l'interface (Recommandé pour tester)

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

### Méthode 2 : Ajouter directement dans le code

#### Fichier à modifier
📁 **`src/data/payslipData.ts`**

#### Étapes

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

#### Exemple complet

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

### Catégories disponibles
- `'salaire'` : Éléments de rémunération
- `'cotisations'` : Cotisations sociales
- `'net'` : Net à payer
- `'employeur'` : Charges patronales
- `'autres'` : Autres éléments

### Conseils pour les images
- Utilisez des images de **Pexels** (gratuites et libres de droits)
- Format recommandé : 800x600 pixels
- Ajoutez `?auto=compress&cs=tinysrgb&w=800` à la fin de l'URL pour optimiser

### Note importante
⚠️ Après modification du fichier `payslipData.ts`, sauvegardez le fichier. Le changement sera automatiquement appliqué grâce au rechargement à chaud (hot reload) de Vite.

---

## 🎯 Résumé des configurations

| Fonctionnalité | Fichier | Constante | Valeur par défaut |
|----------------|---------|-----------|-------------------|
| Bouton d'édition | `PayslipCard.tsx` | `SHOW_EDIT_BUTTON` | `true` |
| Bouton d'ajout | `AddPayslipDialog.tsx` | `SHOW_ADD_BUTTON` | `true` |
| Limite "Voir plus" | `PayslipCard.tsx` | `DESCRIPTION_CHAR_LIMIT` | `150` caractères |
| Données | `payslipData.ts` | `payslipItems` | 12 éléments |
