import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useErrorNotification } from '@/composables/useErrorNotification'
import { useJiraSync } from '@/composables/useJiraSync'
import jiraSyncService from '@/services/domains/jira-sync.service'
import type { ManualSyncRequest, JqlQuery } from '@/services/types/jira.types'

export interface UseManualSyncTriggerOptions {
  autoStart?: boolean
  refreshInterval?: number
}

export interface ManualSyncTriggerEmits {
  syncStarted: (syncId: string) => void
  syncCompleted: (syncId: string, success: boolean) => void
}

export interface SyncConfig {
  querySelection: 'all' | 'selected'
  selectedQueryIds: string[]
  priority: 'HIGH' | 'NORMAL' | 'LOW'
  notes: string
}

export function useManualSyncTrigger(
  emits?: ManualSyncTriggerEmits,
  options: UseManualSyncTriggerOptions = {}
) {
  const { autoStart = true, refreshInterval: refreshIntervalMs = 10000 } = options
  
  const { t: $t } = useI18n()
  const { showErrorNotification } = useErrorNotification()
  const { triggerSync: triggerJiraSync } = useJiraSync()

  // Refs
  const triggerForm = ref()

  // State
  const showTriggerDialog = ref(false)
  const triggering = ref(false)
  const isAnySyncRunning = ref(false)
  const syncStats = ref<any>(null)
  const availableQueries = ref<JqlQuery[]>([])
  const refreshInterval = ref<NodeJS.Timeout | null>(null)

  // Sync Configuration
  const syncConfig = ref<SyncConfig>({
    querySelection: 'all',
    selectedQueryIds: [],
    priority: 'NORMAL',
    notes: ''
  })

  // Computed
  const priorityOptions = computed(() => [
    { title: $t('jira.sync.priority.HIGH'), value: 'HIGH' },
    { title: $t('jira.sync.priority.NORMAL'), value: 'NORMAL' },
    { title: $t('jira.sync.priority.LOW'), value: 'LOW' }
  ])

  /**
   * Check if any sync is currently running
   */
  const checkRunningSync = async (): Promise<void> => {
    try {
      isAnySyncRunning.value = await jiraSyncService.isAnySyncRunning(false)
    } catch (error) {
      console.error('Error checking running sync:', error)
      isAnySyncRunning.value = false
    }
  }

  /**
   * Load sync statistics
   */
  const loadSyncStats = async (): Promise<void> => {
    try {
      syncStats.value = await jiraSyncService.getSyncStatsSummary(false)
    } catch (error) {
      console.error('Error loading sync stats:', error)
      showErrorNotification(error as Error)
    }
  }

  /**
   * Load available JQL queries
   */
  const loadAvailableQueries = async (): Promise<void> => {
    try {
      // TODO: Load actual queries from JQL query service when available
      // For now, use mock data
      availableQueries.value = [
        {
          id: '1',
          queryName: 'Active Projects',
          jqlExpression: 'project is not EMPTY',
          active: true,
          priority: 1,
          // Removed description - property doesn't exist in backend
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          queryName: 'Development Projects',
          jqlExpression: 'project = DEV',
          active: true,
          priority: 2,
          // Removed description - property doesn't exist in backend
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ]
    } catch (error) {
      console.error('Error loading available queries:', error)
      availableQueries.value = []
    }
  }

  /**
   * Trigger manual sync
   */
  const triggerSync = async (): Promise<void> => {
    triggering.value = true

    try {
      // Prepare sync request
      const request: ManualSyncRequest = {
        priority: syncConfig.value.priority,
        notes: syncConfig.value.notes || undefined
      }

      // Add query IDs if specific queries selected
      if (syncConfig.value.querySelection === 'selected') {
        if (syncConfig.value.selectedQueryIds.length === 0) {
          showErrorNotification($t('jira.sync.trigger.noQueries'))
          return
        }
        request.queryIds = syncConfig.value.selectedQueryIds
      }

      // Trigger sync using useJiraSync (handles success/error notifications internally)
      const response = await triggerJiraSync(request)

      if (response) {
        emits?.syncStarted(response.syncId)

        // Close dialog and reset form
        closeTriggerDialog()

        // Refresh status
        await checkRunningSync()
      }
      // If response is null, error was already handled by triggerJiraSync
    } catch (error) {
      // Handle any unexpected errors
      console.error('Error triggering sync:', error)
      showErrorNotification(error as Error)
    } finally {
      triggering.value = false
    }
  }

  /**
   * Close trigger dialog and reset form
   */
  const closeTriggerDialog = (): void => {
    showTriggerDialog.value = false
    
    // Reset form after a short delay to avoid visual glitch
    setTimeout(() => {
      syncConfig.value = {
        querySelection: 'all',
        selectedQueryIds: [],
        priority: 'NORMAL',
        notes: ''
      }
      if (triggerForm.value) {
        triggerForm.value.reset()
      }
    }, 300)
  }

  /**
   * Open trigger dialog
   */
  const openTriggerDialog = (): void => {
    showTriggerDialog.value = true
  }

  /**
   * Reset sync configuration to defaults
   */
  const resetSyncConfig = (): void => {
    syncConfig.value = {
      querySelection: 'all',
      selectedQueryIds: [],
      priority: 'NORMAL',
      notes: ''
    }
  }

  /**
   * Start periodic monitoring
   */
  const startMonitoring = (): void => {
    if (autoStart) {
      checkRunningSync()
      loadSyncStats()
    }
    
    // Set up periodic refresh
    refreshInterval.value = setInterval(() => {
      checkRunningSync()
      if (!showTriggerDialog.value) {
        loadSyncStats()
      }
    }, refreshIntervalMs)
  }

  /**
   * Stop periodic monitoring
   */
  const stopMonitoring = (): void => {
    if (refreshInterval.value) {
      clearInterval(refreshInterval.value)
      refreshInterval.value = null
    }
  }

  /**
   * Cleanup function
   */
  const cleanup = (): void => {
    stopMonitoring()
  }

  // Watch for dialog changes to load queries
  watch(() => showTriggerDialog.value, (newValue) => {
    if (newValue) {
      // Load queries when dialog opens
      loadAvailableQueries()
    }
  })

  // Cleanup on unmount
  onUnmounted(() => {
    cleanup()
  })

  return {
    // Refs
    triggerForm,

    // State
    showTriggerDialog,
    triggering,
    isAnySyncRunning,
    syncStats,
    availableQueries,
    syncConfig,

    // Computed
    priorityOptions,

    // Actions
    checkRunningSync,
    loadSyncStats,
    loadAvailableQueries,
    triggerSync,
    closeTriggerDialog,
    openTriggerDialog,
    resetSyncConfig,
    startMonitoring,
    stopMonitoring,
    cleanup
  }
}