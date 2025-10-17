import type { UserClaims } from '@okta/okta-auth-js'

/**
 * Okta Authentication Type Definitions
 * Defines TypeScript types for Okta authentication flow
 */

/**
 * Custom profile attributes from Okta
 */
export interface CustomProfileAttributes {
  /** User's division (custom claim) */
  division?: string
  /** User's department (custom claim) */
  department?: string
  /** User's job title (custom claim) */
  title?: string
  /** User's employee number (custom claim) */
  employeeNumber?: string
  /** User's manager name (custom claim) */
  manager?: string
  /** User's manager ID (custom claim) */
  managerId?: string
}

/**
 * Extended User Claims with custom Okta profile attributes
 * Combines the standard UserClaims from @okta/okta-auth-js with custom fields
 */
export type ExtendedUserClaims = UserClaims & CustomProfileAttributes

/**
 * Okta Configuration Validation Error
 */
export interface OktaConfigError {
  field: string
  message: string
}

/**
 * Authentication Events
 */
export type AuthEvent = 
  | 'login'
  | 'logout' 
  | 'token_refresh'
  | 'token_expired'
  | 'authentication_error'
  | 'session_expired'

/**
 * Authentication Event Handler
 */
export interface AuthEventHandler {
  event: AuthEvent
  handler: (data?: any) => void
}

/**
 * Login Options
 */
export interface LoginOptions {
  /** Custom redirect URI for this login */
  redirectUri?: string
  /** Additional scopes to request */
  additionalScopes?: string[]
  /** Custom state parameter */
  state?: string
  /** Login hint (e.g., email) */
  loginHint?: string
}

/**
 * Logout Options
 */
export interface LogoutOptions {
  /** Custom post-logout redirect URI */
  postLogoutRedirectUri?: string
  /** Clear all tokens from storage */
  clearTokensFromStorage?: boolean
}