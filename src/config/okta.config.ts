/**
 * Okta Configuration for okta-vue
 */

export const oktaConfig = {
  issuer: import.meta.env.VITE_OKTA_ISSUER,
  clientId: import.meta.env.VITE_OKTA_CLIENT_ID,
  redirectUri: window.location.origin + '/callback',
  scopes: [
    'openid',
    'profile',
    'email',
  ],
  pkce: true,
  postLogoutRedirectUri: window.location.origin + '/login'
}