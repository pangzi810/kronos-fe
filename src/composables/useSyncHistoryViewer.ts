import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useErrorNotification } from '@/composables/useErrorNotification'
import { useJiraSync } from '@/composables/useJiraSync'
import jiraSyncService from '@/services/domains/jira-sync.service'
import type { 
  SyncHistorySummary, 
  SyncHistoryDetailResponse, 
  SyncHistorySearchParams 
} from '@/services/types/jira.types'

export interface UseSyncHistoryViewerOptions {
  autoLoad?: boolean
  defaultPageSize?: number
}

export interface SyncHistoryFilters {
  syncType?: string
  status?: string
  triggeredBy?: string
}

export interface SyncHistoryPagination {
  page: number
  pageSize: number
}

export function useSyncHistoryViewer(options: UseSyncHistoryViewerOptions = {}) {
  const { autoLoad = true, defaultPageSize = 10 } = options
  
  const { t: $t } = useI18n()
  const { showErrorNotification, showSuccessNotification } = useErrorNotification()
  const { loadSyncHistoryDetails } = useJiraSync()

  // State
  const loading = ref(true)
  const history = ref<SyncHistorySummary[]>([])
  const totalItems = ref(0)
  const showDetailsDialog = ref(false)
  const selectedHistory = ref<SyncHistorySummary | null>(null)
  const historyDetails = ref<SyncHistoryDetailResponse | null>(null)

  // Pagination
  const pagination = ref<SyncHistoryPagination>({
    page: 1,
    pageSize: defaultPageSize
  })

  // Filters
  const filters = ref<SyncHistoryFilters>({})

  // Computed
  const headers = computed(() => [
    { title: $t('jira.sync.details.type'), key: 'syncType', sortable: false, width: '100px' },
    { title: $t('common.status'), key: 'syncStatus', sortable: false, width: '120px' },
    { title: $t('jira.sync.details.startTime'), key: 'startedAt', sortable: true, width: '160px' },
    { title: $t('jira.sync.details.duration'), key: 'duration', sortable: true, width: '100px' },
    { title: 'Results', key: 'results', sortable: false, width: '180px' },
    { title: $t('jira.sync.details.triggeredBy'), key: 'triggeredBy', sortable: false, width: '120px' },
  ])

  const typeOptions = computed(() => [
    { title: $t('jira.sync.types.SCHEDULED'), value: 'SCHEDULED' },
    { title: $t('jira.sync.types.MANUAL'), value: 'MANUAL' },
    { title: $t('jira.sync.types.INITIAL'), value: 'INITIAL' }
  ])

  const statusOptions = computed(() => [
    { title: $t('jira.sync.status.in_progress'), value: 'IN_PROGRESS' },
    { title: $t('jira.sync.status.completed'), value: 'COMPLETED' },
    { title: $t('jira.sync.status.failed'), value: 'FAILED' }
  ])

  const hasActiveFilters = computed(() => {
    return Object.values(filters.value).some(value => value !== undefined && value !== '')
  })

  // History operations
  const loadHistory = async (): Promise<void> => {
    try {
      loading.value = true

      const params: SyncHistorySearchParams = {
        page: pagination.value.page - 1, // API uses 0-based pagination
        size: pagination.value.pageSize,
        ...filters.value,
        syncType: filters.value.syncType as any,
        status: filters.value.status as any
      }

      const result = await jiraSyncService.getSyncHistory(params, false)
      
      // Update history with the paginated response
      history.value = result.syncHistories
      totalItems.value = result.totalRecords
      
      // Update pagination info if needed
      if (result.currentPage !== pagination.value.page - 1) {
        pagination.value.page = result.currentPage + 1 // Convert back to 1-based
      }

    } catch (error) {
      console.error('Error loading sync history:', error)
      showErrorNotification(error as Error)
    } finally {
      loading.value = false
    }
  }

  const showDetails = async (syncHistory: SyncHistorySummary): Promise<void> => {
    selectedHistory.value = syncHistory
    
    // Load detailed information using useJiraSync (handles error notification internally)
    const details = await loadSyncHistoryDetails(syncHistory.syncHistoryId)
    
    if (details) {
      historyDetails.value = details
      showDetailsDialog.value = true
    }
    // If details is null, error was already handled by loadSyncHistoryDetails
  }


  const clearFilters = (): void => {
    filters.value = {}
    loadHistory()
  }

  const closeDetailsDialog = (): void => {
    showDetailsDialog.value = false
    selectedHistory.value = null
    historyDetails.value = null
  }

  // Utility functions
  const getStatusColor = (status: string): string => {
    const statusInfo = jiraSyncService.getSyncStatusInfo(status as any)
    return statusInfo.color
  }

  const getStatusIcon = (status: string): string => {
    const statusInfo = jiraSyncService.getSyncStatusInfo(status as any)
    return statusInfo.icon
  }

  const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatRelativeTime = (dateStr: string): string => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}時間前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}日前`
    
    return date.toLocaleDateString('ja-JP')
  }

  const formatDuration = (durationMs?: number): string => {
    return jiraSyncService.formatSyncDuration(durationMs)
  }

  // Pagination helpers
  const resetToFirstPage = (): void => {
    pagination.value.page = 1
  }

  const updatePageSize = (newSize: number): void => {
    pagination.value.pageSize = newSize
    resetToFirstPage()
    loadHistory()
  }

  const updatePage = (newPage: number): void => {
    pagination.value.page = newPage
    loadHistory()
  }

  // Filter management
  const updateFilters = (newFilters: Partial<SyncHistoryFilters>): void => {
    filters.value = { ...filters.value, ...newFilters }
    resetToFirstPage()
    loadHistory()
  }

  const resetFilters = (): void => {
    filters.value = {}
    resetToFirstPage()
    loadHistory()
  }

  // Watch for filter changes
  watch(filters, () => {
    resetToFirstPage()
    loadHistory()
  }, { deep: true })

  // Auto-load on mount
  if (autoLoad) {
    onMounted(() => {
      loadHistory()
    })
  }

  return {
    // State
    loading,
    history,
    totalItems,
    showDetailsDialog,
    selectedHistory,
    historyDetails,
    pagination,
    filters,

    // Computed
    headers,
    typeOptions,
    statusOptions,
    hasActiveFilters,

    // Actions
    loadHistory,
    showDetails,
    clearFilters,
    closeDetailsDialog,

    // Utilities
    getStatusColor,
    getStatusIcon,
    formatDateTime,
    formatRelativeTime,
    formatDuration,

    // Pagination helpers
    resetToFirstPage,
    updatePageSize,
    updatePage,

    // Filter management
    updateFilters,
    resetFilters
  }
}