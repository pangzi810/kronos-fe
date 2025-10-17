<template>
  <v-container class="fill-height login-container" fluid>
    <v-row justify="center" align="center" class="fill-height">
      <v-col cols="12" sm="10" md="6" lg="4" xl="3">
        <v-card class="elevation-12 login-card">
          <v-card-title class="text-center pa-6">
            <v-icon size="64" color="primary" class="mb-4">mdi-clock-time-eight</v-icon>
            <div class="text-h4">{{ appTitle }}</div>
            <div class="text-subtitle-1 text-medium-emphasis">{{ $t('login.title') }}</div>
          </v-card-title>

          <v-card-text class="px-6 pb-0">
            <!-- Loading state -->
            <div v-if="isCheckingAuth" class="text-center pa-6">
              <v-progress-circular indeterminate color="primary" class="mb-4" />
              <div class="text-body-2 text-medium-emphasis">{{ $t('common.loading') }}</div>
            </div>

            <!-- Login form -->
            <div v-else class="login-form">
              <div class="mb-6 text-center">
                <v-btn
                  size="large"
                  variant="elevated"
                  color="primary"
                  :loading="isLoading"
                  :disabled="isLoading"
                  class="login-button"
                  @click="handleOktaLogin"
                  data-testid="okta-login-button"
                >
                  <v-icon class="mr-2">mdi-account-key</v-icon>
                  {{ $t('login.oktaLogin') }}
                </v-btn>
              </div>

              <!-- General error display -->
              <v-alert
                v-if="generalError"
                type="error"
                variant="tonal"
                class="mb-4"
                closable
                @click:close="clearError"
                data-testid="general-error"
              >
                {{ generalError }}
              </v-alert>
            </div>
          </v-card-text>

          <v-card-actions class="px-6 pb-6">
            <v-spacer />
            <div class="text-caption text-medium-emphasis">
              {{ $t('login.version', { version: appVersion }) }}
            </div>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

// Composables
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { t } = useI18n()

// Environment variables
const appTitle = import.meta.env.VITE_APP_TITLE || 'Development Hour Management'
const appVersion = import.meta.env.VITE_APP_VERSION || '1.0.0'

// State
const isCheckingAuth = ref(false)
const isLoading = ref(false)
const generalError = ref<string | null>(null)

// Event handlers
const handleOktaLogin = async (): Promise<void> => {
  try {
    isLoading.value = true
    generalError.value = null
    await authStore.loginWithOkta()
  } catch (error: any) {
    generalError.value = error.message || t('auth.loginFailed')
    console.error('Okta login failed:', error)
  } finally {
    isLoading.value = false
  }
}

const clearError = (): void => {
  generalError.value = null
  authStore.clearError()
}

// Auto-redirect logic for authenticated users
const checkAuthAndRedirect = async (): Promise<void> => {
  if (authStore.isAuthenticated) {
    // User is already authenticated, redirect to intended page
    const redirectPath = (route.query.redirect as string) || '/'
    await router.push(redirectPath)
    return
  }

  // Check if there are valid tokens in storage
  isCheckingAuth.value = true
  try {
    await authStore.checkAuthStatus()
    
    if (authStore.isAuthenticated) {
      // Authentication successful, redirect
      const redirectPath = (route.query.redirect as string) || '/'
      await router.push(redirectPath)
    }
  } catch (error) {
    console.error('Auth status check failed:', error)
    // Stay on login page
  } finally {
    isCheckingAuth.value = false
  }
}

// Lifecycle hooks
onMounted(() => {
  checkAuthAndRedirect()
})

// Watch for authentication changes
watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) {
      // User has been authenticated, redirect
      const redirectPath = (route.query.redirect as string) || '/'
      router.push(redirectPath)
    }
  }
)

// Watch for auth errors
watch(
  () => authStore.error,
  (error) => {
    if (error && !generalError.value) {
      generalError.value = error
    }
  }
)
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.login-card {
  border-radius: 12px;
  overflow: hidden;
  max-width: 400px;
  margin: 0 auto;
}

.login-form {
  animation: fadeIn 0.5s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.login-button {
  width: 100%;
  min-height: 48px;
  border-radius: 8px;
  text-transform: none;
  font-weight: 500;
  letter-spacing: 0.5px;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .login-card {
    margin: 16px;
    border-radius: 8px;
  }
  
  .v-card-title {
    padding: 24px 16px !important;
  }
  
  .v-card-text {
    padding: 0 16px !important;
  }
  
  .v-card-actions {
    padding: 0 16px 16px !important;
  }
}

/* Accessibility improvements */
.login-button:focus-visible {
  outline: 2px solid rgba(var(--v-theme-primary), 0.5);
  outline-offset: 2px;
}

/* Loading state styles */
.text-center .v-progress-circular {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}
</style>
