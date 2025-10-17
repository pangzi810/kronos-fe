import apiClient from '../core/api.client'
import { apiCache, CacheKeyBuilder } from '../core/api.cache'
import { handleApiError } from '../core/error.handler'
import type {
  WorkRecordApproval,
  ApprovalRequest,
  ApprovalDecision,
  ApprovalHistory,
  ApprovalStatus
} from '../types/work-record.types'
import type { User } from '../types/user.types'
import type { Project } from '../types/project.types'
import { type AxiosError } from 'axios'

/**
 * Aggregated approval information
 */
export interface AggregatedApproval {
  userId: string
  user: User
  workDate: string
  approvalStatus: ApprovalStatus
  categoryHours: Record<string, number>
  projectBreakdowns: ProjectBreakdown[]
  rejectionReason?: string
  totalHours: number
  userName?: string
  userEmail?: string
}

/**
 * Project breakdown in approval
 */
export interface ProjectBreakdown {
  projectId: string
  project: Project
  categoryHours: Record<string, number>
  totalHours: number
  description: string
  projectName?: string
}

/**
 * Daily approval request
 */
export interface DailyApprovalRequest {
  userId: string
  workDate: string
  rejectionReason?: string
}

/**
 * Batch approval request
 */
export interface BatchApprovalRequest {
  requests: Array<{
    userId: string
    workDate: string
  }>
}

/**
 * Approval result
 */
export interface ApprovalResult {
  userId: string
  workDate: string
  approvalStatus: string
  processedAt: string
  message: string
}

/**
 * Approval Service
 * Handles work record approval workflows
 */
class ApprovalService {
  private readonly baseURL = '/approvals'
  private readonly cacheTime = 3 * 60 * 1000 // 3 minutes (shorter for approval data)

  /**
   * Get pending approvals
   */
  async getPendingApprovals(
    useCache = true
  ): Promise<AggregatedApproval[]> {
    const cacheKey = 'approval:pending'

    try {
      // Check cache (very short TTL for pending approvals)
      if (useCache) {
        const cached = apiCache.get<AggregatedApproval[]>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const url = `${this.baseURL}/pending`
      
      const { data } = await apiClient.get<AggregatedApproval[]>(url)

      // Cache result with short TTL
      apiCache.set(cacheKey, data, 60 * 1000) // 1 minute

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get aggregated approvals by date range
   */
  async getAggregatedApprovals(
    startDate: string,
    endDate: string,
    status?: ApprovalStatus,
    useCache = true
  ): Promise<AggregatedApproval[]> {
    const cacheKey = new CacheKeyBuilder('approval:aggregated')
      .add('start', startDate)
      .add('end', endDate)
      .add('status', status)
      .build()

    try {
      // Check cache
      if (useCache) {
        const cached = apiCache.get<AggregatedApproval[]>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get<AggregatedApproval[]>(
        `${this.baseURL}/aggregated`,
        {
          params: {
            startDate,
            endDate,
            status
          }
        }
      )

      // Cache result
      apiCache.set(cacheKey, data, this.cacheTime)

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Approve work records for a specific date
   */
  async approveDailyWorkRecords(request: DailyApprovalRequest): Promise<ApprovalResult> {
    try {
      const { data } = await apiClient.post<ApprovalResult>(
        `${this.baseURL}/approve`,
        request
      )

      // Invalidate approval caches
      this.invalidateApprovalCaches(request.userId)

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Reject work records for a specific date
   */
  async rejectDailyWorkRecords(request: DailyApprovalRequest): Promise<ApprovalResult> {
    try {
      const { data } = await apiClient.post<ApprovalResult>(
        `${this.baseURL}/reject/daily`,
        request
      )

      // Invalidate approval caches
      this.invalidateApprovalCaches(request.userId)

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Batch approve multiple work records
   */
  async batchApprove(request: BatchApprovalRequest): Promise<ApprovalResult[]> {
    try {
      const { data } = await apiClient.post<ApprovalResult[]>(
        `${this.baseURL}/approve-batch`,
        request
      )

      // Invalidate all approval caches
      apiCache.invalidate(/^approval:/)

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Batch reject multiple work records
   */
  async batchReject(
    request: BatchApprovalRequest & { reason: string }
  ): Promise<ApprovalResult[]> {
    try {
      const { data } = await apiClient.post<ApprovalResult[]>(
        `${this.baseURL}/reject-batch`,
        request
      )

      // Invalidate all approval caches
      apiCache.invalidate(/^approval:/)

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get approval history for a work record
   */
  async getApprovalHistory(
    workRecordId: string,
    useCache = true
  ): Promise<ApprovalHistory[]> {
    const cacheKey = `approval:history:${workRecordId}`

    try {
      // Check cache
      if (useCache) {
        const cached = apiCache.get<ApprovalHistory[]>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get<ApprovalHistory[]>(
        `${this.baseURL}/history/${workRecordId}`
      )

      // Cache result
      apiCache.set(cacheKey, data, this.cacheTime)

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get approval status for multiple dates
   */
  async getApprovalStatuses(
    userId: string,
    dates: string[],
    useCache = true
  ): Promise<Record<string, ApprovalStatus>> {
    const cacheKey = new CacheKeyBuilder(`approval:status:${userId}`)
      .add('dates', dates.join(','))
      .build()

    try {
      // Check cache
      if (useCache) {
        const cached = apiCache.get<Record<string, ApprovalStatus>>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get<Record<string, ApprovalStatus>>(
        `${this.baseURL}/status/bulk`,
        {
          params: {
            userId,
            dates
          }
        }
      )

      // Cache result (short TTL)
      apiCache.set(cacheKey, data, 60 * 1000) // 1 minute

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Cancel approval request
   */
  async cancelApprovalRequest(
    userId: string,
    workDate: string
  ): Promise<void> {
    try {
      await apiClient.delete(
        `${this.baseURL}/cancel/${userId}/${workDate}`
      )

      // Invalidate approval caches
      this.invalidateApprovalCaches(userId)
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get approval statistics for dashboard
   */
  async getApprovalStatistics(
    month?: string,
    useCache = true
  ): Promise<{
    pending: number
    approved: number
    rejected: number
    total: number
    requiresAction: number
  }> {
    const cacheKey = new CacheKeyBuilder('approval:statistics')
      .add('month', month)
      .build()

    try {
      // Check cache
      if (useCache) {
        const cached = apiCache.get<any>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get(
        `${this.baseURL}/statistics`,
        {
          params: {
            month
          }
        }
      )

      // Cache result
      apiCache.set(cacheKey, data, this.cacheTime)

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Invalidate approval-related caches
   */
  private invalidateApprovalCaches(userId?: string): void {
    // Invalidate all pending approval caches
    apiCache.invalidate(/^approval:pending/)
    
    // Invalidate aggregated caches
    apiCache.invalidate(/^approval:aggregated/)
    
    // Invalidate statistics
    apiCache.invalidate(/^approval:statistics/)
    
    // Invalidate specific user caches if provided
    if (userId) {
      apiCache.invalidate(new RegExp(`approval:.*${userId}`))
    }
  }
}

// Export singleton instance
export const approvalService = new ApprovalService()
export default approvalService