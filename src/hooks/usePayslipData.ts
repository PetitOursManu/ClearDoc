import { useState, useEffect, useRef } from 'react';
import { PayslipItem } from '@/types/payslip';
import { getDataWithFallback } from '@/config/apiConfig';
import { fallbackPayslipItems } from '@/data/fallbackData';

interface UsePayslipDataReturn {
  data: PayslipItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Variable globale pour stocker la promesse en cours
let fetchPromise: Promise<any> | null = null;

export function usePayslipData(): UsePayslipDataReturn {
  const [data, setData] = useState<PayslipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const hasFetchedRef = useRef(false);

  const fetchData = async () => {
    // Si une requête est déjà en cours, attendre qu'elle se termine
    if (fetchPromise) {
      console.log('⏳ Requête déjà en cours, en attente...');
      try {
        const result = await fetchPromise;
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
    fetchPromise = getDataWithFallback(fallbackPayslipItems);
    
    try {
      const result = await fetchPromise;
      if (isMountedRef.current) {
        processResult(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        handleError(err);
      }
    } finally {
      fetchPromise = null; // Réinitialiser la promesse
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const processResult = (result: any) => {
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
  };

  const handleError = (err: any) => {
    const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
    setError(errorMessage);
    console.error('Erreur lors du chargement des données:', errorMessage);
    
    // Utiliser les données de fallback en cas d'erreur
    setData(fallbackPayslipItems);
  };

  useEffect(() => {
    // Éviter les appels multiples
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchData();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, []); // Tableau de dépendances vide pour n'exécuter qu'une fois

  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
}
