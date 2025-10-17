import { ref, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useErrorNotification } from '@/composables/useErrorNotification'
import jiraSyncService from '@/services/domains/jira-sync.service'
import type { SyncProgress, JiraSyncStatusResponse } from '@/services/types/jira.types'

export interface UseSyncStatusMonitorOptions {
  autoStart?: boolean
  refreshInterval?: number
}

export interface SyncStatusMonitorEmits {
  refresh: () => void
  syncStarted: (syncId: string) => void
  syncCompleted: (syncId: string, success: boolean) => void
}

export function useSyncStatusMonitor(
  emits?: SyncStatusMonitorEmits,
  options: UseSyncStatusMonitorOptions = {}
) {
  const { autoStart = true, refreshInterval: refreshIntervalMs = 30000 } = options
  
  const { t: $t } = useI18n()
  const { showErrorNotification, showSuccessNotification } = useErrorNotification()

  // State
  const loading = ref(true)
  const cancelling = ref(false)
  const currentSync = ref<SyncProgress | null>(null)
  const syncStats = ref<any>(null)
  const refreshInterval = ref<NodeJS.Timeout | null>(null)
  const pollingSyncId = ref<string | null>(null)

  /**
   * Convert JiraSyncStatusResponse to SyncProgress for compatibility
   */
  const convertStatusToProgress = (statusResponse: JiraSyncStatusResponse): SyncProgress | null => {
    if (statusResponse.isRunning && statusResponse.currentSyncId) {
      return {
        syncId: statusResponse.currentSyncId,
        status: 'IN_PROGRESS',
        currentStep: statusResponse.syncType ? `Running ${statusResponse.syncType.toLowerCase()} sync...` : 'Running sync...',
        totalQueries: 0, // Not available in new format
        processedQueries: 0, // Not available in new format
        progressPercentage: 50, // Default since we don't have real progress
        startedAt: statusResponse.startedAt || new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      }
    }
    return null
  }

  /**
   * Load current sync status
   */
  const loadSyncStatus = async (): Promise<void> => {
    try {
      loading.value = true
      
      // Get current sync status
      const statusResponse = await jiraSyncService.getSyncStatus(false)
      
      // Convert to SyncProgress format for compatibility
      const syncProgress = convertStatusToProgress(statusResponse)
      
      if (syncProgress) {
        currentSync.value = syncProgress
        startPolling(syncProgress.syncId)
      } else {
        currentSync.value = null
        stopPolling()
      }

      // Load sync statistics
      syncStats.value = await jiraSyncService.getSyncStatsSummary(false)

    } catch (error) {
      console.error('Error loading sync status:', error)
      showErrorNotification(error as Error)
    } finally {
      loading.value = false
    }
  }

  /**
   * Start polling for sync progress
   */
  const startPolling = (syncId: string): void => {
    if (pollingSyncId.value === syncId) return
    
    stopPolling()
    pollingSyncId.value = syncId
    
    jiraSyncService.startStatusPolling(
      syncId,
      (progress) => {
        currentSync.value = progress
        
        // Check if sync completed
        if (['COMPLETED', 'FAILED'].includes(progress.status)) {
          const success = progress.status === 'COMPLETED'
          emits?.syncCompleted(syncId, success)
          
          // Stop polling and refresh after a short delay
          setTimeout(() => {
            stopPolling()
            refresh()
          }, 1000)
        }
      },
      (error) => {
        console.error('Error polling sync progress:', error)
        showErrorNotification(error)
        stopPolling()
      }
    )
  }

  /**
   * Stop polling for sync progress
   */
  const stopPolling = (): void => {
    if (pollingSyncId.value) {
      jiraSyncService.stopStatusPolling(pollingSyncId.value)
      pollingSyncId.value = null
    }
  }

  /**
   * Cancel running sync
   */
  const cancelSync = async (): Promise<void> => {
    if (!currentSync.value) return

    try {
      cancelling.value = true
      await jiraSyncService.cancelSync(currentSync.value.syncId)
      
      showSuccessNotification($t('jira.sync.trigger.cancelSuccess'))
      await refresh()
    } catch (error) {
      console.error('Error cancelling sync:', error)
      showErrorNotification($t('jira.sync.trigger.cancelError'))
    } finally {
      cancelling.value = false
    }
  }

  /**
   * Refresh status data
   */
  const refresh = async (): Promise<void> => {
    emits?.refresh()
    await loadSyncStatus()
  }

  /**
   * Get status display color
   */
  const getStatusColor = (status: string): string => {
    const statusInfo = jiraSyncService.getSyncStatusInfo(status as any)
    return statusInfo.color
  }

  /**
   * Get status display icon
   */
  const getStatusIcon = (status: string): string => {
    const statusInfo = jiraSyncService.getSyncStatusInfo(status as any)
    return statusInfo.icon
  }

  /**
   * Format elapsed time
   */
  const formatElapsedTime = (startTime: string): string => {
    const start = new Date(startTime)
    const now = new Date()
    const elapsed = now.getTime() - start.getTime()
    return jiraSyncService.formatSyncDuration(elapsed)
  }

  /**
   * Format duration
   */
  const formatDuration = (durationMs: number): string => {
    return jiraSyncService.formatSyncDuration(durationMs)
  }

  /**
   * Format last sync time
   */
  const formatLastSyncTime = (lastSyncAt?: string): string => {
    if (!lastSyncAt) {
      return $t('jira.sync.status.unknown')
    }
    
    const date = new Date(lastSyncAt)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    // Less than 1 minute ago
    if (diff < 60000) {
      return $t('common.justNow') || 'Just now'
    }
    
    // Less than 1 hour ago
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000)
      return `${minutes}分前`
    }
    
    // Less than 1 day ago
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours}時間前`
    }
    
    // More than 1 day ago
    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  /**
   * Start the monitoring service
   */
  const startMonitoring = (): void => {
    if (autoStart) {
      loadSyncStatus()
    }
    
    // Set up periodic refresh
    refreshInterval.value = setInterval(() => {
      if (!pollingSyncId.value) {
        // Only refresh periodically if not actively polling
        loadSyncStatus()
      }
    }, refreshIntervalMs)
  }

  /**
   * Stop the monitoring service
   */
  const stopMonitoring = (): void => {
    if (refreshInterval.value) {
      clearInterval(refreshInterval.value)
      refreshInterval.value = null
    }
    stopPolling()
  }

  /**
   * Cleanup function to be called on unmount
   */
  const cleanup = (): void => {
    stopMonitoring()
  }

  // Cleanup on unmount
  onUnmounted(() => {
    cleanup()
  })

  return {
    // State
    loading,
    cancelling,
    currentSync,
    syncStats,
    pollingSyncId,

    // Actions
    loadSyncStatus,
    startPolling,
    stopPolling,
    cancelSync,
    refresh,
    startMonitoring,
    stopMonitoring,
    cleanup,

    // Utilities
    getStatusColor,
    getStatusIcon,
    formatElapsedTime,
    formatDuration,
    formatLastSyncTime
  }
}