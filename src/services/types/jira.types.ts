/**
 * JIRA integration type definitions
 */

import type { PaginationParams } from './common.types'

// JIRA Configuration
export interface JiraConnectionConfig {
  serverUrl: string
  username: string
  apiToken: string
  projectKey?: string
  testConnection: boolean
}

export interface JiraConnectionStatus {
  success: boolean
  testedAt: string
  error?: string
}

// JQL Query Management
export interface JqlQuery {
  id: string
  queryName: string
  jqlExpression: string
  templateId?: string
  active: boolean  // API response uses 'active' instead of 'isActive'
  priority: number
  createdBy: string
  createdAt: string
  updatedAt: string
  updatedBy?: string
}

export interface JqlQueryCreateRequest {
  queryName: string
  jqlExpression: string
  templateId?: string
  isActive?: boolean  // Request still uses 'isActive'
  priority?: number
}

export interface JqlQueryUpdateRequest {
  queryName?: string
  jqlExpression?: string
  templateId?: string
  isActive?: boolean  // Request still uses 'isActive'
  priority?: number
}

export interface JqlValidationResult {
  valid: boolean
  matchingProjectCount: number
  errorMessage?: string
}

// Response Template Management
export interface ResponseTemplate {
  id: string
  templateName: string
  velocityTemplate: string
  templateDescription?: string
  createdAt: string
  updatedAt: string
  // Only properties that backend actually provides
}

export interface ResponseTemplateCreateRequest {
  templateName: string
  velocityTemplate: string
  templateDescription?: string
}

export interface ResponseTemplateUpdateRequest {
  templateName?: string
  velocityTemplate?: string
  templateDescription?: string
}

export interface TemplateTestRequest {
  testData: string
}

export interface TemplateTestResult {
  success: boolean
  result: string | null
  errorMessage: string | null
  executionTimeMs: number
}

// Sync Operations
export type SyncType = 'SCHEDULED' | 'MANUAL' | 'INITIAL'
export type SyncStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'

export interface SyncHistory {
  id: string
  syncType: SyncType
  syncStatus: SyncStatus
  startedAt: string
  completedAt?: string
  duration?: number // in milliseconds
  queriesProcessed: number
  projectsCreated: number
  projectsUpdated: number
  projectsSkipped: number
  errorCount: number
  triggeredBy?: string
  notes?: string
}

// Backend response types matching SyncHistoryResponse structure
export interface SyncHistorySummary {
  syncHistoryId: string
  syncType: SyncType
  syncStatus: SyncStatus
  startedAt: string
  completedAt?: string
  totalProjectsProcessed?: number
  successCount?: number
  errorCount?: number
  errorDetails?: string
  triggeredBy?: string
  durationMinutes: number
  successRate: number
}

export interface SyncHistoryResponse {
  syncHistories: SyncHistorySummary[]
  currentPage: number
  pageSize: number
  totalRecords: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
  hasInProgress: boolean
  filterStartDate?: string
  filterEndDate?: string
}

export interface SyncHistoryDetailResponse {
  syncHistoryId: string
  syncType: SyncType
  syncStatus: SyncStatus
  startedAt: string
  completedAt?: string
  totalProjectsProcessed?: number
  successCount?: number
  errorCount?: number
  errorDetails?: string
  triggeredBy?: string
  durationMinutes: number
  successRate: number
  details: SyncHistoryDetail[]
}

export interface SyncHistoryDetail {
  detailId: string
  seq: number
  operation: string
  status: 'SUCCESS' | 'ERROR'
  result: string
  processedAt: string
  processingTimeMs: number
}

export interface SyncProgress {
  syncId: string
  status: SyncStatus
  currentStep: string
  totalQueries: number
  processedQueries: number
  progressPercentage: number
  estimatedRemainingTime?: number // in milliseconds
  startedAt: string
  lastUpdated: string
}

export interface ManualSyncRequest {
  queryIds?: string[] // If not provided, all active queries will be executed
  priority?: 'HIGH' | 'NORMAL' | 'LOW'
  notes?: string
}

export interface ManualSyncResponse {
  syncId: string
  status: SyncStatus
  estimatedDuration?: number
  queriesScheduled: number
  message: string
}

export interface JiraSyncStatusResponse {
  isRunning: boolean
  currentSyncId?: string
  syncType?: string
  startedAt?: string
  executedBy?: string
  lastCompletedSync?: LastCompletedSyncInfo
  nextScheduledSync?: string
}

export interface LastCompletedSyncInfo {
  syncId: string
  syncType: string
  completedAt: string
  status: string
  processedCount?: number
  errorMessage?: string
  executedBy?: string
}

// Search and filter types
export interface JqlQuerySearchParams extends PaginationParams {
  search?: string
  isActive?: boolean
  templateId?: string
  createdBy?: string
  lastExecutedFrom?: string
  lastExecutedTo?: string
}

export interface ResponseTemplateSearchParams extends PaginationParams {
  search?: string
}

export interface SyncHistorySearchParams extends PaginationParams {
  syncType?: SyncType
  status?: SyncStatus
  startedFrom?: string
  startedTo?: string
  triggeredBy?: string
  minDuration?: number
  maxDuration?: number
}

// Statistics and monitoring
export interface QueryExecutionStats {
  queryId: string
  queryName: string
  executionCount: number
  averageExecutionTime: number // in milliseconds
  lastExecution?: string
  successRate: number // percentage
  averageResultCount: number
  totalProjectsCreated: number
  totalProjectsUpdated: number
}

// JIRA API entities (read-only representations)
export interface JiraProject {
  id: string
  key: string
  name: string
  description?: string
  projectTypeKey: string
  lead?: JiraUser
  components: JiraComponent[]
  versions: JiraVersion[]
  issueTypes: JiraIssueType[]
}

export interface JiraUser {
  accountId: string
  displayName: string
  emailAddress?: string
  active: boolean
  timeZone?: string
}

export interface JiraComponent {
  id: string
  name: string
  description?: string
  lead?: JiraUser
}

export interface JiraVersion {
  id: string
  name: string
  description?: string
  archived: boolean
  released: boolean
  releaseDate?: string
}

export interface JiraIssueType {
  id: string
  name: string
  description?: string
  iconUrl?: string
  subtask: boolean
}

export interface JiraIssue {
  id: string
  key: string
  summary: string
  description?: string
  status: JiraStatus
  priority: JiraPriority
  issueType: JiraIssueType
  project: JiraProject
  assignee?: JiraUser
  reporter: JiraUser
  created: string
  updated: string
  resolutionDate?: string
  components: JiraComponent[]
  fixVersions: JiraVersion[]
}

export interface JiraStatus {
  id: string
  name: string
  description?: string
  categoryId: string
  categoryName: string
}

export interface JiraPriority {
  id: string
  name: string
  description?: string
  iconUrl?: string
}

// Error types specific to JIRA integration
export interface JiraApiError {
  code: string
  message: string
  details?: string
  statusCode: number
  timestamp: string
}

export interface JiraConnectionError extends JiraApiError {
  connectionDetails: {
    serverUrl: string
    username: string
    testConnectionFailed: boolean
    lastSuccessfulConnection?: string
  }
}

export interface JqlExecutionError extends JiraApiError {
  queryDetails: {
    queryId: string
    queryName: string
    jqlExpression: string
    executionAttempt: number
  }
}

export interface TemplateRenderError extends JiraApiError {
  templateDetails: {
    templateId: string
    templateName: string
    templateContent: string
    renderContext?: Record<string, any>
  }
}