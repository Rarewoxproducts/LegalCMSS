type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

class QueryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private defaultTTL = 30000;

  async fetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);

    if (cached && now - cached.timestamp < ttl) {
      return cached.data;
    }

    const pending = this.pendingRequests.get(key);
    if (pending) {
      return pending;
    }

    const request = fetcher()
      .then((data) => {
        this.cache.set(key, { data, timestamp: Date.now() });
        this.pendingRequests.delete(key);
        return data;
      })
      .catch((error) => {
        this.pendingRequests.delete(key);
        throw error;
      });

    this.pendingRequests.set(key, request);
    return request;
  }

  invalidate(key: string) {
    this.cache.delete(key);
    this.pendingRequests.delete(key);
  }

  invalidatePattern(pattern: string) {
    const keys = Array.from(this.cache.keys());
    keys.forEach((key) => {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        this.pendingRequests.delete(key);
      }
    });
  }

  clear() {
    this.cache.clear();
    this.pendingRequests.clear();
  }
}

export const queryCache = new QueryCache();
