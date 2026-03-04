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
    'category.all': 'Tous',
    'category.salaire': 'Salaire',
    'category.cotisations': 'Cotisations',
    'category.net': 'Net',
    'category.employeur': 'Employeur',
    'category.primes': 'Primes',
    'category.conges': 'Congés',
    'category.autres': 'Autres',
    'results.count': 'résultat',
    'results.count_plural': 'résultats',
    'results.none.title': 'Aucun résultat trouvé',
    'results.none.description': 'Essayez de modifier vos critères de recherche',
    'card.edit': 'Modifier',
    'card.seeMore': 'Voir plus',
    'card.seeLess': 'Voir moins',
    'edit.title': 'Modifier la description',
    'edit.description': 'Modifiez les informations de cette ligne de paie',
    'edit.field.title': 'Titre',
    'edit.field.description': 'Description (éditeur de texte riche)',
    'edit.field.category': 'Catégorie',
    'edit.field.categoryPlaceholder': 'Sélectionnez une catégorie',
    'edit.field.imageUrl': 'URL de l\'image',
    'edit.field.imageUrlPlaceholder': 'https://example.com/image.jpg',
    'edit.field.imagePreview': 'Aperçu de l\'image',
    'edit.button.cancel': 'Annuler',
    'edit.button.save': 'Enregistrer',
    'add.title': 'Ajouter une nouvelle ligne de paie',
    'add.description': 'Remplissez les informations pour créer une nouvelle entrée. La description supporte le texte riche (gras, italique, couleurs, listes, titres…)',
    'add.button': 'Ajouter',
    'add.button.add': 'Générer le code',
    'add.generatedCode': 'Code généré',
    'add.copyCode': 'Copier le code',
    'add.copied': 'Copié !',
    'add.codeInstruction': 'Copiez ce code dans votre tableau payslipData pour l\'ajouter de manière permanente.',
    'add.close': 'Fermer',
    'nav.payslip': 'Fiche de paie interactive',
    'nav.documents': 'Documents des structures',
    'footer.copyright': '© 2025 ClearDoc. Tous droits réservés.',
  },
  en: {
    'header.title': 'ClearDoc',
    'header.subtitle': 'Understanding my payslip',
    'search.title': 'Search a payslip line',
    'search.description': 'Quickly find explanations for the different lines on your payslip',
    'search.placeholder': 'Search by keyword...',
    'category.all': 'All',
    'category.salaire': 'Salary',
    'category.cotisations': 'Contributions',
    'category.net': 'Net',
    'category.employeur': 'Employer',
    'category.primes': 'Bonuses',
    'category.conges': 'Leave',
    'category.autres': 'Other',
    'results.count': 'result',
    'results.count_plural': 'results',
    'results.none.title': 'No results found',
    'results.none.description': 'Try adjusting your search criteria',
    'card.edit': 'Edit',
    'card.seeMore': 'See more',
    'card.seeLess': 'See less',
    'edit.title': 'Edit entry',
    'edit.description': 'Update the information for this payslip line',
    'edit.field.title': 'Title',
    'edit.field.description': 'Description (rich text editor)',
    'edit.field.category': 'Category',
    'edit.field.categoryPlaceholder': 'Select a category',
    'edit.field.imageUrl': 'Image URL',
    'edit.field.imageUrlPlaceholder': 'https://example.com/image.jpg',
    'edit.field.imagePreview': 'Image preview',
    'edit.button.cancel': 'Cancel',
    'edit.button.save': 'Save',
    'add.title': 'Add a new entry',
    'add.description': 'Fill in the details to create a new entry. The description supports rich text (bold, italic, colors, lists, headings…)',
    'add.button': 'Add',
    'add.button.add': 'Add',
    'add.generatedCode': 'Generated code',
    'add.copyCode': 'Copy code',
    'add.copied': 'Copied!',
    'add.codeInstruction': 'Copy this code into your payslipData array to add it permanently.',
    'add.close': 'Close',
    'nav.payslip': 'Interactive payslip',
    'nav.documents': 'Structure documents',
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
