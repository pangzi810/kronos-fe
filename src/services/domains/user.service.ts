import apiClient from '../core/api.client'
import { apiCache, CacheKeyBuilder } from '../core/api.cache'
import { handleApiError } from '../core/error.handler'
import type {
  User,
  UserSearchParams,
  UserListResponse
} from '../types/user.types'
import { type AxiosError } from 'axios'

/**
 * User Management Service
 * Handles all user related API calls
 */
class UserService {
  private readonly baseURL = '/users'
  private readonly cacheTime = 5 * 60 * 1000 // 5 minutes


  /**
   * Get paginated users with search and filters
   */
  async getPaginated(params: UserSearchParams = {}): Promise<UserListResponse> {
    const cacheKey = new CacheKeyBuilder('users:paginated')
      .addParams(params)
      .build()

    try {
      // Check cache for GET requests
      if (!params.search) {
        const cached = apiCache.get<UserListResponse>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get<UserListResponse>(this.baseURL, {
        params
      })

      // Cache result (only if not searching)
      if (!params.search) {
        apiCache.set(cacheKey, data, this.cacheTime)
      }

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get user by ID
   */
  async getById(id: string, useCache = true): Promise<User> {
    const cacheKey = `user:${id}`

    try {
      // Check cache
      if (useCache) {
        const cached = apiCache.get<User>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get<User>(`${this.baseURL}/${id}`)

      // Cache result
      apiCache.set(cacheKey, data, this.cacheTime)

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }










  /**
   * Get all active users
   */
  async getActiveUsers(useCache = true): Promise<User[]> {
    const cacheKey = 'users:active'

    try {
      // Check cache
      if (useCache) {
        const cached = apiCache.get<User[]>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get<User[]>(`${this.baseURL}/active`)

      // Cache result
      apiCache.set(cacheKey, data, this.cacheTime)

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get all developers
   */
  async getDevelopers(useCache = true): Promise<User[]> {
    const cacheKey = 'users:developers'

    try {
      // Check cache
      if (useCache) {
        const cached = apiCache.get<User[]>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get<User[]>(`${this.baseURL}/developers`)

      // Cache result
      apiCache.set(cacheKey, data, this.cacheTime)

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Convenience method for backward compatibility
   */
  async getUsersWithPagination(params?: UserSearchParams): Promise<UserListResponse> {
    return this.getPaginated(params)
  }

}

// Export singleton instance
export const userService = new UserService()
export default userService