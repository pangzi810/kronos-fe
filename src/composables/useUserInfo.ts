import { ref, computed, watchEffect, onUnmounted, type Ref, type ComputedRef } from 'vue'
import { useAuthStore } from '@/stores/auth'
import apiClient from '@/services/core/api.client'
import { useOktaAuth } from '@/composables/useOktaAuth'
import type { AxiosError } from 'axios'

/**
 * UserInfo interface based on backend UserInfoResponse DTO
 */
export interface UserInfo {
  /** User ID (primary key) */
  userId: string
  /** Okta User ID */
  oktaUserId: string
  /** Username */
  username: string
  /** Email address */
  email: string
  /** Full name */
  fullName: string
  /** Last login timestamp (ISO 8601 format) */
  lastLoginAt: string | null
  /** Last updated timestamp (ISO 8601 format) */
  lastUpdatedAt: string
}

/**
 * Return type for useUserInfo Composable
 */
export interface UseUserInfoReturn {
  // User info state
  userInfo: Ref<UserInfo | null>
  isLoading: Ref<boolean>
  error: Ref<string | null>
  lastUpdated: Ref<Date | null>
  
  // Actions
  fetchUserInfo: (force?: boolean) => Promise<UserInfo | null>
  refreshUserInfo: () => Promise<UserInfo | null>
  updateUserInfo: (data: Partial<UserInfo>) => void
  clearUserInfo: () => void
  clearError: () => void
}

/**
 * useUserInfo Composable
 * Vue 3 Composition API pattern for user information management
 * Integrates with /api/auth/me endpoint and provides caching and error handling
 */
export function useUserInfo(): UseUserInfoReturn {
  // State management
  const userInfo = ref<UserInfo | null>(null)
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const lastUpdated = ref<Date | null>(null)
  
  // Dependencies
  const { isAuthenticated, user: oktaUser } = useOktaAuth()
  const authStore = useAuthStore()
  
  // Cache management
  const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds
  let fetchPromise: Promise<UserInfo | null> | null = null
  let retryCount = 0
  const maxRetries = 3
  const baseRetryDelay = 1000 // 1 second
  
  /**
   * Check if cached data is still valid
   */
  const isCacheValid = computed(() => {
    if (!userInfo.value || !lastUpdated.value) return false
    const now = new Date()
    const timeDiff = now.getTime() - lastUpdated.value.getTime()
    return timeDiff < CACHE_DURATION
  })
  
  /**
   * Generate exponential backoff delay for retries
   */
  const getRetryDelay = (attempt: number): number => {
    return baseRetryDelay * Math.pow(2, attempt) + Math.random() * 1000
  }
  
  /**
   * Handle API errors with detailed classification
   */
  const handleApiError = (err: AxiosError): string => {
    if (!err.response) {
      return 'ネットワークエラーが発生しました。接続を確認してください。'
    }
    
    const status = err.response?.status
    
    switch (status) {
      case 401:
        return 'セッションが期限切れです。再度ログインしてください。'
      case 403:
        return 'ユーザー情報へのアクセス権限がありません。'
      case 404:
        return 'ユーザー情報が見つかりません。'
      case 500:
        return 'サーバーエラーが発生しました。しばらく待ってから再度お試しください。'
      case 503:
        return 'サービスが一時的に利用できません。しばらく待ってから再度お試しください。'
      default:
        return `エラーが発生しました (${status ?? 'unknown'})。`
    }
  }
  
  /**
   * Fetch user info from API with retry mechanism
   */
  const performFetch = async (attempt: number = 0): Promise<UserInfo | null> => {
    try {
      console.log(`[useUserInfo] Fetching user info (attempt ${attempt + 1})`)
      
      const response = await apiClient.get<UserInfo>('/auth/me')
      const userData = response.data
      
      if (!userData) {
        console.error('[useUserInfo] Empty user data received')
        throw new Error('ユーザーデータが空です')
      }
      
      console.log(`[useUserInfo] Successfully fetched user info:`, userData.username)
      retryCount = 0 // Reset retry count on success
      return userData
      
    } catch (err: any) {
      console.error(`[useUserInfo] Fetch attempt ${attempt + 1} failed:`, err)
      
      // Check if this is a custom application error that shouldn't be retried
      if (err.message === 'ユーザーデータが空です') {
        throw err
      }
      
      const axiosError = err as AxiosError
      
      // Don't retry on authentication errors or client errors (4xx except 408, 429)
      if (axiosError.response) {
        const status = axiosError.response.status
        if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
          throw err
        }
      }
      
      // Retry on network errors, server errors (5xx), or retryable client errors (408, 429)
      if (attempt < maxRetries - 1) {
        const delay = getRetryDelay(attempt)
        console.log(`[useUserInfo] Retrying in ${delay}ms...`)
        
        await new Promise(resolve => setTimeout(resolve, delay))
        return performFetch(attempt + 1)
      }
      
      throw err
    }
  }
  
  /**
   * Fetch user information from /api/auth/me endpoint
   * @param force - Force fetch even if cache is valid
   * @returns Promise<UserInfo | null>
   */
  const fetchUserInfo = async (force: boolean = false): Promise<UserInfo | null> => {
    // Return cached data if valid and not forced
    if (!force && isCacheValid.value) {
      console.log('[useUserInfo] Returning cached user info')
      return userInfo.value
    }
    
    // Return existing promise if fetch is already in progress
    if (fetchPromise) {
      console.log('[useUserInfo] Fetch already in progress, waiting...')
      return fetchPromise
    }
    
    // Check authentication state
    if (!isAuthenticated.value) {
      console.warn('[useUserInfo] User not authenticated, skipping fetch')
      error.value = '認証されていません'
      return null
    }
    
    isLoading.value = true
    error.value = null
    
    fetchPromise = performFetch()
      .then((userData) => {
        if (userData) {
          userInfo.value = userData
          lastUpdated.value = new Date()
          error.value = null
        }
        return userData
      })
      .catch((err: any) => {
        let errorMessage: string
        
        // Check for custom application errors first
        if (err.message === 'ユーザーデータが空です') {
          errorMessage = err.message
        } else if (err.isAxiosError || err.response || err.request || err.code) {
          // Handle Axios errors (including network errors)
          try {
            errorMessage = handleApiError(err as AxiosError)
          } catch (handlerError) {
            console.error('[useUserInfo] Error in handleApiError:', handlerError)
            errorMessage = 'ネットワークエラーが発生しました。接続を確認してください。'
          }
        } else {
          // Handle other errors
          errorMessage = err.message || 'ユーザー情報の取得に失敗しました'
        }
        
        error.value = errorMessage
        console.error('[useUserInfo] Failed to fetch user info:', errorMessage)
        return null
      })
      .finally(() => {
        isLoading.value = false
        fetchPromise = null
      })
    
    return fetchPromise
  }
  
  /**
   * Force refresh user information
   * @returns Promise<UserInfo | null>
   */
  const refreshUserInfo = async (): Promise<UserInfo | null> => {
    console.log('[useUserInfo] Force refreshing user info')
    return fetchUserInfo(true)
  }
  
  /**
   * Update local user information
   * @param data - Partial user info to update
   */
  const updateUserInfo = (data: Partial<UserInfo>): void => {
    if (userInfo.value) {
      console.log('[useUserInfo] Updating local user info:', Object.keys(data))
      userInfo.value = { ...userInfo.value, ...data }
      lastUpdated.value = new Date()
    } else {
      console.warn('[useUserInfo] Cannot update: user info is null')
    }
  }
  
  /**
   * Clear user information and cache
   */
  const clearUserInfo = (): void => {
    console.log('[useUserInfo] Clearing user info')
    userInfo.value = null
    lastUpdated.value = null
    error.value = null
    retryCount = 0
    
    // Cancel ongoing fetch
    if (fetchPromise) {
      fetchPromise = null
    }
  }
  
  /**
   * Clear error state
   */
  const clearError = (): void => {
    error.value = null
  }
  
  // Watch for authentication state changes
  watchEffect(() => {
    if (isAuthenticated.value && oktaUser.value) {
      // Auto-fetch user info when authenticated
      console.log('[useUserInfo] Authentication detected, auto-fetching user info')
      fetchUserInfo().catch(console.error)
    } else if (!isAuthenticated.value) {
      // Clear user info when not authenticated
      console.log('[useUserInfo] Authentication lost, clearing user info')
      clearUserInfo()
    }
  })
  
  // Cleanup on unmount
  onUnmounted(() => {
    console.log('[useUserInfo] Component unmounting, cleaning up')
    fetchPromise = null
  })
  
  return {
    // State
    userInfo,
    isLoading,
    error,
    lastUpdated,
    
    // Actions
    fetchUserInfo,
    refreshUserInfo,
    updateUserInfo,
    clearUserInfo,
    clearError
  }
}

// Default export
export default useUserInfo