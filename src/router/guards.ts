import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

/**
 * 認証が必要なルートのガード
 * 未認証ユーザーをログインページにリダイレクト
 */
export const requireAuth = async (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): Promise<void> => {
  const authStore = useAuthStore()
  
  try {
    // 認証状態をチェック（トークンの有効性を確認）
    await authStore.checkAuthStatus()
    
    if (authStore.isAuthenticated) {
      // 認証済みの場合、アクセス許可
      next()
    } else {
      // 未認証の場合、元のパスを保存してログインページにリダイレクト
      const redirectPath = to.fullPath
      if (redirectPath && redirectPath !== '/' && redirectPath !== '/login') {
        sessionStorage.setItem('okta_redirect_path', redirectPath)
      }
      console.log('Redirecting to login, saving path:', redirectPath)

      next({
        name: 'login',
        query: { redirect: redirectPath }
      })
    }
  } catch (error) {
    console.error('Authentication check failed:', error)
    // エラーの場合もログインページにリダイレクト
    next({
      name: 'login',
      query: { redirect: to.fullPath }
    })
  }
}

/**
 * Oktaコールバック処理のガード
 * コールバックパラメータの検証とエラーハンドリング
 */
export const handleOktaCallback = async (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): Promise<void> => {
  const { query } = to
  const authStore = useAuthStore()
  
  try {
    // 必須パラメータの確認
    if (!query.code || typeof query.code !== 'string') {
      console.error('Missing or invalid authorization code in callback')
      next({
        name: 'login',
        query: { error: 'invalid_callback' }
      })
      return
    }
    
    // State parameter の検証（CSRF対策）
    const state = query.state as string | undefined
    if (state) {
      // State parameter が存在する場合、適切な形式かチェック
      try {
        // Base64デコードを試行してstate形式を検証
        const decodedState = atob(state)
        if (!decodedState || decodedState.length === 0) {
          throw new Error('Invalid state parameter')
        }
      } catch (error) {
        console.error('Invalid state parameter:', error)
        next({
          name: 'login',
          query: { error: 'invalid_state' }
        })
        return
      }
    }
    
    // エラーパラメータのチェック
    if (query.error) {
      const error = query.error as string
      const errorDescription = query.error_description as string || 'OAuth authorization failed'
      
      console.error('OAuth callback error:', error, errorDescription)
      next({
        name: 'login',
        query: { 
          error: 'oauth_error',
          message: errorDescription 
        }
      })
      return
    }
    
    // コールバック処理を実行 (okta-vue handles the code automatically)
    const success = await authStore.handleCallback()
    
    if (success) {
      // 認証成功時の処理
      console.log('Callback handling successful, redirecting...')
      
      // リダイレクト先の決定
      const redirectPath = getRedirectPath(typeof query.state === 'string' ? query.state : undefined)
      
      next({
        path: redirectPath,
        replace: true // 履歴から削除してセキュリティを向上
      })
    } else {
      // コールバック処理失敗
      console.error('Callback handling failed')
      next({
        name: 'login',
        query: { error: 'callback_failed' }
      })
    }
  } catch (error) {
    console.error('Callback guard error:', error)
    next({
      name: 'login',
      query: { error: 'callback_error' }
    })
  }
}

/**
 * パブリックルート用のガード
 * 認証済みユーザーをホームページにリダイレクト
 */
export const redirectIfAuthenticated = async (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): Promise<void> => {
  const authStore = useAuthStore()
  
  try {
    await authStore.checkAuthStatus()
    
    if (authStore.isAuthenticated) {
      // 認証済みの場合、ホームページにリダイレクト
      next({ name: 'home' })
    } else {
      // 未認証の場合、アクセス許可
      next()
    }
  } catch (error) {
    console.error('Public route guard error:', error)
    // エラーの場合もアクセス許可（ログインページへのアクセスを妨げない）
    next()
  }
}

/**
 * ログアウト後のリダイレクトガード
 * ログアウト後にパブリックページにリダイレクト
 */
export const handleLogout = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): void => {
  const authStore = useAuthStore()
  
  // 認証エラーをクリア
  authStore.clearError()
  
  // ログインページにリダイレクト
  next({ 
    name: 'login',
    query: { message: 'logged_out' }
  })
}

/**
 * スコープベースの認可ガード
 * 特定のスコープが必要なルートのアクセス制御
 */
export const requireScope = (requiredScope: string) => {
  return async (
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    next: NavigationGuardNext
  ): Promise<void> => {
    const authStore = useAuthStore()
    
    try {
      // まず認証状態をチェック
      await authStore.checkAuthStatus()
      
      if (!authStore.isAuthenticated) {
        // 未認証の場合、ログインページにリダイレクト
        next({
          name: 'login',
          query: { redirect: to.fullPath }
        })
        return
      }
      
      // スコープをチェック
      if (authStore.hasScope(requiredScope)) {
        next()
      } else {
        // スコープが不足している場合、403エラーページまたはホームにリダイレクト
        console.warn('Insufficient permissions for route:', to.path, 'Required scope:', requiredScope)
        next({ 
          name: 'home',
          query: { error: 'insufficient_permissions' }
        })
      }
    } catch (error) {
      console.error('Scope guard error:', error)
      next({
        name: 'login',
        query: { redirect: to.fullPath }
      })
    }
  }
}

/**
 * 複数スコープベースの認可ガード（いずれかのスコープが必要）
 */
export const requireAnyScope = (requiredScopes: string[]) => {
  return async (
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    next: NavigationGuardNext
  ): Promise<void> => {
    const authStore = useAuthStore()
    
    try {
      await authStore.checkAuthStatus()
      
      if (!authStore.isAuthenticated) {
        next({
          name: 'login',
          query: { redirect: to.fullPath }
        })
        return
      }
      
      if (authStore.hasAnyScope(requiredScopes)) {
        next()
      } else {
        console.warn('Insufficient permissions for route:', to.path, 'Required scopes (any):', requiredScopes)
        next({ 
          name: 'home',
          query: { error: 'insufficient_permissions' }
        })
      }
    } catch (error) {
      console.error('Any scope guard error:', error)
      next({
        name: 'login',
        query: { redirect: to.fullPath }
      })
    }
  }
}

/**
 * 複数スコープベースの認可ガード（すべてのスコープが必要）
 */
export const requireAllScopes = (requiredScopes: string[]) => {
  return async (
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    next: NavigationGuardNext
  ): Promise<void> => {
    const authStore = useAuthStore()
    
    try {
      await authStore.checkAuthStatus()
      
      if (!authStore.isAuthenticated) {
        next({
          name: 'login',
          query: { redirect: to.fullPath }
        })
        return
      }
      
      if (authStore.hasAllScopes(requiredScopes)) {
        next()
      } else {
        console.warn('Insufficient permissions for route:', to.path, 'Required scopes (all):', requiredScopes)
        next({ 
          name: 'home',
          query: { error: 'insufficient_permissions' }
        })
      }
    } catch (error) {
      console.error('All scopes guard error:', error)
      next({
        name: 'login',
        query: { redirect: to.fullPath }
      })
    }
  }
}

/**
 * state パラメータからリダイレクト先のパスを取得
 * Note: Okta SDK が生成する state パラメータは内部的に使用されるため、
 * カスタムリダイレクトパスには使用しない
 */
function getRedirectPath(_state?: string): string {
  // Okta SDK の state パラメータは PKCE や CSRF 保護のために使用される
  // リダイレクトパスはセッションストレージから取得する方が安全
  const savedRedirect = sessionStorage.getItem('okta_redirect_path')

  if (savedRedirect) {
    sessionStorage.removeItem('okta_redirect_path')
    // セキュリティ: 相対パスのみ許可
    if (savedRedirect.startsWith('/')) {
      return savedRedirect
    }
  }

  // デフォルトはホームページ
  return '/'
}

/**
 * リダイレクト先パスのサニタイズ
 */
export function sanitizeRedirectPath(path: string): string {
  // 基本的な検証: パスは'/'で始まる相対パスである必要
  if (!path || typeof path !== 'string' || !path.startsWith('/')) {
    return '/'
  }
  
  // 危険な文字列の除去
  const cleaned = path
    .replace(/[<>]/g, '') // XSS対策
    .replace(/\.\./g, '') // パストラバーサル対策
  
  return cleaned || '/'
}