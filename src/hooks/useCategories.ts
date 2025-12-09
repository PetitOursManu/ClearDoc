import { useState, useEffect, useRef } from 'react';
import { getCategoriesWithFallback } from '@/config/apiConfig';
import { Category, CategoriesResponse } from '@/types/category';

// Catégories par défaut en cas d'échec du chargement
const fallbackCategories: CategoriesResponse = {
  _id: 'fallback',
  _rev: 'fallback',
  type: 'categories',
  categories: [
    { id: 'salaire', title: 'Salaire' },
    { id: 'cotisations', title: 'Cotisations' },
    { id: 'net', title: 'Net' },
    { id: 'employeur', title: 'Employeur' },
    { id: 'autres', title: 'Autres' }
  ]
};

interface UseCategoriesReturn {
  categories: Category[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Variable globale pour stocker la promesse en cours
let fetchCategoriesPromise: Promise<any> | null = null;

export function useCategories(): UseCategoriesReturn {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const hasFetchedRef = useRef(false);

  const fetchCategories = async () => {
    // Si une requête est déjà en cours, attendre qu'elle se termine
    if (fetchCategoriesPromise) {
      console.log('⏳ Requête catégories déjà en cours, en attente...');
      try {
        const result = await fetchCategoriesPromise;
        if (isMountedRef.current) {
          processResult(result);
        }
        return;
      } catch (err) {
        if (isMountedRef.current) {
          handleError(err);
        }
        return;
      }
    }

    setLoading(true);
    setError(null);
    
    // Créer une nouvelle promesse et la stocker
    fetchCategoriesPromise = getCategoriesWithFallback(fallbackCategories);
    
    try {
      const result = await fetchCategoriesPromise;
      if (isMountedRef.current) {
        processResult(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        handleError(err);
      }
    } finally {
      fetchCategoriesPromise = null; // Réinitialiser la promesse
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const processResult = (result: any) => {
    // Vérifier la structure de la réponse
    if (result && result.categories && Array.isArray(result.categories)) {
      setCategories(result.categories);
      console.log('✅ Catégories chargées:', result.categories.length);
    } else {
      throw new Error('Format de catégories non reconnu');
    }
  };

  const handleError = (err: any) => {
    const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
    setError(errorMessage);
    console.error('Erreur lors du chargement des catégories:', errorMessage);
    
    // Utiliser les catégories de fallback en cas d'erreur
    setCategories(fallbackCategories.categories);
  };

  useEffect(() => {
    // Éviter les appels multiples
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchCategories();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, []); // Tableau de dépendances vide pour n'exécuter qu'une fois

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories
  };
}
