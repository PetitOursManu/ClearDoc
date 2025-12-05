// ============================================
// CONFIGURATION API
// ============================================
// Modifiez ces paramètres selon votre configuration serveur

import { debugLog, debugError } from './debugConfig';

export const API_CONFIG = {
  // URL de votre API JSON
  url: 'https://ton-domaine.fr/app/ma_base/mon_document',
  
  // Identifiants pour l'authentification Basic Auth
  auth: {
    username: 'monuser',
    password: 'monpassword'
  },
  
  // Timeout en millisecondes (optionnel)
  timeout: 10000,
};

// ============================================
// NE PAS MODIFIER EN DESSOUS DE CETTE LIGNE
// ============================================

/**
 * Encode les identifiants en base64 pour Basic Auth
 */
function encodeBasicAuth(username: string, password: string): string {
  const credentials = `${username}:${password}`;
  return btoa(credentials);
}

/**
 * Récupère les données depuis le serveur distant
 * @returns Promise avec les données JSON
 */
export async function getData(): Promise<any> {
  try {
    debugLog('🔄 Récupération des données depuis:', API_CONFIG.url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

    const response = await fetch(API_CONFIG.url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${encodeBasicAuth(API_CONFIG.auth.username, API_CONFIG.auth.password)}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    debugLog('✅ Données récupérées avec succès:', data);

    return data;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        debugError('❌ Timeout: La requête a pris trop de temps');
        throw new Error('La requête a expiré. Veuillez réessayer.');
      }
      debugError('❌ Erreur lors de la récupération des données:', error.message);
      throw error;
    }
    debugError('❌ Erreur inconnue:', error);
    throw new Error('Une erreur inconnue est survenue');
  }
}

/**
 * Récupère les données avec gestion du cache et fallback
 */
export async function getDataWithFallback(fallbackData?: any): Promise<any> {
  try {
    // Essayer de récupérer depuis le serveur
    const data = await getData();
    
    // Sauvegarder dans le localStorage pour utilisation hors ligne
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('payslip_data_cache', JSON.stringify(data));
      localStorage.setItem('payslip_data_cache_time', Date.now().toString());
    }
    
    return data;
  } catch (error) {
    debugLog('⚠️ Utilisation des données en cache ou de fallback');
    
    // Essayer de récupérer depuis le cache
    if (typeof window !== 'undefined' && window.localStorage) {
      const cachedData = localStorage.getItem('payslip_data_cache');
      if (cachedData) {
        try {
          return JSON.parse(cachedData);
        } catch (e) {
          debugError('Erreur lors de la lecture du cache:', e);
        }
      }
    }
    
    // Utiliser les données de fallback si fournies
    if (fallbackData) {
      return fallbackData;
    }
    
    // Si aucune donnée disponible, propager l'erreur
    throw error;
  }
}
