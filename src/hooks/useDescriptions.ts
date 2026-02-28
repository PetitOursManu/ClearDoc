import { useState, useEffect } from 'react';
import { getDescriptionsWithFallback } from '@/config/apiConfig';
import { requestCache } from '@/services/requestCache';

const fallbackDescriptions = [
  { id: 'salaire_base', title: 'Salaire de base', description: 'Rémunération fixe mensuelle' },
  { id: 'heures_sup', title: 'Heures supplémentaires', description: 'Heures travaillées au-delà de la durée légale' },
  { id: 'prime_anciennete', title: 'Prime d\'ancienneté', description: 'Prime liée à l\'ancienneté dans l\'entreprise' },
  { id: 'cotisations_sociales', title: 'Cotisations sociales', description: 'Cotisations salariales obligatoires' },
  { id: 'csg_crds', title: 'CSG/CRDS', description: 'Contribution sociale généralisée et contribution au remboursement de la dette sociale' }
];

interface UseDescriptionsReturn {
  descriptions: any[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDescriptions(): UseDescriptionsReturn {
  const [descriptions, setDescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDescriptions = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await requestCache.fetch(
        'descriptions',
        () => getDescriptionsWithFallback(fallbackDescriptions)
      );

      if (Array.isArray(result)) {
        setDescriptions(result);
      } else if (result && result.descriptions && Array.isArray(result.descriptions)) {
        setDescriptions(result.descriptions);
      } else {
        throw new Error('Format de descriptions non reconnu');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      setDescriptions(fallbackDescriptions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDescriptions();
  }, []);

  return { descriptions, loading, error, refetch: fetchDescriptions };
}
