import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { OktaAuth, UserClaims, AccessToken } from '@okta/okta-auth-js'
import { getCurrentInstance } from 'vue'

// Global OktaAuth instance
let globalOktaAuth: OktaAuth | null = null

/**
 * Set the global OktaAuth instance
 */
export const setOktaAuthInstance = (oktaAuth: OktaAuth) => {
  globalOktaAuth = oktaAuth
}

/**
 * Auth Store using okta-vue
 */
export const useAuthStore = defineStore('auth', () => {
  // Get Okta instance
  const getOktaAuth = (): OktaAuth => {
    if (globalOktaAuth) {
      return globalOktaAuth
    }
    
    // Try to get from Vue instance as fallback
    const instance = getCurrentInstance()
    if (instance?.appContext.app.config.globalProperties.$auth) {
      return instance.appContext.app.config.globalProperties.$auth
    }
    
    throw new Error('OktaAuth instance not available')
  }

  // Authentication state
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const isAuthenticated = ref(false)
  const user = ref<UserClaims | null>(null)
  const accessToken = ref<string | null>(null)
  const scopes = ref<string[]>([])
  const userLastFetched = ref<number | null>(null)

  // Helper: Check if user cache is valid (within 1 hour)
  const isCacheValid = (): boolean => {
    if (!userLastFetched.value) return false
    const now = Date.now()
    const elapsed = now - userLastFetched.value
    const ONE_HOUR = 60 * 60 * 1000 // 1 hour in milliseconds
    return elapsed < ONE_HOUR
  }

  // Helper: Fetch user info from Okta
  const fetchUserInfo = async () => {
    const $auth = getOktaAuth()
    if (!$auth) return

    try {
      user.value = await $auth.getUser()
      userLastFetched.value = Date.now()
    } catch (err) {
      console.error('Failed to fetch user information:', err)
      throw err
    }
  }

  // Initialize auth state
  const initializeAuthState = async () => {
    const $auth = getOktaAuth()
    if (!$auth) return

    try {
      isAuthenticated.value = await $auth.isAuthenticated()

      if (isAuthenticated.value) {
        // Only fetch user info if cache is invalid or user is null
        if (!user.value || !isCacheValid()) {
          user.value = await $auth.getUser()
          userLastFetched.value = Date.now()
        }

        const tokenManager = $auth.tokenManager
        const token = await tokenManager.get('accessToken') as AccessToken
        accessToken.value = token?.accessToken || null
        const scopeClaims = token?.claims?.scp
        scopes.value = Array.isArray(scopeClaims)
          ? scopeClaims.filter((s): s is string => typeof s === 'string')
          : []
      }
    } catch (err) {
      console.error('Failed to initialize auth state:', err)
      isAuthenticated.value = false
      user.value = null
      accessToken.value = null
      scopes.value = []
      userLastFetched.value = null
    }
  }

  // User ID convenience property
  const userId = computed(() => {
    return user.value?.sub || null
  })

  // Actions
  const loginWithOkta = async () => {
    try {
      const $auth = getOktaAuth()
      isLoading.value = true
      error.value = null
      await $auth.signInWithRedirect()
    } catch (err: any) {
      error.value = err.message || 'Login failed'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const logout = async () => {
    try {
      const $auth = getOktaAuth()
      isLoading.value = true
      await $auth.signOut()
    } catch (err: any) {
      console.error('Logout error:', err)
      error.value = err.message || 'Logout failed'
    } finally {
      isLoading.value = false
    }
  }

  const handleCallback = async () => {
    try {
      const $auth = getOktaAuth()
      isLoading.value = true
      error.value = null
      await $auth.handleLoginRedirect()
      return true
    } catch (err: any) {
      error.value = err.message || 'Callback handling failed'
      console.error('Callback handling failed:', err)
      return false
    } finally {
      isLoading.value = false
    }
  }

  const checkAuthStatus = async () => {
    try {
      isLoading.value = true
      await initializeAuthState()
      return isAuthenticated.value
    } catch (err: any) {
      console.error('Auth status check failed:', err)
      error.value = err.message
      return false
    } finally {
      isLoading.value = false
    }
  }

  const clearError = () => {
    error.value = null
  }

  const hasScope = (requiredScope: string): boolean => {
    return scopes.value.includes(requiredScope) 
  }

  const hasPermission = (requiredScope: string): boolean => {
    return hasScope(requiredScope)
  }

  const hasAnyScope = (requiredScopes: string[]): boolean => {
    for (const scope of requiredScopes) {
      if (hasScope(scope)) return true
    }
    return false
  }

  const hasAllScopes = (requiredScopes: string[]): boolean => {
    for (const scope of requiredScopes) {
      if (!hasScope(scope)) return false
    }
    return true
  }

  const ensureUserLoaded = async (): Promise<void> => {
    // If authenticated and (user is null or cache expired), fetch user info
    if (isAuthenticated.value && (!user.value || !isCacheValid())) {
      try {
        await fetchUserInfo()
      } catch (err) {
        console.error('Failed to ensure user loaded:', err)
      }
    }
  }

  return {
    // State
    isLoading,
    error,
    isAuthenticated,
    user,
    userId,
    accessToken,
    scopes,


    // Actions
    loginWithOkta,
    logout,
    handleCallback,
    checkAuthStatus,
    clearError,
    hasScope,
    hasPermission,
    hasAnyScope,
    hasAllScopes,
    ensureUserLoaded
  }
})