/**
 * Service Layer Exports
 * Central export point for all API services
 */

// Core utilities
export { default as apiClient } from './core/api.client'
export { apiCache, CacheKeyBuilder } from './core/api.cache'
export * from './core/error.handler'
export { 
  BaseApiService,
  CrudApiService,
  PaginatedApiService,
  type ServiceConfig
} from './core/base.service'

// Domain services
// authService removed - using okta-vue integration
export { userService } from './domains/user.service'
export { projectService } from './domains/project.service'
export { workRecordService } from './domains/work-record.service'
export { workCategoryService } from './domains/work-category.service'
export { approvalService } from './domains/approval.service'
export { jiraService } from './domains/jira.service'
export { jiraSyncService } from './domains/jira-sync.service'

// Type exports
export { 
  type ApiError,
  type ApiResponse
} from './types/common.types'
// export * from './types/auth.types' // Removed with auth service
export * from './types/user.types'
export * from './types/project.types'
export * from './types/work-record.types'
export * from './types/jira.types'

// Re-export approval types from approval service
export type { 
  AggregatedApproval,
  ProjectBreakdown,
  DailyApprovalRequest,
  BatchApprovalRequest,
  ApprovalResult
} from './domains/approval.service'

