/**
 * Service de cache pour les requêtes API
 * Évite les requêtes multiples simultanées
 */

interface CacheEntry<T> {
  promise: Promise<T>;
  timestamp: number;
}

class RequestCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Exécute une requête avec mise en cache
   * @param key Clé unique pour la requête
   * @param fetcher Fonction qui exécute la requête
   * @returns Promise avec le résultat
   */
  async fetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);

    // Vérifier si on a une requête en cours ou un cache valide
    if (cached && (now - cached.timestamp) < this.TTL) {
      console.log(`♻️ Utilisation du cache pour: ${key}`);
      return cached.promise;
    }

    // Créer une nouvelle requête
    console.log(`🔄 Nouvelle requête pour: ${key}`);
    const promise = fetcher();

    // Stocker dans le cache
    this.cache.set(key, {
      promise,
      timestamp: now
    });

    // Nettoyer le cache en cas d'erreur
    promise.catch(() => {
      this.cache.delete(key);
    });

    return promise;
  }

  /**
   * Vide le cache pour une clé spécifique
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    console.log(`🗑️ Cache invalidé pour: ${key}`);
  }

  /**
   * Vide tout le cache
   */
  clear(): void {
    this.cache.clear();
    console.log('🗑️ Cache entièrement vidé');
  }

  /**
   * Nettoie les entrées expirées du cache
   */
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.TTL) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 ${cleaned} entrées expirées supprimées du cache`);
    }
  }
}

export const requestCache = new RequestCache();

// Nettoyer le cache périodiquement
if (typeof window !== 'undefined') {
  setInterval(() => {
    requestCache.cleanup();
  }, 10 * 60 * 1000); // Toutes les 10 minutes
}
