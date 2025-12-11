import { useState, useEffect } from 'react';
import { PayslipItem } from '@/types/payslip';
import { getDataWithFallback } from '@/config/apiConfig';
import { fallbackPayslipItems } from '@/data/fallbackData';
import { requestCache } from '@/services/requestCache';

interface UsePayslipDataReturn {
  data: PayslipItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePayslipData(): UsePayslipDataReturn {
  const [data, setData] = useState<PayslipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Utiliser le cache pour éviter les requêtes multiples
      const result = await requestCache.fetch(
        'payslip-data',
        () => getDataWithFallback(fallbackPayslipItems)
      );
      
      // Vérifier si on utilise les données de fallback
      const isUsingFallback = !result._fromServer;
      
      // Vérifier si le résultat est un tableau
      if (Array.isArray(result)) {
        setData(result);
      } else if (result && typeof result === 'object') {
        // Si c'est un objet avec une propriété contenant le tableau
        if (result.items && Array.isArray(result.items)) {
          setData(result.items);
        } else if (result.data && Array.isArray(result.data)) {
          setData(result.data);
        } else if (result.payslipItems && Array.isArray(result.payslipItems)) {
          setData(result.payslipItems);
        } else {
          // Essayer de convertir l'objet en tableau
          const values = Object.values(result);
          if (values.length > 0 && Array.isArray(values[0])) {
            setData(values[0] as PayslipItem[]);
          } else {
            throw new Error('Format de données non reconnu');
          }
        }
      } else {
        throw new Error('Aucune donnée reçue');
      }
      
      // Si on utilise le fallback, définir une erreur
      if (isUsingFallback) {
        setError('Connexion au serveur impossible');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      console.error('Erreur lors du chargement des données:', errorMessage);
      
      // Utiliser les données de fallback en cas d'erreur
      setData(fallbackPayslipItems);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
}
