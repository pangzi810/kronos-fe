<template>
  <v-container class="fill-height" fluid>
    <v-row justify="center" align="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card class="elevation-12">
          <v-card-title class="text-center pa-6">
            <v-icon 
              :size="64" 
              :color="isError ? 'error' : 'primary'" 
              class="mb-4"
              :class="isLoading ? 'rotating' : ''"
            >
              {{ isError ? 'mdi-alert-circle' : isLoading ? 'mdi-loading' : 'mdi-check-circle' }}
            </v-icon>
            <div class="text-h4">{{ $t('callback.title') }}</div>
          </v-card-title>

          <v-card-text class="px-6 pb-6 text-center">
            <div v-if="isLoading" class="mb-4">
              <v-progress-circular
                indeterminate
                color="primary"
                size="32"
                class="mb-3"
              />
              <div class="text-body-1">{{ $t('callback.processing') }}</div>
              <div class="text-caption text-medium-emphasis">{{ $t('callback.pleaseWait') }}</div>
            </div>

            <div v-else-if="isError" class="mb-4">
              <v-alert
                type="error"
                variant="tonal"
                class="mb-4"
                :title="$t('callback.error.title')"
                :text="errorMessage || $t('callback.error.default')"
              />
              <v-btn
                color="primary"
                @click="returnToLogin"
                class="mr-2"
              >
                {{ $t('callback.error.backToLogin') }}
              </v-btn>
              <v-btn
                variant="outlined"
                @click="retryCallback"
              >
                {{ $t('callback.error.retry') }}
              </v-btn>
            </div>

            <div v-else class="mb-4">
              <div class="text-body-1 mb-2">{{ $t('callback.success') }}</div>
              <div class="text-caption text-medium-emphasis">{{ $t('callback.redirecting') }}</div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { t } = useI18n()

const isLoading = ref(true)
const isError = ref(false)
const errorMessage = ref<string>('')

const returnToLogin = () => {
  router.push({ name: 'login' })
}

const retryCallback = () => {
  isLoading.value = true
  isError.value = false
  errorMessage.value = ''
  handleCallback()
}

const handleCallback = async () => {
  try {
    isLoading.value = true
    isError.value = false
    errorMessage.value = ''

    console.log('Callback processing started with okta-vue')

    // Handle OAuth error responses from query parameters
    const error = route.query.error as string
    const errorDescription = route.query.error_description as string

    if (error) {
      console.error('OAuth error received:', { error, errorDescription })
      throw new Error(`OAuth error: ${errorDescription || error}`)
    }

    // Use auth store's handleCallback method which uses okta-vue
    const success = await authStore.handleCallback()
    
    if (!success) {
      throw new Error('Authentication failed during callback processing')
    }

    console.log('Authentication successful, redirecting...')
    
    // Small delay to show success state
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Determine redirect destination
    const redirectTo = route.query.redirectUrl as string || '/'
    
    // Clean up URL parameters before redirect
    await router.replace({ path: redirectTo })

  } catch (error: any) {
    console.error('Callback error:', error)
    
    isError.value = true
    isLoading.value = false
    
    // Set user-friendly error message based on error type
    let userMessage = t('callback.error.default')
    
    if (error.message?.includes('state mismatch') || error.message?.includes('Invalid authentication state')) {
      userMessage = 'セキュリティエラー: 認証状態が無効です。再度ログインしてください。'
    } else if (error.message?.includes('Authorization code not found')) {
      userMessage = t('callback.error.invalidRequest')
    } else if (error.message?.includes('OAuth error: access_denied')) {
      userMessage = t('callback.error.accessDenied')
    } else if (error.message?.includes('Token exchange failed') || error.message?.includes('retrieve authentication tokens')) {
      userMessage = t('callback.error.tokenRetrieval')
    } else if (error.message?.includes('not initialized')) {
      userMessage = t('callback.error.notInitialized')
    } else if (error.message) {
      // Use the error message if it's user-friendly
      userMessage = error.message
    }
    
    errorMessage.value = userMessage

    // Clear any authentication errors
    authStore.clearError()
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  // Handle the callback when component mounts
  handleCallback()
})
</script>

<style scoped>
.rotating {
  animation: rotate 2s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.v-progress-circular {
  margin: 1rem auto;
}
</style>