import { useState, useEffect } from 'react';
import { getCategoriesWithFallback } from '@/config/apiConfig';
import { Category, CategoriesResponse } from '@/types/category';
import { requestCache } from '@/services/requestCache';

const fallbackCategories: CategoriesResponse = {
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
      const result = await requestCache.fetch(
        'categories',
        () => getCategoriesWithFallback(fallbackCategories)
      );

      if (result && result.categories && Array.isArray(result.categories)) {
        setCategories(result.categories);
      } else if (Array.isArray(result)) {
        setCategories(result);
      } else {
        throw new Error('Format de catégories non reconnu');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      setCategories(fallbackCategories.categories);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return { categories, loading, error, refetch: fetchCategories };
}
