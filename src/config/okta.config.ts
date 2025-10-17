/**
 * Okta Configuration for okta-vue
 */

export const oktaConfig = {
  issuer: import.meta.env.VITE_OKTA_ISSUER || 'https://integrator-7614169.okta.com/oauth2/ausv0duqjyAMlQAr2697',
  clientId: import.meta.env.VITE_OKTA_CLIENT_ID || '0oautxe876E1V68ml697',
  redirectUri: window.location.origin + '/callback',
  scopes: [
    'openid',
    'profile',
    'email',
    'projects:read',
    'projects:write',
    'jira:read',
    'jira:write',
    'users:read',
    'work-hours:read',
    'work-hours:write',
    'work-hours:approve',
    'work-hours:admin',
    'approver:read'
  ],
  pkce: true,
  postLogoutRedirectUri: window.location.origin + '/login'
}