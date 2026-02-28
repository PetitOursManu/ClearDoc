interface CacheEntry<T> {
  promise: Promise<T>;
  timestamp: number;
}

class RequestCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  async fetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);

    if (cached && (now - cached.timestamp) < this.TTL) {
      return cached.promise;
    }

    const promise = fetcher();

    this.cache.set(key, { promise, timestamp: now });

    promise.catch(() => {
      this.cache.delete(key);
    });

    return promise;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.TTL) {
        this.cache.delete(key);
      }
    }
  }
}

export const requestCache = new RequestCache();

if (typeof window !== 'undefined') {
  setInterval(() => requestCache.cleanup(), 10 * 60 * 1000);
}
