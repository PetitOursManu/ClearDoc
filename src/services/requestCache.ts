// Service singleton pour gérer le cache des requêtes
class RequestCacheService {
  private cache: Map<string, Promise<any>> = new Map();

  async fetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    // Si une requête est déjà en cours pour cette clé, retourner la promesse existante
    if (this.cache.has(key)) {
      console.log(`⏳ Requête en cache pour ${key}, réutilisation...`);
      return this.cache.get(key)!;
    }

    // Créer une nouvelle promesse et la stocker
    const promise = fetcher()
      .then(result => {
        // Supprimer du cache après succès
        this.cache.delete(key);
        return result;
      })
      .catch(error => {
        // Supprimer du cache après erreur
        this.cache.delete(key);
        throw error;
      });

    this.cache.set(key, promise);
    return promise;
  }

  clear(key?: string) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

// Instance singleton
export const requestCache = new RequestCacheService();
