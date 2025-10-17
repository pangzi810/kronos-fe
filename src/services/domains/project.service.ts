import apiClient from '../core/api.client'
import { apiCache, CacheKeyBuilder } from '../core/api.cache'
import { handleApiError } from '../core/error.handler'
import type {
  Project,
  ProjectSearchParams,
  ProjectStatistics,
} from '../types/project.types'
import { type AxiosError } from 'axios'

/**
 * Project Management Service
 * Handles all project related API calls
 */
class ProjectService {
  
  private readonly baseURL = '/projects'
  private readonly cacheTime = 5 * 60 * 1000 // 5 minutes

  /**
   * Get all projects
   */
  async getPaginated(params?: ProjectSearchParams, useCache = true): Promise<Project[]> {
    const cacheKey = new CacheKeyBuilder('projects:all')
      .addParams(params || {})
      .build()

    try {
      // Check cache for simple queries
      if (useCache && !params?.search) {
        const cached = apiCache.get<Project[]>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get<Project[]>(this.baseURL, {
        params
      })

      // Cache result (only for non-search queries)
      if (!params?.search) {
        apiCache.set(cacheKey, data, this.cacheTime)
      }

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get active projects
   */
  async getActiveProjects(useCache = true): Promise<Project[]> {
    return this.getPaginated({ status: 'IN_PROGRESS' }, useCache)
  }

  /**
   *  Get popular projects (stub implementation)
   * @returns Popular projects (stub implementation)
   */
  async getPopularProjects(): Promise<Project[]> {
    return []
  }
  
  /**
   * Get recently work-recorded projects
   * @returns Recently work-recorded projects
   */
  async getRecentWorkRecordedProjects(): Promise<Project[]> {
    try {
      const { data } = await apiClient.get<Project[]>(
        `${this.baseURL}/recent-recorded`
      )
      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get project by ID
   */
  async getById(id: string, useCache = true): Promise<Project> {
    const cacheKey = `project:${id}`

    try {
      // Check cache
      if (useCache) {
        const cached = apiCache.get<Project>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get<Project>(`${this.baseURL}/${id}`)

      // Cache result
      apiCache.set(cacheKey, data, this.cacheTime)

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get project statistics
   */
  async getStatistics(id: string, useCache = true): Promise<ProjectStatistics> {
    const cacheKey = `project:${id}:statistics`

    try {
      // Check cache
      if (useCache) {
        const cached = apiCache.get<ProjectStatistics>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get<ProjectStatistics>(
        `${this.baseURL}/${id}/statistics`
      )

      // Cache result (shorter TTL for statistics)
      apiCache.set(cacheKey, data, 60 * 1000) // 1 minute

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Search projects
   */
  async search(query: string): Promise<Project[]> {
    try {
      const { data } = await apiClient.get<Project[]>(
        `${this.baseURL}/search?q=${encodeURIComponent(query)}`
      )
      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  
}
// Export singleton instance
export const projectService = new ProjectService()
export default projectService