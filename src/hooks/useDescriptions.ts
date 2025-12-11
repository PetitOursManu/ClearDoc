import { useState, useEffect } from 'react';
import { getDescriptionsWithFallback } from '@/config/apiConfig';
import { requestCache } from '@/services/requestCache';

// Descriptions par défaut en cas d'échec du chargement
const fallbackDescriptions = [
  {
    id: 'salaire_base',
    title: 'Salaire de base',
    description: 'Rémunération fixe mensuelle'
  },
  {
    id: 'heures_sup',
    title: 'Heures supplémentaires',
    description: 'Heures travaillées au-delà de la durée légale'
  },
  {
    id: 'prime_anciennete',
    title: 'Prime d\'ancienneté',
    description: 'Prime liée à l\'ancienneté dans l\'entreprise'
  },
  {
    id: 'cotisations_sociales',
    title: 'Cotisations sociales',
    description: 'Cotisations salariales obligatoires'
  },
  {
    id: 'csg_crds',
    title: 'CSG/CRDS',
    description: 'Contribution sociale généralisée et contribution au remboursement de la dette sociale'
  }
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
      // Utiliser le cache pour éviter les requêtes multiples
      const result = await requestCache.fetch(
        'descriptions',
        () => getDescriptionsWithFallback(fallbackDescriptions)
      );
      
      // Vérifier la structure de la réponse
      if (Array.isArray(result)) {
        setDescriptions(result);
        console.log('✅ Descriptions chargées:', result.length);
      } else if (result && result.descriptions && Array.isArray(result.descriptions)) {
        setDescriptions(result.descriptions);
        console.log('✅ Descriptions chargées:', result.descriptions.length);
      } else {
        throw new Error('Format de descriptions non reconnu');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      console.error('Erreur lors du chargement des descriptions:', errorMessage);
      
      // Utiliser les descriptions de fallback en cas d'erreur
      setDescriptions(fallbackDescriptions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDescriptions();
  }, []);

  return {
    descriptions,
    loading,
    error,
    refetch: fetchDescriptions
  };
}
