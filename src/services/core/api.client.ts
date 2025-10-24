import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { useToast } from 'vue-toastification'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'

/**
 * Base API client with interceptors for authentication and error handling
 */
class ApiClient {
  private instance: AxiosInstance
  private toast = useToast()
  private refreshPromise: Promise<boolean> | null = null
  private maxRetries = 1

  constructor() {
    this.instance = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.instance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        // Add auth token from okta-vue
        const authStore = useAuthStore()
        const accessToken = authStore.accessToken
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`
        }

        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId()

        // Log request in development
        if (import.meta.env.DEV) {
          console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, config.data)
        }

        return config
      },
      (error: AxiosError) => {
        console.error('[API Request Error]', error)
        return Promise.reject(error)
      }
    )

    // Response interceptor
    this.instance.interceptors.response.use(
      (response) => {
        // Log response in development
        if (import.meta.env.DEV) {
          console.log(`[API Response] ${response.config.url}`, response.data)
        }
        return response
      },
      async (error: AxiosError<any>) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

        // Handle network errors
        if (!error.response) {
          // console.log('[Network Error] No response received', error)
          // this.toast.error('ネットワークエラーが発生しました。接続を確認してください。')
          return Promise.reject(error)
        }

        const { status, data } = error.response

        // Handle 401 Unauthorized - attempt token refresh and retry
        if (status === 401 && !originalRequest._retry) {
          originalRequest._retry = true
          
          try {
            // Use shared refresh promise to prevent multiple concurrent refresh attempts
            const refreshSuccess = await this.getOrCreateRefreshPromise()
            
            if (refreshSuccess) {
              // Update Authorization header with new token
              const authStore = useAuthStore()
              const newAccessToken = await authStore.accessToken
              if (newAccessToken) {
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
                return this.instance(originalRequest)
              }
            }
            
            // If refresh failed or no new token, handle authentication failure
            await this.handleAuthenticationFailure()
            return Promise.reject(error)
          } catch (refreshError) {
            console.error('[Token Refresh and Retry Failed]', refreshError)
            await this.handleAuthenticationFailure()
            return Promise.reject(error)
          }
        }

        // Phase 3: All error notifications are handled by composables
        // No error notifications in interceptor - pure error propagation

        return Promise.reject(error)
      }
    )
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get or create a shared refresh promise to prevent multiple concurrent refresh attempts
   */
  private async getOrCreateRefreshPromise(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    this.refreshPromise = this.performTokenRefresh()
    
    try {
      const result = await this.refreshPromise
      return result
    } finally {
      // Clear the promise after completion (success or failure)
      this.refreshPromise = null
    }
  }

  /**
   * Perform token refresh using okta-vue
   */
  private async performTokenRefresh(): Promise<boolean> {
    try {
      console.log('[Token Refresh] Checking authentication status...')
      
      // Check if user is still authenticated with okta-vue
      const authStore = useAuthStore()
      const isAuthenticated = await authStore.isAuthenticated
      
      if (isAuthenticated) {
        console.log('[Token Refresh] User is still authenticated')
        return true
      } else {
        console.warn('[Token Refresh] User is no longer authenticated')
        return false
      }
    } catch (error) {
      console.error('[Token Refresh] Error during authentication check:', error)
      return false
    }
  }

  /**
   * Handle authentication failure by clearing state and redirecting to login
   */
  private async handleAuthenticationFailure(): Promise<void> {
    try {
      console.log('[Authentication Failure] Handling authentication failure...')
      
      // Clear authentication errors
      const authStore = useAuthStore()
      authStore.clearError()
      
      // Show user-friendly notification
      this.toast.warning('セッションが期限切れです。再度ログインしてください。')
      
      // Redirect to login page if not already there
      const currentRoute = router.currentRoute.value
      if (currentRoute.name !== 'login' && currentRoute.name !== 'callback') {
        await router.push({ 
          name: 'login',
          query: { 
            redirect: currentRoute.fullPath !== '/' ? currentRoute.fullPath : undefined 
          }
        })
      }
    } catch (error) {
      console.error('[Authentication Failure Handling Error]', error)
      // Fallback: force page reload to clear any corrupted state
      window.location.href = '/login'
    }
  }

  public getAxiosInstance(): AxiosInstance {
    return this.instance
  }
}

// Export singleton instance
export const apiClient = new ApiClient()
export default apiClient.getAxiosInstance()