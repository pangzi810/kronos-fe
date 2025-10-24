import { type AxiosError } from 'axios'

/**
 * API error response data structure
 */
export interface ApiErrorData {
  message?: string
  code?: string
  errors?: Record<string, string[]>
  error?: string
  error_description?: string
  requiredScope?: string
}

/**
 * Custom API Error classes
 */
export class ApiException extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiException'
    Object.setPrototypeOf(this, ApiException.prototype)
  }
}

export class ValidationException extends ApiException {
  constructor(public errors: Record<string, string[]>) {
    super('入力内容に誤りがあります')
    this.name = 'ValidationException'
    this.status = 422
    Object.setPrototypeOf(this, ValidationException.prototype)
  }
}

export class UnauthorizedException extends ApiException {
  constructor(message = '認証が必要です', public isTokenExpired = false) {
    super(message)
    this.name = 'UnauthorizedException'
    this.status = 401
    Object.setPrototypeOf(this, UnauthorizedException.prototype)
  }
}

export class OktaAuthException extends ApiException {
  constructor(
    message: string,
    public errorCode?: string,
    public errorDescription?: string
  ) {
    super(message)
    this.name = 'OktaAuthException'
    this.status = 401
    Object.setPrototypeOf(this, OktaAuthException.prototype)
  }
}

export class TokenExpiredException extends UnauthorizedException {
  constructor(message = 'トークンの有効期限が切れています') {
    super(message, true)
    this.name = 'TokenExpiredException'
    Object.setPrototypeOf(this, TokenExpiredException.prototype)
  }
}

export class TokenRefreshException extends ApiException {
  constructor(message = 'トークンのリフレッシュに失敗しました') {
    super(message)
    this.name = 'TokenRefreshException'
    this.status = 401
    Object.setPrototypeOf(this, TokenRefreshException.prototype)
  }
}

export class ForbiddenException extends ApiException {
  constructor(message = 'アクセス権限がありません') {
    super(message)
    this.name = 'ForbiddenException'
    this.status = 403
    Object.setPrototypeOf(this, ForbiddenException.prototype)
  }
}

export class NotFoundException extends ApiException {
  constructor(message = 'リソースが見つかりません') {
    super(message)
    this.name = 'NotFoundException'
    this.status = 404
    Object.setPrototypeOf(this, NotFoundException.prototype)
  }
}

export class NetworkException extends ApiException {
  constructor(message = 'ネットワークエラーが発生しました') {
    super(message)
    this.name = 'NetworkException'
    Object.setPrototypeOf(this, NetworkException.prototype)
  }
}

/**
 * Transform Axios error to custom exception
 */
export function handleApiError(error: AxiosError<ApiErrorData>): never {
  // Network error (no response)
  if (!error.response) {
    throw new NetworkException()
  }

  const { status, data } = error.response

  // Handle specific status codes
  switch (status) {
    case 401:
      // Check for Okta-specific error codes
      if (data?.error) {
        // Okta OAuth2 error response format
        if (data.error === 'invalid_token') {
          throw new TokenExpiredException(data.error_description || 'アクセストークンが無効または期限切れです')
        }
        if (data.error === 'invalid_grant') {
          throw new TokenRefreshException(data.error_description || 'リフレッシュトークンが無効です')
        }
        throw new OktaAuthException(
          data.error_description || data.error,
          data.error,
          data.error_description
        )
      }
      
      // Check for token expiration indicators
      if (data?.message?.includes('expired') || data?.code === 'TOKEN_EXPIRED') {
        throw new TokenExpiredException(data.message)
      }
      
      throw new UnauthorizedException(data?.message)

    case 403:
      // Enhanced forbidden exception with Okta scope information
      const message = data?.message || 'アクセス権限がありません'
      if (data?.requiredScope) {
        throw new ForbiddenException(`${message} (必要なスコープ: ${data.requiredScope})`)
      }
      throw new ForbiddenException(message)

    case 404:
      throw new NotFoundException(data?.message)

    case 422:
      if (data?.errors) {
        throw new ValidationException(data.errors)
      }
      throw new ApiException(data?.message || 'Validation failed', 'VALIDATION_ERROR', status)

    case 500:
    case 502:
    case 503:
      throw new ApiException(
        data?.message || 'サーバーエラーが発生しました',
        'SERVER_ERROR',
        status,
        data
      )

    default:
      throw new ApiException(
        data?.message || 'エラーが発生しました',
        data?.code,
        status,
        data
      )
  }
}

/**
 * Check if error is an API exception
 */
export function isApiException(error: unknown): error is ApiException {
  return error instanceof ApiException
}

/**
 * Check if error is a validation exception
 */
export function isValidationException(error: unknown): error is ValidationException {
  return error instanceof ValidationException
}

/**
 * Check if error is an Okta authentication exception
 */
export function isOktaAuthException(error: unknown): error is OktaAuthException {
  return error instanceof OktaAuthException
}

/**
 * Check if error is a token expired exception
 */
export function isTokenExpiredException(error: unknown): error is TokenExpiredException {
  return error instanceof TokenExpiredException
}

/**
 * Check if error is a token refresh exception
 */
export function isTokenRefreshException(error: unknown): error is TokenRefreshException {
  return error instanceof TokenRefreshException
}

/**
 * Check if error requires user re-authentication
 */
export function requiresReAuthentication(error: unknown): boolean {
  return (
    isTokenExpiredException(error) ||
    isTokenRefreshException(error) ||
    (isOktaAuthException(error) && error.errorCode === 'invalid_grant')
  )
}

/**
 * Extract user-friendly error message for authentication errors
 */
export function getAuthErrorMessage(error: unknown): string {
  if (isTokenExpiredException(error)) {
    return 'セッションが期限切れです。再度ログインしてください。'
  }

  if (isTokenRefreshException(error)) {
    return '認証情報の更新に失敗しました。再度ログインしてください。'
  }

  if (isOktaAuthException(error)) {
    return error.errorDescription || error.message
  }

  return getErrorMessage(error)
}

/**
 * Extract error message from any error type
 */
export function getErrorMessage(error: unknown): string {
  if (isApiException(error)) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'An unexpected error occurred'
}