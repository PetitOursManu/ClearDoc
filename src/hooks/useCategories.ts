import { useState, useEffect } from 'react';
import { getCategoriesWithFallback } from '@/config/apiConfig';
import { Category, CategoriesResponse } from '@/types/category';
import { requestCache } from '@/services/requestCache';

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

export function useCategories(): UseCategoriesReturn {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Utiliser le cache pour éviter les requêtes multiples
      const result = await requestCache.fetch(
        'categories',
        () => getCategoriesWithFallback(fallbackCategories)
      );
      
      // Vérifier la structure de la réponse
      if (result && result.categories && Array.isArray(result.categories)) {
        setCategories(result.categories);
        console.log('✅ Catégories chargées:', result.categories.length);
      } else if (Array.isArray(result)) {
        // Si c'est directement un tableau de catégories
        setCategories(result);
        console.log('✅ Catégories chargées:', result.length);
      } else {
        throw new Error('Format de catégories non reconnu');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      console.error('Erreur lors du chargement des catégories:', errorMessage);
      
      // Utiliser les catégories de fallback en cas d'erreur
      setCategories(fallbackCategories.categories);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories
  };
}
