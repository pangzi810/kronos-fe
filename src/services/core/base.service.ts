import type { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios'
import apiClient from './api.client'
import { apiCache, CacheKeyBuilder } from './api.cache'
import { handleApiError } from './error.handler'

/**
 * Base configuration for API services
 */
export interface ServiceConfig {
  baseURL: string
  cacheTime?: number
  defaultCacheEnabled?: boolean
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number
  size?: number
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[]
  metadata: {
    totalElements: number
    totalPages: number
    currentPage: number
    pageSize: number
    hasNext: boolean
    hasPrevious: boolean
  }
}

/**
 * Base API Service class
 * Provides common functionality for all domain services
 */
export abstract class BaseApiService {
  protected readonly api: AxiosInstance
  protected readonly baseURL: string
  protected readonly cacheTime: number
  protected readonly defaultCacheEnabled: boolean

  constructor(config: ServiceConfig) {
    this.api = apiClient
    this.baseURL = config.baseURL
    this.cacheTime = config.cacheTime ?? 5 * 60 * 1000 // 5 minutes default
    this.defaultCacheEnabled = config.defaultCacheEnabled ?? true
  }

  /**
   * Perform GET request with caching
   */
  protected async get<T>(
    path: string,
    config?: AxiosRequestConfig,
    cacheKey?: string,
    useCache?: boolean
  ): Promise<T> {
    const shouldUseCache = useCache ?? this.defaultCacheEnabled

    try {
      // Check cache if enabled
      if (shouldUseCache && cacheKey) {
        const cached = apiCache.get<T>(cacheKey)
        if (cached) return cached
      }

      // Make API request
      const { data } = await this.api.get<T>(
        `${this.baseURL}${path}`,
        config
      )

      // Cache result if enabled
      if (shouldUseCache && cacheKey) {
        apiCache.set(cacheKey, data, this.cacheTime)
      }

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Perform POST request
   */
  protected async post<T, D = any>(
    path: string,
    data?: D,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      const response = await this.api.post<T>(
        `${this.baseURL}${path}`,
        data,
        config
      )
      return response.data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Perform PUT request
   */
  protected async put<T, D = any>(
    path: string,
    data?: D,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      const response = await this.api.put<T>(
        `${this.baseURL}${path}`,
        data,
        config
      )
      return response.data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Perform DELETE request
   */
  protected async delete<T = void>(
    path: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      const response = await this.api.delete<T>(
        `${this.baseURL}${path}`,
        config
      )
      return response.data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Perform PATCH request
   */
  protected async patch<T, D = any>(
    path: string,
    data?: D,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      const response = await this.api.patch<T>(
        `${this.baseURL}${path}`,
        data,
        config
      )
      return response.data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Build query string from parameters
   */
  protected buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams()
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, String(v)))
        } else {
          searchParams.append(key, String(value))
        }
      }
    })
    
    const queryString = searchParams.toString()
    return queryString ? `?${queryString}` : ''
  }

  /**
   * Invalidate cache for this service
   */
  protected invalidateCache(pattern?: string | RegExp): void {
    if (pattern) {
      apiCache.invalidate(pattern)
    } else {
      // Invalidate all caches for this service
      apiCache.invalidate(new RegExp(`^${this.baseURL.replace('/', '')}`))
    }
  }

  /**
   * Build cache key
   */
  protected buildCacheKey(prefix: string, params?: Record<string, any>): string {
    const builder = new CacheKeyBuilder(prefix)
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          builder.add(key, value)
        }
      })
    }
    
    return builder.build()
  }
}

/**
 * Base CRUD service with standard operations
 */
export abstract class CrudApiService<
  T,
  CreateRequest,
  UpdateRequest = Partial<CreateRequest>
> extends BaseApiService {
  
  /**
   * Get all resources
   */
  async getAll(useCache = true): Promise<T[]> {
    const cacheKey = this.buildCacheKey(`${this.baseURL}:all`)
    return this.get<T[]>('', undefined, cacheKey, useCache)
  }

  /**
   * Get resource by ID
   */
  async getById(id: string, useCache = true): Promise<T> {
    const cacheKey = this.buildCacheKey(`${this.baseURL}:${id}`)
    return this.get<T>(`/${id}`, undefined, cacheKey, useCache)
  }

  /**
   * Create new resource
   */
  async create(data: CreateRequest): Promise<T> {
    const result = await this.post<T>('', data)
    this.invalidateCache()
    return result
  }

  /**
   * Update existing resource
   */
  async update(id: string, data: UpdateRequest): Promise<T> {
    const result = await this.put<T>(`/${id}`, data)
    this.invalidateCache()
    return result
  }

  /**
   * Delete resource
   */
  async remove(id: string): Promise<void> {
    await this.delete(`/${id}`)
    this.invalidateCache()
  }
}

/**
 * Base service with pagination support
 */
export abstract class PaginatedApiService<
  T,
  CreateRequest,
  UpdateRequest = Partial<CreateRequest>
> extends CrudApiService<T, CreateRequest, UpdateRequest> {
  
  /**
   * Get paginated resources
   */
  async getPaginated(
    params?: PaginationParams,
    additionalParams?: Record<string, any>,
    useCache = true
  ): Promise<PaginatedResponse<T>> {
    const allParams = { ...params, ...additionalParams }
    const cacheKey = this.buildCacheKey(`${this.baseURL}:paginated`, allParams)
    const queryString = this.buildQueryString(allParams)
    
    return this.get<PaginatedResponse<T>>(
      queryString,
      undefined,
      cacheKey,
      useCache
    )
  }
}