/**
 * Simple in-memory cache for API responses
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class ApiCache {
  private cache = new Map<string, CacheEntry<any>>()
  private defaultTTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Set cache entry
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    })
  }

  /**
   * Get cache entry
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if cache is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Check if cache has valid entry
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return false
    }

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  /**
   * Delete cache entry
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Invalidate cache entries matching pattern
   */
  invalidate(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' 
      ? new RegExp(pattern) 
      : pattern

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Clean expired entries
   */
  cleanup(): void {
    const now = Date.now()
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }
}

// Create singleton instance
export const apiCache = new ApiCache()

// Auto cleanup every 10 minutes
setInterval(() => {
  apiCache.cleanup()
}, 10 * 60 * 1000)

/**
 * Cache key builder utility
 */
export class CacheKeyBuilder {
  private parts: string[] = []

  constructor(private prefix: string) {
    this.parts.push(prefix)
  }

  add(key: string, value: any): CacheKeyBuilder {
    if (value !== undefined && value !== null) {
      this.parts.push(`${key}:${value}`)
    }
    return this
  }

  addParams(params: Record<string, any>): CacheKeyBuilder {
    Object.entries(params)
      .filter(([_key, value]) => value !== undefined && value !== null)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, value]) => {
        this.parts.push(`${key}:${value}`)
      })
    return this
  }

  build(): string {
    return this.parts.join('|')
  }
}

export default apiCache