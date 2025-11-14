import { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'fr' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations = {
  fr: {
    // Header
    'header.title': 'Comprendre ma Fiche de Paie',
    'header.subtitle': 'Explications détaillées de chaque ligne',
    
    // Search
    'search.title': 'Recherchez un élément de votre fiche de paie',
    'search.description': 'Utilisez la barre de recherche ou les filtres pour trouver rapidement l\'explication dont vous avez besoin',
    'search.placeholder': 'Rechercher une ligne de fiche de paie...',
    
    // Categories
    'category.all': 'Tout',
    'category.salaire': 'Salaire',
    'category.cotisations': 'Cotisations',
    'category.net': 'Net à payer',
    'category.employeur': 'Employeur',
    'category.autres': 'Autres',
    
    // Results
    'results.count': 'résultat',
    'results.count_plural': 'résultats',
    'results.none.title': 'Aucun résultat',
    'results.none.description': 'Essayez de modifier votre recherche ou vos filtres',
    
    // Card
    'card.seeMore': 'Voir plus',
    'card.seeLess': 'Voir moins',
    
    // Edit Dialog
    'edit.title': 'Modifier l\'élément',
    'edit.description': 'Modifiez le titre, la catégorie, l\'URL de l\'image et la description de cet élément de fiche de paie.',
    'edit.field.title': 'Titre',
    'edit.field.category': 'Catégorie',
    'edit.field.categoryPlaceholder': 'Sélectionner une catégorie',
    'edit.field.imageUrl': 'URL de l\'image',
    'edit.field.imageUrlPlaceholder': 'https://example.com/image.jpg',
    'edit.field.imagePreview': 'Aperçu',
    'edit.field.description': 'Description',
    'edit.button.cancel': 'Annuler',
    'edit.button.save': 'Enregistrer',
    
    // Add Dialog
    'add.button': 'Ajouter une description',
    'add.title': 'Ajouter un nouvel élément',
    'add.description': 'Ajoutez un nouvel élément de fiche de paie avec son titre, sa catégorie, son image et sa description.',
    'add.button.add': 'Ajouter',
    
    // Footer
    'footer.copyright': '© 2024 Comprendre ma Fiche de Paie. Toutes les informations sont fournies à titre indicatif.',
  },
  en: {
    // Header
    'header.title': 'Understanding My Payslip',
    'header.subtitle': 'Detailed explanations of each line',
    
    // Search
    'search.title': 'Search for a payslip item',
    'search.description': 'Use the search bar or filters to quickly find the explanation you need',
    'search.placeholder': 'Search for a payslip line...',
    
    // Categories
    'category.all': 'All',
    'category.salaire': 'Salary',
    'category.cotisations': 'Contributions',
    'category.net': 'Net Pay',
    'category.employeur': 'Employer',
    'category.autres': 'Other',
    
    // Results
    'results.count': 'result',
    'results.count_plural': 'results',
    'results.none.title': 'No results',
    'results.none.description': 'Try modifying your search or filters',
    
    // Card
    'card.seeMore': 'See more',
    'card.seeLess': 'See less',
    
    // Edit Dialog
    'edit.title': 'Edit Item',
    'edit.description': 'Edit the title, category, image URL, and description of this payslip item.',
    'edit.field.title': 'Title',
    'edit.field.category': 'Category',
    'edit.field.categoryPlaceholder': 'Select a category',
    'edit.field.imageUrl': 'Image URL',
    'edit.field.imageUrlPlaceholder': 'https://example.com/image.jpg',
    'edit.field.imagePreview': 'Preview',
    'edit.field.description': 'Description',
    'edit.button.cancel': 'Cancel',
    'edit.button.save': 'Save',
    
    // Add Dialog
    'add.button': 'Add Description',
    'add.title': 'Add New Item',
    'add.description': 'Add a new payslip item with its title, category, image, and description.',
    'add.button.add': 'Add',
    
    // Footer
    'footer.copyright': '© 2024 Understanding My Payslip. All information is provided for informational purposes only.',
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('fr');

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations.fr] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
