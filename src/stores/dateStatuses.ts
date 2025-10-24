import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DateStatus } from '@/services/types'
import { workRecordService } from '@/services'

interface CachedMonth {
  key: string
  year: number
  month: number
  statuses: Record<string, DateStatus>
  fetchedAt: number
}

/**
 * DateStatuses Store
 * Manages date status data with multi-month caching
 */
export const useDateStatusesStore = defineStore('dateStatuses', () => {
  // Cache configuration
  const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
  const MAX_CACHED_MONTHS = 6 // Maximum number of months to cache

  // State
  const cachedMonths = ref<Map<string, CachedMonth>>(new Map())
  const loading = ref<Set<string>>(new Set())
  const errors = ref<Map<string, Error>>(new Map())

  // Helper: Generate cache key from year and month
  const getMonthKey = (year: number, month: number): string => {
    return `${year}-${String(month).padStart(2, '0')}`
  }

  // Helper: Check if cache is valid
  const isCacheValid = (cachedMonth: CachedMonth): boolean => {
    const now = Date.now()
    const elapsed = now - cachedMonth.fetchedAt
    return elapsed < CACHE_DURATION
  }

  // Helper: Remove oldest cached month
  const removeOldestCache = () => {
    if (cachedMonths.value.size === 0) return

    let oldestKey: string | null = null
    let oldestTime = Date.now()

    cachedMonths.value.forEach((cached, key) => {
      if (cached.fetchedAt < oldestTime) {
        oldestTime = cached.fetchedAt
        oldestKey = key
      }
    })

    if (oldestKey) {
      cachedMonths.value.delete(oldestKey)
    }
  }

  // Computed: Get all date statuses (flat map of all cached months)
  const allDateStatuses = computed((): Record<string, DateStatus> => {
    const result: Record<string, DateStatus> = {}
    cachedMonths.value.forEach((cached) => {
      Object.assign(result, cached.statuses)
    })
    return result
  })

  // Get date statuses for a specific month
  const getDateStatuses = (year: number, month: number): Record<string, DateStatus> => {
    const key = getMonthKey(year, month)
    const cached = cachedMonths.value.get(key)

    if (cached && isCacheValid(cached)) {
      return cached.statuses
    }

    return {}
  }

  // Check if a month is currently loading
  const isLoading = (year: number, month: number): boolean => {
    const key = getMonthKey(year, month)
    return loading.value.has(key)
  }

  // Get error for a specific month
  const getError = (year: number, month: number): Error | null => {
    const key = getMonthKey(year, month)
    return errors.value.get(key) || null
  }

  // Load date statuses for a specific month
  const loadDateStatuses = async (year: number, month: number, force = false): Promise<void> => {
    const key = getMonthKey(year, month)

    // Check if already cached and valid
    const cached = cachedMonths.value.get(key)
    if (!force && cached && isCacheValid(cached)) {
      return
    }

    // Check if already loading
    if (loading.value.has(key)) {
      return
    }

    // Start loading
    loading.value.add(key)
    errors.value.delete(key)

    try {
      const statuses = await workRecordService.getDateStatuses(year, month, false)

      // Enforce max cache size
      if (cachedMonths.value.size >= MAX_CACHED_MONTHS) {
        removeOldestCache()
      }

      // Cache the result
      cachedMonths.value.set(key, {
        key,
        year,
        month,
        statuses,
        fetchedAt: Date.now()
      })
    } catch (error) {
      errors.value.set(key, error as Error)
      console.error(`Failed to load date statuses for ${year}-${month}:`, error)
      throw error
    } finally {
      loading.value.delete(key)
    }
  }

  // Invalidate cache for a specific month
  const invalidateMonth = (year: number, month: number) => {
    const key = getMonthKey(year, month)
    cachedMonths.value.delete(key)
    errors.value.delete(key)
  }

  // Clear all cached data
  const clearCache = () => {
    cachedMonths.value.clear()
    loading.value.clear()
    errors.value.clear()
  }

  // Get cache statistics
  const getCacheStats = () => {
    return {
      cachedMonthsCount: cachedMonths.value.size,
      maxCachedMonths: MAX_CACHED_MONTHS,
      cacheDuration: CACHE_DURATION,
      cachedKeys: Array.from(cachedMonths.value.keys())
    }
  }

  return {
    // State
    allDateStatuses,

    // Getters
    getDateStatuses,
    isLoading,
    getError,
    getCacheStats,

    // Actions
    loadDateStatuses,
    invalidateMonth,
    clearCache
  }
})
