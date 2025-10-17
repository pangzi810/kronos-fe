import apiClient from '../core/api.client'
import { apiCache, CacheKeyBuilder } from '../core/api.cache'
import { handleApiError } from '../core/error.handler'
import type {
  JiraConnectionConfig,
  JiraConnectionStatus,
  JqlQuery,
  JqlQueryCreateRequest,
  JqlQueryUpdateRequest,
  JqlQuerySearchParams,
  JqlValidationResult,
  ResponseTemplate,
  ResponseTemplateCreateRequest,
  ResponseTemplateUpdateRequest,
  ResponseTemplateSearchParams,
  TemplateTestRequest,
  TemplateTestResult,
  QueryExecutionStats,
  JiraProject,
  JiraIssue
} from '../types/jira.types'
import { type AxiosError } from 'axios'

/**
 * JIRA Integration Service
 * Handles JIRA connection, JQL query management, and response template operations
 */
class JiraService {
  private readonly baseURL = '/jira'
  private readonly cacheTime = 5 * 60 * 1000 // 5 minutes

  // Connection Management

  /**
   * Get JIRA connection status
   */
  async getConnectionStatus(useCache = true): Promise<JiraConnectionStatus> {
    const cacheKey = 'jira:connection:status'

    try {
      // Check cache
      if (useCache) {
        const cached = apiCache.get<JiraConnectionStatus>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.post<JiraConnectionStatus>(
        `${this.baseURL}/connection/test`
      )
      // Cache result (shorter TTL for connection status)
      apiCache.set(cacheKey, data, 60 * 1000) // 1 minute
      
      console.log("getConnectionStatus: ", data)
      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get JIRA connection configuration
   */
  async getConnectionConfig(useCache = true): Promise<any> {
    const cacheKey = 'jira:connection:config'

    try {
      // Check cache
      if (useCache) {
        const cached = apiCache.get<any>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API - same endpoint but different interpretation
      const { data } = await apiClient.get<any>(
        `${this.baseURL}/connection`
      )

      // Cache result
      apiCache.set(cacheKey, data, 60 * 1000) // 1 minute

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Test JIRA connection with provided configuration
   */
  async testConnection(config: JiraConnectionConfig): Promise<JiraConnectionStatus> {
    try {
      const { data } = await apiClient.post<JiraConnectionStatus>(
        `${this.baseURL}/connection/test`,
        config
      )

      // Clear connection status cache on successful test
      apiCache.delete('jira:connection:status')

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Update JIRA connection configuration
   */
  async updateConnectionConfig(config: JiraConnectionConfig): Promise<JiraConnectionStatus> {
    try {
      const { data } = await apiClient.put<JiraConnectionStatus>(
        `${this.baseURL}/connection`,
        config
      )

      // Clear connection-related caches
      this.invalidateConnectionCaches()

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  // JQL Query Management

  /**
   * Get all JQL queries
   */
  async getAllQueries(params?: JqlQuerySearchParams, useCache = true): Promise<JqlQuery[]> {
    const cacheKey = new CacheKeyBuilder('jira:queries:all')
      .addParams(params || {})
      .build()

    try {
      // Check cache for simple queries
      if (useCache && !params?.search) {
        const cached = apiCache.get<JqlQuery[]>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get<JqlQuery[]>(`${this.baseURL}/queries`, {
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
   * Get active JQL queries
   */
  async getActiveQueries(useCache = true): Promise<JqlQuery[]> {
    return this.getAllQueries({ isActive: true }, useCache)
  }

  /**
   * Get JQL query by ID
   */
  async getQueryById(id: string, useCache = true): Promise<JqlQuery> {
    const cacheKey = `jira:query:${id}`

    try {
      // Check cache
      if (useCache) {
        const cached = apiCache.get<JqlQuery>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get<JqlQuery>(`${this.baseURL}/queries/${id}`)

      // Cache result
      apiCache.set(cacheKey, data, this.cacheTime)

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Create new JQL query
   */
  async createQuery(payload: JqlQueryCreateRequest): Promise<JqlQuery> {
    try {
      const { data } = await apiClient.post<JqlQuery>(
        `${this.baseURL}/queries`,
        payload
      )

      // Invalidate query list caches
      this.invalidateQueryCaches()

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Update JQL query
   */
  async updateQuery(id: string, payload: JqlQueryUpdateRequest): Promise<JqlQuery> {
    try {
      const { data } = await apiClient.put<JqlQuery>(
        `${this.baseURL}/queries/${id}`,
        payload
      )

      // Invalidate related caches
      apiCache.delete(`jira:query:${id}`)
      this.invalidateQueryCaches()

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Delete JQL query
   */
  async deleteQuery(id: string): Promise<void> {
    try {
      await apiClient.delete(`${this.baseURL}/queries/${id}`)

      // Invalidate related caches
      apiCache.delete(`jira:query:${id}`)
      this.invalidateQueryCaches()
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Validate JQL expression
   */
  async validateQuery(id: string): Promise<JqlValidationResult> {
    try {
      const { data } = await apiClient.post<JqlValidationResult>(
        `${this.baseURL}/queries/${id}/validate`
      )
      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Test JQL query execution
   */
  async testQueryExecution(id: string): Promise<JiraIssue[]> {
    try {
      const { data } = await apiClient.post<JiraIssue[]>(
        `${this.baseURL}/queries/${id}/test`
      )
      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  // Response Template Management

  /**
   * Get all response templates
   */
  async getAllTemplates(params?: ResponseTemplateSearchParams, useCache = true): Promise<ResponseTemplate[]> {
    const cacheKey = new CacheKeyBuilder('jira:templates:all')
      .addParams(params || {})
      .build()

    try {
      // Check cache for simple queries
      if (useCache && !params?.search) {
        const cached = apiCache.get<ResponseTemplate[]>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get<ResponseTemplate[]>(`${this.baseURL}/templates`, {
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
   * Get response template by ID
   */
  async getTemplateById(id: string, useCache = true): Promise<ResponseTemplate> {
    const cacheKey = `jira:template:${id}`

    try {
      // Check cache
      if (useCache) {
        const cached = apiCache.get<ResponseTemplate>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get<ResponseTemplate>(`${this.baseURL}/templates/${id}`)

      // Cache result
      apiCache.set(cacheKey, data, this.cacheTime)

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Create new response template
   */
  async createTemplate(payload: ResponseTemplateCreateRequest): Promise<ResponseTemplate> {
    try {
      const { data } = await apiClient.post<ResponseTemplate>(
        `${this.baseURL}/templates`,
        payload
      )

      // Invalidate template list caches
      this.invalidateTemplateCaches()

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Update response template
   */
  async updateTemplate(id: string, payload: ResponseTemplateUpdateRequest): Promise<ResponseTemplate> {
    try {
      const { data } = await apiClient.put<ResponseTemplate>(
        `${this.baseURL}/templates/${id}`,
        payload
      )

      // Invalidate related caches
      apiCache.delete(`jira:template:${id}`)
      this.invalidateTemplateCaches()

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Delete response template
   */
  async deleteTemplate(id: string): Promise<void> {
    try {
      await apiClient.delete(`${this.baseURL}/templates/${id}`)

      // Invalidate related caches
      apiCache.delete(`jira:template:${id}`)
      this.invalidateTemplateCaches()
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Test response template
   */
  async testTemplate(id: string, testData?: TemplateTestRequest): Promise<TemplateTestResult> {
    try {
      const { data } = await apiClient.post<TemplateTestResult>(
        `${this.baseURL}/templates/${id}/test`,
        testData
      )
      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  // Statistics and Monitoring

  /**
   * Get query execution statistics
   */
  async getQueryExecutionStats(useCache = true): Promise<QueryExecutionStats[]> {
    const cacheKey = 'jira:stats:queries'

    try {
      // Check cache
      if (useCache) {
        const cached = apiCache.get<QueryExecutionStats[]>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get<QueryExecutionStats[]>(
        `${this.baseURL}/stats/queries`
      )

      // Cache result (shorter TTL for stats)
      apiCache.set(cacheKey, data, 2 * 60 * 1000) // 2 minutes

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get JIRA projects (for reference)
   */
  async getJiraProjects(useCache = true): Promise<JiraProject[]> {
    const cacheKey = 'jira:projects'

    try {
      // Check cache
      if (useCache) {
        const cached = apiCache.get<JiraProject[]>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get<JiraProject[]>(
        `${this.baseURL}/projects`
      )

      // Cache result
      apiCache.set(cacheKey, data, this.cacheTime)

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Search queries
   */
  async searchQueries(query: string): Promise<JqlQuery[]> {
    try {
      const { data } = await apiClient.get<JqlQuery[]>(
        `${this.baseURL}/queries/search?q=${encodeURIComponent(query)}`
      )
      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Search templates
   */
  async searchTemplates(query: string): Promise<ResponseTemplate[]> {
    try {
      const { data } = await apiClient.get<ResponseTemplate[]>(
        `${this.baseURL}/templates/search?q=${encodeURIComponent(query)}`
      )
      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  // Cache Management

  /**
   * Invalidate connection-related caches
   */
  private invalidateConnectionCaches(): void {
    apiCache.invalidate(/^jira:connection:/)
    apiCache.invalidate(/^jira:stats:/)
    apiCache.invalidate(/^jira:projects$/)
  }

  /**
   * Invalidate query-related caches
   */
  private invalidateQueryCaches(): void {
    apiCache.invalidate(/^jira:queries:/)
    apiCache.invalidate(/^jira:stats:/)
  }

  /**
   * Invalidate template-related caches
   */
  private invalidateTemplateCaches(): void {
    apiCache.invalidate(/^jira:templates:/)
    apiCache.invalidate(/^jira:stats:/)
  }

  /**
   * Clear all JIRA-related caches
   */
  clearAllCaches(): void {
    apiCache.invalidate(/^jira:/)
  }
}

// Export singleton instance
export const jiraService = new JiraService()
export default jiraService