import { LRUCache } from 'lru-cache';
import crypto from 'crypto';
import { CacheOptions, CacheableRequest } from './types.js';

export class CacheModule {
  private cache?: LRUCache<string, any>;
  private readonly enabled: boolean;

  constructor(options: CacheOptions) {
    this.enabled = options.enabled;
    
    if (this.enabled) {
      this.cache = new LRUCache<string, any>({
        max: options.maxSize,
        ttl: options.ttl * 1000, // Convert seconds to milliseconds
        updateAgeOnGet: false,
        updateAgeOnHas: false,
      });
    }
  }

  get<T>(key: string): T | null {
    if (!this.enabled || !this.cache) {
      return null;
    }
    
    return this.cache.get(key) as T | null;
  }

  set<T>(key: string, value: T, ttl?: number): void {
    if (!this.enabled || !this.cache) {
      return;
    }
    
    if (ttl !== undefined) {
      this.cache.set(key, value, { ttl: ttl * 1000 });
    } else {
      this.cache.set(key, value);
    }
  }

  delete(key: string): void {
    if (!this.enabled || !this.cache) {
      return;
    }
    
    this.cache.delete(key);
  }

  clear(): void {
    if (!this.enabled || !this.cache) {
      return;
    }
    
    this.cache.clear();
  }

  has(key: string): boolean {
    if (!this.enabled || !this.cache) {
      return false;
    }
    
    return this.cache.has(key);
  }

  shouldCache(request: CacheableRequest): boolean {
    if (!this.enabled) {
      return false;
    }
    
    // Only cache read operations
    const readMethods = ['list', 'get', 'search', 'find'];
    return readMethods.some(method => request.method.toLowerCase().includes(method));
  }

  getCacheKey(request: CacheableRequest): string {
    const data = JSON.stringify({
      tool: request.tool,
      method: request.method,
      params: request.params,
    });
    
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  getStats(): { hits: number; misses: number; size: number } | null {
    if (!this.enabled || !this.cache) {
      return null;
    }
    
    return {
      hits: 0, // LRUCache doesn't track hits/misses by default
      misses: 0,
      size: this.cache.size,
    };
  }
}