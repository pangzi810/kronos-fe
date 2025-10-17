/**
 * Common API type definitions
 */

// Generic API response wrapper
export interface ApiResponse<T> {
  data: T
  message?: string
  timestamp?: string
}

// Paginated response
export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

// Pagination metadata
export interface PaginationMeta {
  currentPage: number
  pageSize: number
  totalElements: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
}

// Pagination parameters
export interface PaginationParams {
  page?: number
  size?: number
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

// Search parameters
export interface SearchParams extends PaginationParams {
  search?: string
  filters?: Record<string, any>
}

// API error response
export interface ApiError {
  message: string
  code: string
  statusCode: number
  details?: any
  errors?: Record<string, string[]>
  timestamp?: string
}

// Error response from backend
export interface ErrorResponse {
  code: string        // Error code like 'INVALID_ARGUMENT', 'AUTHENTICATION_FAILED'
  message: string     // Human-readable error message
  details?: string    // Optional detailed error information
  timestamp: string   // ISO timestamp
}

// Request options
export interface RequestOptions {
  skipErrorHandling?: boolean
  useCache?: boolean
  cacheTime?: number
  retryCount?: number
  retryDelay?: number
}

// Date range
export interface DateRange {
  startDate: string
  endDate: string
}

// Status types
export type Status = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'COMPLETED' | 'CANCELLED'

// Sort order
export type SortOrder = 'ASC' | 'DESC'