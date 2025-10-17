import { ref, computed, type Ref } from 'vue'
import { approvalService } from '@/services'
import { useUtils } from './useUtils'
import { useErrorNotification } from './useErrorNotification'
import { useAuthStore } from "@/stores/auth"
import { getApprovalStatusColor, getApprovalStatusText } from '@/services/types'

import type {
  AggregatedApproval,
  DailyApprovalRequest,
  ApprovalResult
} from '@/services'

export interface UseApprovalOptions {
  autoLoad?: boolean
  useCache?: boolean
}

export interface ApprovalState {
  pendingApprovals: Ref<AggregatedApproval[]>
  aggregatedApprovals: Ref<AggregatedApproval[]>
  selectedApprovals: Ref<AggregatedApproval[]>
  loading: Ref<boolean>
  error: Ref<Error | null>
}

export interface ApprovalActions {
  // Fetch Operations
  fetchPendingApprovals: () => Promise<void>
  fetchAggregatedApprovals: (startDate: string, endDate: string, status?: string) => Promise<void>
  
  // Approval Operations
  approveDaily: (request: DailyApprovalRequest) => Promise<ApprovalResult>
  rejectDaily: (request: DailyApprovalRequest) => Promise<ApprovalResult>
  batchApprove: (approvals: AggregatedApproval[]) => Promise<ApprovalResult[]>
  batchReject: (approvals: AggregatedApproval[], reason: string) => Promise<ApprovalResult[]>
  
  // Statistics
  getApprovalStatistics: (month?: string) => Promise<any>
  
  // Selection Management
  selectApproval: (approval: AggregatedApproval) => void
  unselectApproval: (approval: AggregatedApproval) => void
  selectAll: () => void
  clearSelection: () => void
  toggleSelection: (approval: AggregatedApproval) => void
  
  // Utilities
  refreshAll: () => Promise<void>
  clearCache: () => void
}

export interface ApprovalFilters {
  filterByStatus: (status: string) => AggregatedApproval[]
  filterByUser: (userId: string) => AggregatedApproval[]
  filterByDateRange: (startDate: string, endDate: string) => AggregatedApproval[]
  filterByProject: (projectId: string) => AggregatedApproval[]
}

export interface ApprovalComputed {
  pendingCount: Ref<number>
  approvedCount: Ref<number>
  rejectedCount: Ref<number>
  totalPendingHours: Ref<number>
  selectedCount: Ref<number>
  hasSelection: Ref<boolean>
  allSelected: Ref<boolean>
  statistics: Ref<{
    pending: number
    approved: number
    rejected: number
    total: number
  }>
}

export function useApproval(options: UseApprovalOptions = {}) {
  const {
    autoLoad = false,
    useCache = false
  } = options

  // Get shared utilities
  const { formatDate } = useUtils()
  const errorNotification = useErrorNotification()
  const authState = useAuthStore()

  // State
  const pendingApprovals = ref<AggregatedApproval[]>([])
  const aggregatedApprovals = ref<AggregatedApproval[]>([])
  const selectedApprovals = ref<AggregatedApproval[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)
  
  // Private state
  const statisticsCache = ref<any>(null)

  // Computed Properties
  const pendingCount = computed(() => 
    pendingApprovals.value.length
  )

  const approvedCount = computed(() => 
    aggregatedApprovals.value.filter(a => a.approvalStatus === 'APPROVED').length
  )

  const rejectedCount = computed(() => 
    aggregatedApprovals.value.filter(a => a.approvalStatus === 'REJECTED').length
  )

  const totalPendingHours = computed(() => 
    pendingApprovals.value.reduce((sum, approval) => sum + approval.totalHours, 0)
  )

  const selectedCount = computed(() => 
    selectedApprovals.value.length
  )

  const hasSelection = computed(() => 
    selectedApprovals.value.length > 0
  )

  const allSelected = computed(() => 
    pendingApprovals.value.length > 0 && 
    selectedApprovals.value.length === pendingApprovals.value.length
  )

  const statistics = computed(() => ({
    pending: pendingCount.value,
    approved: approvedCount.value,
    rejected: rejectedCount.value,
    total: aggregatedApprovals.value.length
  }))

  // Fetch Operations
  async function fetchPendingApprovals() {
    // Skip API calls if user is not authenticated
    if (!authState.isAuthenticated) {
      pendingApprovals.value = []
      return
    }

    loading.value = true
    error.value = null
    
    try {
      const data = await approvalService.getPendingApprovals(useCache)
      pendingApprovals.value = data
    } catch (err) {
      error.value = err as Error
      
      errorNotification.showErrorNotification(err as Error)
      console.error('Failed to fetch pending approvals:', err)
      pendingApprovals.value = []
    } finally {
      loading.value = false
    }
  }

  async function fetchAggregatedApprovals(
    startDate: string,
    endDate: string,
    status?: string
  ) {
    loading.value = true
    error.value = null
    
    try {
      const data = await approvalService.getAggregatedApprovals(
        startDate,
        endDate,
        status as any,
        useCache
      )
      aggregatedApprovals.value = data
    } catch (err) {
      error.value = err as Error
      console.error('Failed to fetch aggregated approvals:', err)
      aggregatedApprovals.value = []
    } finally {
      loading.value = false
    }
  }

  // Approval Operations
  async function approveDaily(request: DailyApprovalRequest): Promise<ApprovalResult> {
    loading.value = true
    error.value = null
    
    try {
      const result = await approvalService.approveDailyWorkRecords(request)
      
      // Refresh pending approvals after approval
      await fetchPendingApprovals()
      
      return result
    } catch (err) {
      error.value = err as Error
      console.error('Failed to approve daily work records:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function rejectDaily(request: DailyApprovalRequest): Promise<ApprovalResult> {
    loading.value = true
    error.value = null
    
    try {
      const result = await approvalService.rejectDailyWorkRecords(request)
      
      // Refresh pending approvals after rejection
      await fetchPendingApprovals()
      
      return result
    } catch (err) {
      error.value = err as Error
      console.error('Failed to reject daily work records:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function batchApprove(approvals: AggregatedApproval[]): Promise<ApprovalResult[]> {
    loading.value = true
    error.value = null
    
    try {
      const requests = approvals.map(approval => ({
        userId: approval.userId,
        workDate: approval.workDate
      }))
      
      const results = await approvalService.batchApprove({ requests })
      
      // Clear selection and refresh
      clearSelection()
      await fetchPendingApprovals()
      
      return results
    } catch (err) {
      error.value = err as Error
      console.error('Failed to batch approve:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function batchReject(
    approvals: AggregatedApproval[],
    reason: string
  ): Promise<ApprovalResult[]> {
    loading.value = true
    error.value = null
    
    try {
      const requests = approvals.map(approval => ({
        userId: approval.userId,
        workDate: approval.workDate
      }))
      
      const results = await approvalService.batchReject({ 
        requests, 
        reason 
      })
      
      // Clear selection and refresh
      clearSelection()
      await fetchPendingApprovals()
      
      return results
    } catch (err) {
      error.value = err as Error
      console.error('Failed to batch reject:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Statistics
  async function getApprovalStatistics(month?: string) {
    loading.value = true
    error.value = null
    
    try {
      const data = await approvalService.getApprovalStatistics(month, useCache)
      statisticsCache.value = data
      return data
    } catch (err) {
      error.value = err as Error
      console.error('Failed to get approval statistics:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Selection Management
  function selectApproval(approval: AggregatedApproval) {
    const index = selectedApprovals.value.findIndex(
      a => a.userId === approval.userId && a.workDate === approval.workDate
    )
    
    if (index === -1) {
      selectedApprovals.value.push(approval)
    }
  }

  function unselectApproval(approval: AggregatedApproval) {
    const index = selectedApprovals.value.findIndex(
      a => a.userId === approval.userId && a.workDate === approval.workDate
    )
    
    if (index !== -1) {
      selectedApprovals.value.splice(index, 1)
    }
  }

  function selectAll() {
    selectedApprovals.value = [...pendingApprovals.value]
  }

  function clearSelection() {
    selectedApprovals.value = []
  }

  function toggleSelection(approval: AggregatedApproval) {
    const index = selectedApprovals.value.findIndex(
      a => a.userId === approval.userId && a.workDate === approval.workDate
    )
    
    if (index === -1) {
      selectApproval(approval)
    } else {
      unselectApproval(approval)
    }
  }

  // Filter Functions
  function filterByStatus(status: string): AggregatedApproval[] {
    return aggregatedApprovals.value.filter(a => a.approvalStatus === status)
  }

  function filterByUser(userId: string): AggregatedApproval[] {
    return aggregatedApprovals.value.filter(a => a.userId === userId)
  }

  function filterByDateRange(startDate: string, endDate: string): AggregatedApproval[] {
    return aggregatedApprovals.value.filter(a => {
      const workDate = new Date(a.workDate)
      const start = new Date(startDate)
      const end = new Date(endDate)
      return workDate >= start && workDate <= end
    })
  }

  function filterByProject(projectId: string): AggregatedApproval[] {
    return aggregatedApprovals.value.filter(a => 
      a.projectBreakdowns.some(pb => pb.projectId === projectId)
    )
  }

  // Utilities
  async function refreshAll() {
    await Promise.all([
      fetchPendingApprovals(),
      statisticsCache.value && getApprovalStatistics()
    ].filter(Boolean))
  }

  function clearCache() {
    statisticsCache.value = null
    // Force reload without cache
    fetchPendingApprovals()
  }

  // Calculate totals for selected items
  function calculateSelectedTotals() {
    return selectedApprovals.value.reduce((acc, approval) => {
      acc.totalHours += approval.totalHours
      acc.count += 1
      
      // Aggregate by user
      if (!acc.byUser[approval.userId]) {
        acc.byUser[approval.userId] = {
          userName: approval.userName || approval.user?.fullName || 'Unknown',
          totalHours: 0,
          count: 0
        }
      }
      acc.byUser[approval.userId].totalHours += approval.totalHours
      acc.byUser[approval.userId].count += 1
      
      return acc
    }, {
      totalHours: 0,
      count: 0,
      byUser: {} as Record<string, { userName: string; totalHours: number; count: number }>
    })
  }


  // Auto-load on mount if specified
  if (autoLoad) {
    fetchPendingApprovals()
  }

  return {
    // State
    pendingApprovals,
    aggregatedApprovals,
    selectedApprovals,
    loading,
    error,
    
    // Computed
    pendingCount,
    approvedCount,
    rejectedCount,
    totalPendingHours,
    selectedCount,
    hasSelection,
    allSelected,
    statistics,
    
    // Actions
    fetchPendingApprovals,
    fetchAggregatedApprovals,
    approveDaily,
    rejectDaily,
    batchApprove,
    batchReject,
    getApprovalStatistics,
    
    // Selection Management
    selectApproval,
    unselectApproval,
    selectAll,
    clearSelection,
    toggleSelection,
    
    // Filters
    filterByStatus,
    filterByUser,
    filterByDateRange,
    filterByProject,
    
    // Utilities
    refreshAll,
    clearCache,
    calculateSelectedTotals,
    getApprovalStatusText,
    getApprovalStatusColor,
    formatDate
  }
}

export type UseApprovalReturn = ReturnType<typeof useApproval>