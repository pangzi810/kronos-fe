import type { App } from 'vue'
import { useAuthStore } from '@/stores/auth'

export interface PermissionDirectiveValue {
  anyOf?: string[]
  not?: string | PermissionDirectiveValue
}

/**
 * Check if user has the required permission(s)
 */
function hasPermission(value: string | PermissionDirectiveValue): boolean {
  const authStore = useAuthStore()
  if (typeof value === 'string') {
    // Simple permission check
    return authStore.hasScope(value)
  }

  if (value.not) {
    // Negation check
    return !hasPermission(value.not)
  }

  if (value.anyOf) {
    // Check if user has any of the specified permissions
    return authStore.hasAnyScope(value.anyOf)
  }

  return false
}

/**
 * Vue directive for permission-based conditional rendering
 * Usage:
 * v-can="'permission:scope'"
 * v-can="{ anyOf: ['perm1', 'perm2'] }"
 * v-can="{ allOf: ['perm1', 'perm2'] }"
 * v-can="{ not: 'permission:scope' }"
 */
const permissionDirective = {
  mounted(el: HTMLElement, binding: { value: string | PermissionDirectiveValue }) {
    if (!hasPermission(binding.value)) {
      el.style.display = 'none'
    }
  },
  updated(el: HTMLElement, binding: { value: string | PermissionDirectiveValue }) {
    if (!hasPermission(binding.value)) {
      el.style.display = 'none'
    } else {
      el.style.display = ''
    }
  }
}

export default {
  install(app: App) {
    app.directive('can', permissionDirective)
  }
}