import { BaseApiService } from '../core/base.service'
import { apiCache } from '../core/api.cache'
import { handleApiError } from '../core/error.handler'
import type { WorkCategory } from '../types/work-record.types'
import type { AxiosError } from 'axios'

/**
 * Work Category Service
 * Handles work category related operations
 */
class WorkCategoryService extends BaseApiService {
  constructor() {
    super({ baseURL: '/work-categories' })
  }

  /**
   * Get all work categories
   */
  async getWorkCategories(useCache = true): Promise<WorkCategory[]> {
    const cacheKey = 'work-categories:all'
    
    try {
      // Check cache
      if (useCache) {
        const cached = apiCache.get<WorkCategory[]>(cacheKey)
        if (cached) return cached
      }
      
      // Fetch from API
      const { data } = await this.api.get<WorkCategory[]>(this.baseURL)
      
      // Cache result (long TTL as categories rarely change)
      apiCache.set(cacheKey, data, 60 * 60 * 1000) // 1 hour
      
      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Invalidate work category caches
   */
  invalidateCaches(): void {
    apiCache.invalidate(/^work-categories:/)
  }
}

// Export singleton instance
export const workCategoryService = new WorkCategoryService()
export default workCategoryService