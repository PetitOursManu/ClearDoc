import { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'fr' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  fr: {
    'header.title': 'ClearDoc',
    'header.subtitle': 'Comprendre ma fiche de paie',
    'search.title': 'Rechercher une ligne de paie',
    'search.description': 'Trouvez rapidement des explications sur les différentes lignes de votre fiche de paie',
    'search.placeholder': 'Rechercher par mot-clé...',
    'category.all': 'Toutes les catégories',
    'category.salaire': 'Salaire',
    'category.cotisations': 'Cotisations',
    'category.primes': 'Primes',
    'category.conges': 'Congés',
    'category.autres': 'Autres',
    'results.count': 'résultat',
    'results.count_plural': 'résultats',
    'results.none.title': 'Aucun résultat trouvé',
    'results.none.description': 'Essayez de modifier vos critères de recherche',
    'card.edit': 'Modifier',
    'card.showMore': 'Voir plus',
    'card.showLess': 'Voir moins',
    'dialog.edit.title': 'Modifier la description',
    'dialog.edit.description': 'Modifiez les informations de cette ligne de paie',
    'dialog.edit.titleLabel': 'Titre',
    'dialog.edit.descriptionLabel': 'Description',
    'dialog.edit.categoryLabel': 'Catégorie',
    'dialog.edit.cancel': 'Annuler',
    'dialog.edit.save': 'Enregistrer',
    'dialog.add.title': 'Ajouter une nouvelle description',
    'dialog.add.description': 'Créez une nouvelle ligne de paie',
    'dialog.add.button': 'Ajouter',
    'dialog.add.titleLabel': 'Titre',
    'dialog.add.descriptionLabel': 'Description',
    'dialog.add.imageUrlLabel': 'URL de l\'image',
    'dialog.add.categoryLabel': 'Catégorie',
    'dialog.add.keywordsLabel': 'Mots-clés (séparés par des virgules)',
    'dialog.add.cancel': 'Annuler',
    'dialog.add.save': 'Ajouter',
    'footer.copyright': '© 2025 ClearDoc. Tous droits réservés.',
  },
  en: {
    'header.title': 'ClearDoc',
    'header.subtitle': 'Understanding my payslip',
    'search.title': 'Search for a payslip line',
    'search.description': 'Quickly find explanations for different lines on your payslip',
    'search.placeholder': 'Search by keyword...',
    'category.all': 'All categories',
    'category.salaire': 'Salary',
    'category.cotisations': 'Contributions',
    'category.primes': 'Bonuses',
    'category.conges': 'Leave',
    'category.autres': 'Other',
    'results.count': 'result',
    'results.count_plural': 'results',
    'results.none.title': 'No results found',
    'results.none.description': 'Try modifying your search criteria',
    'card.edit': 'Edit',
    'card.showMore': 'Show more',
    'card.showLess': 'Show less',
    'dialog.edit.title': 'Edit description',
    'dialog.edit.description': 'Edit the information for this payslip line',
    'dialog.edit.titleLabel': 'Title',
    'dialog.edit.descriptionLabel': 'Description',
    'dialog.edit.categoryLabel': 'Category',
    'dialog.edit.cancel': 'Cancel',
    'dialog.edit.save': 'Save',
    'dialog.add.title': 'Add new description',
    'dialog.add.description': 'Create a new payslip line',
    'dialog.add.button': 'Add',
    'dialog.add.titleLabel': 'Title',
    'dialog.add.descriptionLabel': 'Description',
    'dialog.add.imageUrlLabel': 'Image URL',
    'dialog.add.categoryLabel': 'Category',
    'dialog.add.keywordsLabel': 'Keywords (comma separated)',
    'dialog.add.cancel': 'Cancel',
    'dialog.add.save': 'Add',
    'footer.copyright': '© 2025 ClearDoc. All rights reserved.',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

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
