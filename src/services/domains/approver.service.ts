import apiClient from '../core/api.client'
import { apiCache } from '../core/api.cache'
import { handleApiError } from '../core/error.handler'
import type { Approver } from '../types/user.types'
import type { AxiosError } from 'axios'

/**
 * Approver Management Service
 * Handles all approver related API calls
 */
class ApproverService {
  private readonly baseURL = '/approver'
  private readonly cacheTime = 5 * 60 * 1000 // 5 minutes

  /**
   * 自分の承認者一覧取得 (getMyApprovers)
   * GET /api/approver/approvers
   */
  async getMyApprovers(useCache = true): Promise<Approver[]> {
    const cacheKey = 'approvers:my'

    try {
      // Check cache
      if (useCache) {
        const cached = apiCache.get<Approver[]>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get<Approver[]>(`${this.baseURL}/approvers`)

      // Cache result
      apiCache.set(cacheKey, data, this.cacheTime)

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Clear all approver-related caches
   */
  clearAllCaches(): void {
    apiCache.invalidate(/^approvers:/)
  }
}

// Export singleton instance
export const approverService = new ApproverService()
export default approverService