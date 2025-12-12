// ============================================
// CONFIGURATION API POUR COUCHDB
// ============================================
// Configuration automatique via variables d'environnement

export const API_CONFIG = {
  // URL de base de votre instance CouchDB
  baseUrl: import.meta.env.VITE_COUCHDB_URL || 'http://localhost:5984',
  
  // Nom de la base de données principale
  database: import.meta.env.VITE_COUCHDB_DATABASE || 'payslips',
  
  // Identifiants pour l'authentification
  auth: {
    username: import.meta.env.VITE_COUCHDB_USERNAME || '',
    password: import.meta.env.VITE_COUCHDB_PASSWORD || ''
  },
  
  // Timeout en millisecondes
  timeout: parseInt(import.meta.env.VITE_COUCHDB_TIMEOUT || '10000'),
  
  // Activer/désactiver les logs de debug
  debug: import.meta.env.VITE_COUCHDB_DEBUG === 'true' || import.meta.env.DEV,

  // Configuration pour fichiers séparés
  useSeparateFiles: import.meta.env.VITE_USE_SEPARATE_FILES === 'true',
  
  // Configuration des descriptions
  descriptions: {
    // URL directe vers un fichier ou endpoint
    fileUrl: import.meta.env.VITE_DESCRIPTIONS_FILE_URL,
    // Base de données séparée
    database: import.meta.env.VITE_DESCRIPTIONS_DATABASE || 'descriptions',
    // URL vers un fichier JSON statique
    jsonUrl: import.meta.env.VITE_DESCRIPTIONS_JSON_URL
  },
  
  // Configuration des catégories
  categories: {
    // URL directe vers un fichier ou endpoint
    fileUrl: import.meta.env.VITE_CATEGORIES_FILE_URL,
    // Base de données séparée
    database: import.meta.env.VITE_CATEGORIES_DATABASE || 'categories',
    // URL vers un fichier JSON statique
    jsonUrl: import.meta.env.VITE_CATEGORIES_JSON_URL
  },

  // URLs complètes construites automatiquement
  get dataUrl() {
    return `${this.baseUrl}/${this.database}/_all_docs?include_docs=true`;
  },
  
  get categoriesUrl() {
    // Priorité : URL directe > Base séparée > Vue dans base principale > JSON statique
    if (this.categories.fileUrl) {
      return this.categories.fileUrl;
    }
    if (this.useSeparateFiles && this.categories.database) {
      return `${this.baseUrl}/${this.categories.database}/_all_docs?include_docs=true`;
    }
    if (this.categories.jsonUrl) {
      return this.categories.jsonUrl;
    }
    return `${this.baseUrl}/${this.database}/_design/categories/_view/all`;
  },

  get descriptionsUrl() {
    // Priorité : URL directe > Base séparée > Vue dans base principale > JSON statique
    if (this.descriptions.fileUrl) {
      return this.descriptions.fileUrl;
    }
    if (this.useSeparateFiles && this.descriptions.database) {
      return `${this.baseUrl}/${this.descriptions.database}/_all_docs?include_docs=true`;
    }
    if (this.descriptions.jsonUrl) {
      return this.descriptions.jsonUrl;
    }
    return `${this.baseUrl}/${this.database}/_design/descriptions/_view/all`;
  },

  get dbUrl() {
    return `${this.baseUrl}/${this.database}`;
  }
};

// Validation de la configuration
if (typeof window !== 'undefined') {
  if (!API_CONFIG.baseUrl || API_CONFIG.baseUrl === 'http://localhost:5984') {
    console.warn('⚠️ VITE_COUCHDB_URL non configurée, utilisation de localhost');
  }
  
  if (!API_CONFIG.auth.username || !API_CONFIG.auth.password) {
    console.warn('⚠️ Identifiants CouchDB non configurés');
  }
  
  if (API_CONFIG.debug) {
    console.log('🔧 Configuration CouchDB:', {
      baseUrl: API_CONFIG.baseUrl,
      database: API_CONFIG.database,
      hasAuth: !!(API_CONFIG.auth.username && API_CONFIG.auth.password),
      timeout: API_CONFIG.timeout,
      useSeparateFiles: API_CONFIG.useSeparateFiles,
      categoriesUrl: API_CONFIG.categoriesUrl,
      descriptionsUrl: API_CONFIG.descriptionsUrl
    });
  }
}

// ============================================
// FONCTIONS D'API COUCHDB
// ============================================

// Cache pour éviter les requêtes multiples
const requestCache = new Map<string, Promise<any>>();

/**
 * Encode les identifiants en base64 pour Basic Auth
 */
function encodeBasicAuth(username: string, password: string): string {
  const credentials = `${username}:${password}`;
  return btoa(credentials);
}

/**
 * Fonction générique pour les requêtes CouchDB
 */
async function fetchFromCouchDB(url: string, options: RequestInit = {}): Promise<any> {
  const cacheKey = `${url}-${JSON.stringify(options)}`;
  
  // Vérifier si une requête est déjà en cours
  if (requestCache.has(cacheKey)) {
    if (API_CONFIG.debug) {
      console.log(`♻️ Réutilisation de la requête en cours pour: ${url}`);
    }
    return requestCache.get(cacheKey);
  }

  const requestPromise = (async () => {
    try {
      if (API_CONFIG.debug) {
        console.log(`🔄 Requête vers: ${url}`);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

      // Créer un objet headers typé correctement
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      // Ajouter les headers personnalisés s'ils existent
      if (options.headers) {
        if (options.headers instanceof Headers) {
          options.headers.forEach((value, key) => {
            headers[key] = value;
          });
        } else if (Array.isArray(options.headers)) {
          options.headers.forEach(([key, value]) => {
            headers[key] = value;
          });
        } else {
          Object.assign(headers, options.headers);
        }
      }

      // Ajouter l'authentification si configurée et si c'est une URL CouchDB
      const isCouchDBUrl = url.includes(API_CONFIG.baseUrl);
      if (isCouchDBUrl && API_CONFIG.auth.username && API_CONFIG.auth.password) {
        headers.Authorization = `Basic ${encodeBasicAuth(API_CONFIG.auth.username, API_CONFIG.auth.password)}`;
      }

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (API_CONFIG.debug) {
        console.log(`✅ Réponse reçue de ${url}:`, data);
      }

      return { ...data, _fromServer: true };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error(`❌ Timeout: La requête a pris trop de temps`);
          throw new Error('La requête a expiré. Veuillez réessayer.');
        }
        console.error(`❌ Erreur lors de la requête:`, error.message);
        throw error;
      }
      console.error('❌ Erreur inconnue:', error);
      throw new Error('Une erreur inconnue est survenue');
    } finally {
      // Nettoyer le cache après un délai
      setTimeout(() => {
        requestCache.delete(cacheKey);
      }, 100);
    }
  })();

  requestCache.set(cacheKey, requestPromise);
  return requestPromise;
}

/**
 * Récupère tous les documents de la base de données principale
 */
export async function getData(): Promise<any> {
  const response = await fetchFromCouchDB(API_CONFIG.dataUrl);
  
  // Transformer la réponse CouchDB en format utilisable
  if (response.rows) {
    return response.rows.map((row: any) => row.doc).filter((doc: any) => doc && !doc._id.startsWith('_design/'));
  }
  
  return response;
}

/**
 * Récupère les catégories depuis la source configurée
 */
export async function getCategories(): Promise<any> {
  try {
    const response = await fetchFromCouchDB(API_CONFIG.categoriesUrl);
    
    // Si c'est un fichier JSON statique, retourner directement
    if (API_CONFIG.categories.jsonUrl && API_CONFIG.categoriesUrl === API_CONFIG.categories.jsonUrl) {
      return response;
    }
    
    // Si c'est une réponse CouchDB avec des rows
    if (response.rows) {
      return response.rows.map((row: any) => row.doc || row.value).filter((item: any) => item);
    }
    
    return response;
  } catch (error) {
    console.warn('Erreur lors du chargement des catégories:', error);
    return [];
  }
}

/**
 * Récupère les descriptions depuis la source configurée
 */
export async function getDescriptions(): Promise<any> {
  try {
    const response = await fetchFromCouchDB(API_CONFIG.descriptionsUrl);
    
    // Si c'est un fichier JSON statique, retourner directement
    if (API_CONFIG.descriptions.jsonUrl && API_CONFIG.descriptionsUrl === API_CONFIG.descriptions.jsonUrl) {
      return response;
    }
    
    // Si c'est une réponse CouchDB avec des rows
    if (response.rows) {
      return response.rows.map((row: any) => row.doc || row.value).filter((item: any) => item);
    }
    
    return response;
  } catch (error) {
    console.warn('Erreur lors du chargement des descriptions:', error);
    return [];
  }
}

/**
 * Crée un nouveau document dans la base principale
 */
export async function createDocument(doc: any): Promise<any> {
  const url = API_CONFIG.dbUrl;
  return fetchFromCouchDB(url, {
    method: 'POST',
    body: JSON.stringify(doc)
  });
}

/**
 * Met à jour un document existant
 */
export async function updateDocument(id: string, doc: any): Promise<any> {
  const url = `${API_CONFIG.dbUrl}/${id}`;
  return fetchFromCouchDB(url, {
    method: 'PUT',
    body: JSON.stringify(doc)
  });
}

/**
 * Supprime un document
 */
export async function deleteDocument(id: string, rev: string): Promise<any> {
  const url = `${API_CONFIG.dbUrl}/${id}?rev=${rev}`;
  return fetchFromCouchDB(url, {
    method: 'DELETE'
  });
}

/**
 * Récupère un document par son ID
 */
export async function getDocument(id: string): Promise<any> {
  const url = `${API_CONFIG.dbUrl}/${id}`;
  return fetchFromCouchDB(url);
}

/**
 * Récupère les données avec gestion du cache et fallback
 */
export async function getDataWithFallback(fallbackData?: any): Promise<any> {
  try {
    const data = await getData();
    
    // Sauvegarder dans le localStorage pour utilisation hors ligne
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('payslip_data_cache', JSON.stringify(data));
        localStorage.setItem('payslip_data_cache_time', Date.now().toString());
      } catch (e) {
        console.warn('Impossible de sauvegarder dans le localStorage:', e);
      }
    }
    
    return data;
  } catch (error) {
    console.warn('⚠️ Utilisation des données en cache ou de fallback');
    
    // Essayer de récupérer depuis le cache
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cachedData = localStorage.getItem('payslip_data_cache');
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          console.log('📦 Données récupérées depuis le cache local');
          return parsed;
        }
      } catch (e) {
        console.error('Erreur lors de la lecture du cache:', e);
      }
    }
    
    // Utiliser les données de fallback si fournies
    if (fallbackData) {
      console.log('📋 Utilisation des données de fallback');
      return fallbackData;
    }
    
    throw error;
  }
}

/**
 * Récupère les catégories avec gestion du cache et fallback
 */
export async function getCategoriesWithFallback(fallbackCategories?: any): Promise<any> {
  try {
    const data = await getCategories();
    
    // Sauvegarder dans le localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('categories_cache', JSON.stringify(data));
        localStorage.setItem('categories_cache_time', Date.now().toString());
      } catch (e) {
        console.warn('Impossible de sauvegarder les catégories dans le localStorage:', e);
      }
    }
    
    return data;
  } catch (error) {
    console.warn('⚠️ Utilisation des catégories en cache ou de fallback');
    
    // Essayer de récupérer depuis le cache
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cachedData = localStorage.getItem('categories_cache');
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          console.log('📦 Catégories récupérées depuis le cache local');
          return parsed;
        }
      } catch (e) {
        console.error('Erreur lors de la lecture du cache des catégories:', e);
      }
    }
    
    // Utiliser les catégories de fallback si fournies
    if (fallbackCategories) {
      console.log('📋 Utilisation des catégories de fallback');
      return fallbackCategories;
    }
    
    throw error;
  }
}

/**
 * Récupère les descriptions avec gestion du cache et fallback
 */
export async function getDescriptionsWithFallback(fallbackDescriptions?: any): Promise<any> {
  try {
    const data = await getDescriptions();
    
    // Sauvegarder dans le localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('descriptions_cache', JSON.stringify(data));
        localStorage.setItem('descriptions_cache_time', Date.now().toString());
      } catch (e) {
        console.warn('Impossible de sauvegarder les descriptions dans le localStorage:', e);
      }
    }
    
    return data;
  } catch (error) {
    console.warn('⚠️ Utilisation des descriptions en cache ou de fallback');
    
    // Essayer de récupérer depuis le cache
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cachedData = localStorage.getItem('descriptions_cache');
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          console.log('📦 Descriptions récupérées depuis le cache local');
          return parsed;
        }
      } catch (e) {
        console.error('Erreur lors de la lecture du cache des descriptions:', e);
      }
    }
    
    // Utiliser les descriptions de fallback si fournies
    if (fallbackDescriptions) {
      console.log('📋 Utilisation des descriptions de fallback');
      return fallbackDescriptions;
    }
    
    throw error;
  }
}
