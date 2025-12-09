// ============================================
// CONFIGURATION API
// ============================================
// Modifiez ces paramètres selon votre configuration serveur

export const API_CONFIG = {
  // URL de votre API JSON pour les données principales
  dataUrl: 'https://ton-domaine.fr/app/ma_base/mon_document',
  
  // URL de votre API JSON pour les catégories
  categoriesUrl: 'https://ton-domaine.fr/app/ma_base/categories',
  
  // Identifiants pour l'authentification Basic Auth
  auth: {
    username: 'monuser',
    password: 'monpassword'
  },
  
  // Timeout en millisecondes (optionnel)
  timeout: 10000,
  
  // Activer/désactiver les logs de debug
  debug: true
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
 * Fonction générique pour récupérer des données depuis une URL
 */
async function fetchFromAPI(url: string, resourceName: string): Promise<any> {
  try {
    if (API_CONFIG.debug) {
      console.log(`🔄 Récupération des ${resourceName} depuis:`, url);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

    const response = await fetch(url, {
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
    
    if (API_CONFIG.debug) {
      console.log(`✅ ${resourceName} récupérées avec succès:`, data);
    }

    // Ajouter un marqueur pour indiquer que les données viennent du serveur
    return { ...data, _fromServer: true };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error(`❌ Timeout: La requête pour ${resourceName} a pris trop de temps`);
        throw new Error('La requête a expiré. Veuillez réessayer.');
      }
      console.error(`❌ Erreur lors de la récupération des ${resourceName}:`, error.message);
      throw error;
    }
    console.error('❌ Erreur inconnue:', error);
    throw new Error('Une erreur inconnue est survenue');
  }
}

/**
 * Récupère les données principales depuis le serveur distant
 * @returns Promise avec les données JSON
 */
export async function getData(): Promise<any> {
  return fetchFromAPI(API_CONFIG.dataUrl, 'données');
}

/**
 * Récupère les catégories depuis le serveur distant
 * @returns Promise avec les catégories JSON
 */
export async function getCategories(): Promise<any> {
  return fetchFromAPI(API_CONFIG.categoriesUrl, 'catégories');
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
    console.warn('⚠️ Utilisation des données en cache ou de fallback');
    
    // Essayer de récupérer depuis le cache
    if (typeof window !== 'undefined' && window.localStorage) {
      const cachedData = localStorage.getItem('payslip_data_cache');
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          // Ne pas ajouter _fromServer car ce sont des données en cache
          return parsed;
        } catch (e) {
          console.error('Erreur lors de la lecture du cache:', e);
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

/**
 * Récupère les catégories avec gestion du cache et fallback
 */
export async function getCategoriesWithFallback(fallbackCategories?: any): Promise<any> {
  try {
    // Essayer de récupérer depuis le serveur
    const data = await getCategories();
    
    // Sauvegarder dans le localStorage pour utilisation hors ligne
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('categories_cache', JSON.stringify(data));
      localStorage.setItem('categories_cache_time', Date.now().toString());
    }
    
    return data;
  } catch (error) {
    console.warn('⚠️ Utilisation des catégories en cache ou de fallback');
    
    // Essayer de récupérer depuis le cache
    if (typeof window !== 'undefined' && window.localStorage) {
      const cachedData = localStorage.getItem('categories_cache');
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          // Ne pas ajouter _fromServer car ce sont des données en cache
          return parsed;
        } catch (e) {
          console.error('Erreur lors de la lecture du cache des catégories:', e);
        }
      }
    }
    
    // Utiliser les catégories de fallback si fournies
    if (fallbackCategories) {
      return fallbackCategories;
    }
    
    // Si aucune catégorie disponible, propager l'erreur
    throw error;
  }
}
