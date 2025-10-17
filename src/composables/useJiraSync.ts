import { ref, computed, onUnmounted, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { jiraSyncService } from '../services'
import { useErrorNotification } from './useErrorNotification'
import type {
  SyncHistory,
  SyncHistoryResponse,
  SyncHistoryDetailResponse,
  SyncProgress,
  ManualSyncRequest,
  ManualSyncResponse,
  JiraSyncStatusResponse,
  SyncStatus,
  SyncHistorySearchParams
} from '../services/types/jira.types'

export interface NotificationStrategy {
  onSuccess?: (message?: string) => void
  onError?: (error: Error) => void
}

export interface UseJiraSyncOptions {
  autoLoadHistory?: boolean
  autoRefreshInterval?: number // minutes
  enablePolling?: boolean
}

export interface JiraSyncState {
  syncHistory: Ref<SyncHistoryResponse | null>
  currentProgress: Ref<SyncProgress[]>
  activeSync: Ref<SyncProgress | null>
  syncStats: Ref<{
    totalSyncs: number
    runningsyncs: number
    successfulSyncs: number
    failedSyncs: number
    averageDuration: number
    lastSyncAt?: string
  } | null>
  loading: Ref<boolean>
  error: Ref<Error | null>
  isPolling: Ref<boolean>
}

export interface JiraSyncActions {
  // Manual sync operations
  triggerSync: (request?: ManualSyncRequest) => Promise<ManualSyncResponse | null>
  cancelSync: (syncId: string) => Promise<void>
  retryFailedSync: (syncHistoryId: string, notifications?: NotificationStrategy) => Promise<ManualSyncResponse>
  
  // History management
  loadSyncHistory: (params?: SyncHistorySearchParams) => Promise<void>
  loadSyncHistoryDetails: (syncHistoryId: string) => Promise<SyncHistoryDetailResponse | null>
  refreshHistory: () => Promise<void>
  
  // Status monitoring
  loadCurrentProgress: () => Promise<void>
  startProgressPolling: (syncId?: string) => void
  stopProgressPolling: () => void
  
  // Statistics
  loadSyncStats: () => Promise<void>
  
  // Utility methods
  isAnySyncRunning: () => Promise<boolean>
  getStatusInfo: (status: SyncStatus) => { label: string; color: string; icon: string }
  formatDuration: (durationMs?: number) => string
  
  // Cache management
  refreshAll: () => Promise<void>
  clearCache: () => void
}

export interface JiraSyncHelpers {
  // Filtering
  filterHistoryByStatus: (history: SyncHistory[], status: SyncStatus) => SyncHistory[]
  filterHistoryByType: (history: SyncHistory[], type: string) => SyncHistory[]
  filterHistoryByDateRange: (history: SyncHistory[], startDate: Date, endDate: Date) => SyncHistory[]
  
  // Statistics computation
  calculateSuccessRate: (history: SyncHistory[]) => number
  getRecentHistory: (history: SyncHistory[], days: number) => SyncHistory[]
  
  // Status checking
  canTriggerManualSync: () => boolean
  canCancelSync: (progress: SyncProgress) => boolean
}

export function useJiraSync(options: UseJiraSyncOptions = {}) {
  const {
    autoLoadHistory = false,
    autoRefreshInterval = 5, // 5 minutes
    enablePolling = true
  } = options

  const { t } = useI18n()
  const errorNotification = useErrorNotification()
  
  // State
  const syncHistory = ref<SyncHistoryResponse | null>(null)
  const currentProgress = ref<SyncProgress[]>([])
  const activeSync = ref<SyncProgress | null>(null)
  const syncStats = ref<{
    totalSyncs: number
    runningsyncs: number
    successfulSyncs: number
    failedSyncs: number
    averageDuration: number
    lastSyncAt?: string
  } | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const isPolling = ref(false)
  
  // Internal state for polling management
  let pollingInterval: NodeJS.Timeout | null = null
  let refreshInterval: NodeJS.Timeout | null = null

  // Computed Properties
  const recentHistory = computed(() => 
    syncHistory.value?.syncHistories?.slice(0, 10) || []
  )

  const failedSyncs = computed(() => 
    syncHistory.value?.syncHistories?.filter(h => h.syncStatus === 'FAILED') || []
  )

  const runningSyncs = computed(() => 
    currentProgress.value.filter(p => p.status === 'IN_PROGRESS')
  )

  const completedSyncs = computed(() => 
    syncHistory.value?.syncHistories?.filter(h => h.syncStatus === 'COMPLETED') || []
  )

  const successRate = computed(() => {
    const total = syncHistory.value?.syncHistories?.length || 0
    if (total === 0) return 100
    const successful = completedSyncs.value.length
    return Math.round((successful / total) * 100)
  })

  const hasRunningSyncs = computed(() => 
    runningSyncs.value.length > 0
  )

  const latestSync = computed(() => 
    syncHistory.value?.syncHistories && syncHistory.value.syncHistories.length > 0 
      ? syncHistory.value.syncHistories[0] 
      : null
  )

  const averageSyncDuration = computed(() => {
    const completedWithDuration = completedSyncs.value.filter(s => s.durationMinutes)
    if (completedWithDuration.length === 0) return 0
    const total = completedWithDuration.reduce((sum, sync) => sum + (sync.durationMinutes || 0), 0)
    return Math.round(total / completedWithDuration.length * 60000) // Convert minutes to milliseconds
  })

  // Manual Sync Operations
  async function triggerSync(request?: ManualSyncRequest): Promise<ManualSyncResponse | null> {
    loading.value = true
    error.value = null
    
    try {
      const response = await jiraSyncService.triggerManualSync(request)
      
      // Start polling for this sync if enabled
      if (enablePolling && response.syncId) {
        startProgressPolling(response.syncId)
      }
      
      // Refresh data
      await Promise.all([
        loadCurrentProgress(),
        loadSyncStats()
      ])
      
      errorNotification.showSuccessNotification(
        t('jira.sync.trigger.success'),
        { duration: 3000 }
      )
      
      return response
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
      return null // Don't throw, return null to prevent double notification
    } finally {
      loading.value = false
    }
  }

  async function cancelSync(syncId: string): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      await jiraSyncService.cancelSync(syncId)
      
      // Remove from current progress
      currentProgress.value = currentProgress.value.filter(p => p.syncId !== syncId)
      
      // Clear active sync if it's the cancelled one
      if (activeSync.value?.syncId === syncId) {
        activeSync.value = null
      }
      
      // Refresh data
      await Promise.all([
        loadSyncHistory(),
        loadSyncStats()
      ])
      
      errorNotification.showInfoNotification(
        t('jira.sync.messages.cancelSuccess'),
        { duration: 3000 }
      )
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function retryFailedSync(syncHistoryId: string, notifications?: NotificationStrategy): Promise<ManualSyncResponse> {
    // デフォルトの通知戦略
    const defaultNotifications: NotificationStrategy = {
      onSuccess: () => errorNotification.showSuccessNotification(
        t('jira.sync.messages.retrySuccess'),
        { duration: 3000 }
      ),
      onError: (error) => errorNotification.showErrorNotification(error)
    }
    
    const notificationHandlers = notifications || defaultNotifications
    
    loading.value = true
    error.value = null
    
    try {
      const response = await jiraSyncService.retryFailedSync(syncHistoryId)
      
      // Start polling for the retry sync
      if (enablePolling && response.syncId) {
        startProgressPolling(response.syncId)
      }
      
      // Refresh data
      await Promise.all([
        loadSyncHistory(),
        loadCurrentProgress(),
        loadSyncStats()
      ])
      
      // カスタム成功通知またはデフォルト通知を実行
      notificationHandlers.onSuccess?.()
      
      return response
    } catch (err) {
      error.value = err as Error
      // カスタムエラー通知またはデフォルト通知を実行
      notificationHandlers.onError?.(err as Error)
      throw err
    } finally {
      loading.value = false
    }
  }

  // History Management
  async function loadSyncHistory(params?: SyncHistorySearchParams): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      syncHistory.value = await jiraSyncService.getSyncHistory(params, true)
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
    } finally {
      loading.value = false
    }
  }

  async function loadSyncHistoryDetails(syncHistoryId: string): Promise<SyncHistoryDetailResponse | null> {
    try {
      return await jiraSyncService.getSyncHistoryDetails(syncHistoryId, true)
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
      return null // Don't throw, return null to prevent double notification
    }
  }

  async function refreshHistory(): Promise<void> {
    await loadSyncHistory()
  }

  // Helper function to convert JiraSyncStatusResponse to legacy SyncProgress format
  function convertStatusResponseToProgress(statusResponse: JiraSyncStatusResponse): SyncProgress[] {
    if (statusResponse.isRunning && statusResponse.currentSyncId) {
      const runningSyncProgress: SyncProgress = {
        syncId: statusResponse.currentSyncId,
        status: 'IN_PROGRESS',
        currentStep: statusResponse.syncType ? `Running ${statusResponse.syncType.toLowerCase()} sync...` : 'Running sync...',
        totalQueries: 0, // Not available in new format - could be enhanced by calling getSyncProgress
        processedQueries: 0, // Not available in new format - could be enhanced by calling getSyncProgress
        progressPercentage: 50, // Default since we don't have real progress - could be enhanced
        startedAt: statusResponse.startedAt || new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      }
      return [runningSyncProgress]
    }
    return []
  }

  // Status Monitoring
  async function loadCurrentProgress(): Promise<void> {
    try {
      const statusResponse = await jiraSyncService.getSyncStatus(false) // Always fetch fresh status
      
      // Convert to legacy format for backward compatibility
      currentProgress.value = convertStatusResponseToProgress(statusResponse)
      
      // Update active sync
      const running = currentProgress.value.find(p => p.status === 'IN_PROGRESS')
      activeSync.value = running || null
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
    }
  }

  function startProgressPolling(syncId?: string): void {
    if (isPolling.value) {
      stopProgressPolling()
    }

    isPolling.value = true

    // Set up progress polling
    if (syncId) {
      jiraSyncService.startStatusPolling(
        syncId,
        (progress) => {
          // Update current progress
          const index = currentProgress.value.findIndex(p => p.syncId === syncId)
          if (index !== -1) {
            currentProgress.value[index] = progress
          } else {
            currentProgress.value.push(progress)
          }
          
          // Update active sync
          if (progress.status === 'IN_PROGRESS') {
            activeSync.value = progress
          } else if (activeSync.value?.syncId === syncId) {
            activeSync.value = null
          }
        },
        (error) => {
          errorNotification.showErrorNotification(error)
          isPolling.value = false
        }
      )
    }

    // Set up periodic refresh
    refreshInterval = setInterval(async () => {
      try {
        await Promise.all([
          loadCurrentProgress(),
          loadSyncStats()
        ])
        
        // Refresh history every few intervals
        if (Math.random() < 0.3) { // 30% chance
          await loadSyncHistory()
        }
      } catch (err) {
        console.warn('Failed to refresh sync data:', err)
      }
    }, autoRefreshInterval * 60 * 1000) // Convert minutes to milliseconds
  }

  function stopProgressPolling(): void {
    if (pollingInterval) {
      clearInterval(pollingInterval)
      pollingInterval = null
    }
    
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
    
    jiraSyncService.stopAllStatusPolling()
    isPolling.value = false
  }

  // Statistics
  async function loadSyncStats(): Promise<void> {
    try {
      syncStats.value = await jiraSyncService.getSyncStatsSummary(true)
    } catch (err) {
      error.value = err as Error
      console.warn('Failed to load sync stats:', err)
    }
  }

  // Utility Methods
  async function isAnySyncRunning(): Promise<boolean> {
    try {
      return await jiraSyncService.isAnySyncRunning(false) // Always check fresh status
    } catch (err) {
      error.value = err as Error
      return false
    }
  }

  function getStatusInfo(status: SyncStatus): { label: string; color: string; icon: string } {
    return jiraSyncService.getSyncStatusInfo(status)
  }

  function formatDuration(durationMs?: number): string {
    return jiraSyncService.formatSyncDuration(durationMs)
  }

  async function refreshAll(): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      await Promise.all([
        loadSyncHistory(),
        loadCurrentProgress(),
        loadSyncStats()
      ])
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
    } finally {
      loading.value = false
    }
  }

  function clearCache(): void {
    jiraSyncService.clearAllCaches()
    refreshAll()
  }

  // Helper Functions
  function filterHistoryByStatus(history: SyncHistory[], status: SyncStatus): SyncHistory[] {
    return history.filter(h => h.syncStatus === status)
  }

  function filterHistoryByType(history: SyncHistory[], type: string): SyncHistory[] {
    return history.filter(h => h.syncType === type)
  }

  function filterHistoryByDateRange(
    history: SyncHistory[], 
    startDate: Date, 
    endDate: Date
  ): SyncHistory[] {
    return history.filter(h => {
      const syncDate = new Date(h.startedAt)
      return syncDate >= startDate && syncDate <= endDate
    })
  }

  function calculateSuccessRate(history: SyncHistory[]): number {
    if (history.length === 0) return 100
    const successful = history.filter(h => h.syncStatus === 'COMPLETED').length
    return Math.round((successful / history.length) * 100)
  }

  function getRecentHistory(history: SyncHistory[], days: number): SyncHistory[] {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    
    return history.filter(h => new Date(h.startedAt) >= cutoff)
  }

  function canTriggerManualSync(): boolean {
    return !hasRunningSyncs.value && !loading.value
  }

  function canCancelSync(progress: SyncProgress): boolean {
    return progress.status === 'IN_PROGRESS'
  }

  // Auto-load initial data
  if (autoLoadHistory) {
    Promise.all([
      loadSyncHistory(),
      loadCurrentProgress(),
      loadSyncStats()
    ]).catch(err => {
      console.warn('Failed to auto-load sync data:', err)
    })
    
    // Start polling if enabled and there are running syncs
    if (enablePolling) {
      loadCurrentProgress().then(() => {
        if (hasRunningSyncs.value) {
          startProgressPolling()
        }
      })
    }
  }

  // Cleanup on unmount
  onUnmounted(() => {
    stopProgressPolling()
    jiraSyncService.cleanup()
  })

  return {
    // State
    syncHistory,
    currentProgress,
    activeSync,
    syncStats,
    loading,
    error,
    isPolling,
    
    // Computed
    recentHistory,
    failedSyncs,
    runningSyncs,
    completedSyncs,
    successRate,
    hasRunningSyncs,
    latestSync,
    averageSyncDuration,
    
    // Actions
    triggerSync,
    cancelSync,
    retryFailedSync,
    loadSyncHistory,
    loadSyncHistoryDetails,
    refreshHistory,
    loadCurrentProgress,
    startProgressPolling,
    stopProgressPolling,
    loadSyncStats,
    isAnySyncRunning,
    getStatusInfo,
    formatDuration,
    refreshAll,
    clearCache,
    
    // Helpers
    filterHistoryByStatus,
    filterHistoryByType,
    filterHistoryByDateRange,
    calculateSuccessRate,
    getRecentHistory,
    canTriggerManualSync,
    canCancelSync
  }
}