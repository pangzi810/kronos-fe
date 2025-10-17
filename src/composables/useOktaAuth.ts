import { ref, computed, watchEffect, onUnmounted, type Ref, type ComputedRef } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { UserClaims } from '@okta/okta-auth-js'

/**
 * Return type for useOktaAuth Composable
 */
export interface UseOktaAuthReturn {
  // 認証状態
  user: ComputedRef<UserClaims | null>
  isAuthenticated: ComputedRef<boolean>
  isLoading: ComputedRef<boolean>
  error: ComputedRef<string | null>
  
  // 認証アクション
  login: () => Promise<void>
  logout: () => Promise<void>
  checkAuthStatus: () => Promise<void>
  clearError: () => void
}

/**
 * useOktaAuth Composable
 * Vue 3 Composition API パターンでOkta認証機能を提供
 * Pinia認証ストアをラップして簡潔なインターフェースを提供
 */
export function useOktaAuth(): UseOktaAuthReturn {
  const authStore = useAuthStore()
  
  // 認証状態の計算プロパティ（Pinia storeから直接取得）
  const user = computed(() => authStore.user)
  const isAuthenticated = computed(() => authStore.isAuthenticated)
  const isLoading = computed(() => authStore.isLoading)
  const error = computed(() => authStore.error)
  
  // 認証アクション
  /**
   * Oktaログイン開始
   * オプションでリダイレクトURIや追加スコープを指定可能
   */
  const login = async (): Promise<void> => {
    try {
      await authStore.loginWithOkta()
    } catch (err: any) {
      const errorMessage = err.message || 'ログインに失敗しました'
      console.error('Login failed:', err)
      throw new Error(errorMessage)
    }
  }
  
  /**
   * ログアウト処理
   * ローカル状態をクリアしてOktaログアウトページにリダイレクト
   */
  const logout = async (): Promise<void> => {
    try {
      await authStore.logout()
    } catch (err: any) {
      const errorMessage = err.message || 'ログアウトに失敗しました'
      console.error('Logout failed:', err)
      throw new Error(errorMessage)
    }
  }
  
  // Token refresh is handled automatically by okta-vue
  
  /**
   * 認証状態確認
   * 保存されているトークンの有効性を確認し、必要に応じて更新
   */
  const checkAuthStatus = async (): Promise<void> => {
    try {
      await authStore.checkAuthStatus()
    } catch (err: any) {
      const errorMessage = err.message || '認証状態の確認に失敗しました'
      console.error('Auth status check failed:', err)
      throw new Error(errorMessage)
    }
  }
  
  /**
   * エラー状態をクリア
   * ストアのエラーをクリア
   */
  const clearError = (): void => {
    authStore.clearError()
  }
  
  return {
    // 認証状態
    user,
    isAuthenticated,
    isLoading,
    error,
    
    // 認証アクション
    login,
    logout,
    checkAuthStatus,
    clearError
  }
}

// デフォルトエクスポート
export default useOktaAuth