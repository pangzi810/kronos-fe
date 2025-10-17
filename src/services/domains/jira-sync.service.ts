import apiClient from '../core/api.client'
import { apiCache, CacheKeyBuilder } from '../core/api.cache'
import { handleApiError } from '../core/error.handler'
import type {
  SyncHistory,
  SyncHistorySearchParams,
  SyncHistoryResponse,
  SyncHistoryDetailResponse,
  SyncHistorySummary,
  SyncProgress,
  ManualSyncRequest,
  ManualSyncResponse,
  JiraSyncStatusResponse,
  SyncStatus
} from '../types/jira.types'
import { type AxiosError } from 'axios'

/**
 * JIRA Sync Service
 * Handles JIRA synchronization operations, history tracking, and monitoring
 */
class JiraSyncService {
  private readonly baseURL = '/jira/sync'
  private readonly cacheTime = 2 * 60 * 1000 // 2 minutes for sync data
  private readonly statusCheckInterval = 3000 // 3 seconds
  private statusPollingIntervals: Map<string, NodeJS.Timeout> = new Map()

  // Manual Sync Operations

  /**
   * Trigger manual synchronization
   */
  async triggerManualSync(request?: ManualSyncRequest): Promise<ManualSyncResponse> {
    try {
      const { data } = await apiClient.post<ManualSyncResponse>(
        `${this.baseURL}/manual`,
        request || {}
      )

      // Invalidate sync-related caches
      this.invalidateSyncCaches()

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Cancel running synchronization
   */
  async cancelSync(syncId: string): Promise<void> {
    try {
      await apiClient.post(`${this.baseURL}/${syncId}/cancel`)

      // Stop polling for this sync
      this.stopStatusPolling(syncId)

      // Invalidate sync-related caches
      this.invalidateSyncCaches()
      apiCache.delete(`jira:sync:progress:${syncId}`)
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  // Sync Status Monitoring

  /**
   * Get current sync status
   */
  async getSyncStatus(useCache = false): Promise<JiraSyncStatusResponse> {
    const cacheKey = 'jira:sync:status'

    try {
      // Check cache (shorter TTL for status)
      if (useCache) {
        const cached = apiCache.get<JiraSyncStatusResponse>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get<JiraSyncStatusResponse>(
        `${this.baseURL}/status`
      )

      // Cache result (very short TTL for status)
      apiCache.set(cacheKey, data, 30 * 1000) // 30 seconds

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get sync progress list for backward compatibility
   * @deprecated Use getSyncStatus() instead
   */
  async getSyncProgressList(_useCache = false): Promise<SyncProgress[]> {
    // For backward compatibility, return empty array since 
    // the backend doesn't provide this endpoint anymore
    console.warn('getSyncProgressList is deprecated. The backend no longer provides progress list endpoint.')
    return []
  }

  /**
   * Get sync progress for specific sync
   */
  async getSyncProgress(syncId: string, useCache = false): Promise<SyncProgress> {
    const cacheKey = `jira:sync:progress:${syncId}`

    try {
      // Check cache (shorter TTL for progress)
      if (useCache) {
        const cached = apiCache.get<SyncProgress>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get<SyncProgress>(
        `${this.baseURL}/status`
      )

      // Cache result (very short TTL for progress)
      apiCache.set(cacheKey, data, 15 * 1000) // 15 seconds

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Start polling sync progress with callback
   */
  startStatusPolling(
    syncId: string,
    callback: (progress: SyncProgress) => void,
    errorCallback?: (error: Error) => void
  ): void {
    // Stop existing polling if any
    this.stopStatusPolling(syncId)

    const pollStatus = async () => {
      try {
        const progress = await this.getSyncProgress(syncId, false) // Never cache when polling
        callback(progress)

        // Stop polling if sync is completed or failed
        if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(progress.status)) {
          this.stopStatusPolling(syncId)
          return
        }

        // Schedule next poll
        const intervalId = setTimeout(pollStatus, this.statusCheckInterval)
        this.statusPollingIntervals.set(syncId, intervalId)
      } catch (error) {
        if (errorCallback) {
          errorCallback(error as Error)
        }
        // Stop polling on error
        this.stopStatusPolling(syncId)
      }
    }

    // Start first poll immediately
    pollStatus()
  }

  /**
   * Stop polling sync progress
   */
  stopStatusPolling(syncId: string): void {
    const intervalId = this.statusPollingIntervals.get(syncId)
    if (intervalId) {
      clearTimeout(intervalId)
      this.statusPollingIntervals.delete(syncId)
    }
  }

  /**
   * Stop all status polling
   */
  stopAllStatusPolling(): void {
    for (const [_syncId, intervalId] of this.statusPollingIntervals.entries()) {
      clearTimeout(intervalId)
    }
    this.statusPollingIntervals.clear()
  }

  // Sync History Management

  /**
   * Get sync history
   */
  async getSyncHistory(params?: SyncHistorySearchParams, useCache = true): Promise<SyncHistoryResponse> {
    const cacheKey = new CacheKeyBuilder('jira:sync:history')
      .addParams(params || {})
      .build()

    try {
      // Check cache for simple queries
      if (useCache && !params?.triggeredBy && !params?.startedFrom) {
        const cached = apiCache.get<SyncHistoryResponse>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get<SyncHistoryResponse>(
        `${this.baseURL}/history`,
        { params }
      )

      // Cache result (only for non-filtered queries)
      if (!params?.triggeredBy && !params?.startedFrom) {
        apiCache.set(cacheKey, data, this.cacheTime)
      }

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get sync history by ID
   */
  async getSyncHistoryById(id: string, useCache = true): Promise<SyncHistory> {
    const cacheKey = `jira:sync:history:${id}`

    try {
      // Check cache
      if (useCache) {
        const cached = apiCache.get<SyncHistory>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await apiClient.get<SyncHistory>(
        `${this.baseURL}/history/${id}`
      )

      // Cache result
      apiCache.set(cacheKey, data, this.cacheTime)

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get sync history details
   */
  async getSyncHistoryDetails(syncHistoryId: string, useCache = true): Promise<SyncHistoryDetailResponse> {
    const cacheKey = `jira:sync:history:${syncHistoryId}:details`

    try {
      // Check cache
      if (useCache) {
        const cached = apiCache.get<SyncHistoryDetailResponse>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API (backend endpoint is /history/{id}, not /history/{id}/details)
      const { data } = await apiClient.get<SyncHistoryDetailResponse>(
        `${this.baseURL}/history/${syncHistoryId}`
      )

      // Cache result
      apiCache.set(cacheKey, data, this.cacheTime)

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get recent sync history (last 10 syncs)
   */
  async getRecentSyncHistory(useCache = true): Promise<SyncHistorySummary[]> {
    const response = await this.getSyncHistory({ page: 0, size: 10 }, useCache)
    return response.syncHistories
  }

  /**
   * Get failed sync history
   */
  async getFailedSyncHistory(useCache = true): Promise<SyncHistorySummary[]> {
    const response = await this.getSyncHistory({ status: 'FAILED' }, useCache)
    return response.syncHistories
  }

  /**
   * Get running sync history
   */
  async getRunningSyncHistory(useCache = false): Promise<SyncHistorySummary[]> {
    const response = await this.getSyncHistory({ status: 'IN_PROGRESS' }, useCache)
    return response.syncHistories
  }

  /**
   * Retry failed sync
   */
  async retryFailedSync(syncHistoryId: string): Promise<ManualSyncResponse> {
    try {
      const { data } = await apiClient.post<ManualSyncResponse>(
        `${this.baseURL}/history/${syncHistoryId}/retry`
      )

      // Invalidate sync-related caches
      this.invalidateSyncCaches()

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  // Utility Methods

  /**
   * Check if any sync is currently running
   */
  async isAnySyncRunning(useCache = false): Promise<boolean> {
    try {
      const statusResponse = await this.getSyncStatus(useCache)
      return statusResponse.isRunning
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get sync statistics summary
   */
  async getSyncStatsSummary(useCache = true): Promise<{
    totalSyncs: number
    runningsyncs: number
    successfulSyncs: number
    failedSyncs: number
    averageDuration: number
    lastSyncAt?: string
  }> {
    const cacheKey = 'jira:sync:stats:summary'

    try {
      // Check cache
      if (useCache) {
        const cached = apiCache.get<any>(cacheKey)
        if (cached) return cached
      }

      // Fetch recent sync history and calculate stats
      const recentHistoryResponse = await this.getSyncHistory({ size: 100 }, false)
      const recentHistory = recentHistoryResponse.syncHistories
      const runningsyncs = await this.getRunningSyncHistory(false)

      const totalSyncs = recentHistory.length
      const successfulSyncs = recentHistory.filter(h => h.syncStatus === 'COMPLETED').length
      const failedSyncs = recentHistory.filter(h => h.syncStatus === 'FAILED').length
      const completedSyncs = recentHistory.filter(h => h.durationMinutes !== undefined)
      const averageDuration = completedSyncs.length > 0
        ? completedSyncs.reduce((sum, h) => sum + (h.durationMinutes || 0), 0) / completedSyncs.length * 60000 // Convert minutes to milliseconds
        : 0
      const lastSyncAt = recentHistory.length > 0 ? recentHistory[0].startedAt : undefined

      const summary = {
        totalSyncs,
        runningsyncs: runningsyncs.length,
        successfulSyncs,
        failedSyncs,
        averageDuration,
        lastSyncAt
      }

      // Cache result
      apiCache.set(cacheKey, summary, this.cacheTime)

      return summary
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get sync duration in human readable format
   */
  formatSyncDuration(durationMs?: number): string {
    if (!durationMs) return 'N/A'

    const seconds = Math.floor(durationMs / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  /**
   * Get sync status display information
   */
  getSyncStatusInfo(status: SyncStatus): {
    label: string
    color: string
    icon: string
  } {
    switch (status) {
      case 'IN_PROGRESS':
        return { label: '実行中', color: 'blue', icon: 'mdi-play-circle' }
      case 'COMPLETED':
        return { label: '完了', color: 'green', icon: 'mdi-check-circle' }
      case 'FAILED':
        return { label: '失敗', color: 'red', icon: 'mdi-alert-circle' }
      default:
        return { label: '不明', color: 'grey', icon: 'mdi-help-circle' }
    }
  }

  // Cache Management

  /**
   * Invalidate sync-related caches
   */
  private invalidateSyncCaches(): void {
    apiCache.invalidate(/^jira:sync:/)
  }

  /**
   * Clear all sync caches
   */
  clearAllCaches(): void {
    this.invalidateSyncCaches()
  }

  /**
   * Cleanup method - call when component is destroyed
   */
  cleanup(): void {
    this.stopAllStatusPolling()
  }
}

// Export singleton instance
export const jiraSyncService = new JiraSyncService()
export default jiraSyncService