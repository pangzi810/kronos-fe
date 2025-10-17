<template>
  <v-card class="pa-0">
    <v-card-title class="text-h6 pa-6 bg-surface-variant">
      <v-icon class="me-2">mdi-cog</v-icon>
      JIRA連携設定
    </v-card-title>

    <v-divider></v-divider>

    <v-card-text class="pa-6">
      <!-- Connection Status -->
      <v-alert
        :type="connectionStatusType"
        :icon="connectionStatusIcon"
        variant="tonal"
        class="mb-6"
      >
        <v-alert-title>
          {{ $t('jira.connection.status') }}
        </v-alert-title>
        <div class="mt-2">
          {{ connectionStatusMessage }}
          <div v-if="connectionStatus?.testedAt" class="text-caption mt-1">
            {{ $t('jira.info.lastChecked') }}: {{ formatDateTime(connectionStatus.testedAt) }}
          </div>
        </div>
        
      </v-alert>

      <!-- Configuration Display -->
      <div v-if="connectionConfig">
        <v-list class="pa-0">
          <v-list-subheader class="text-subtitle-1 font-weight-medium">
            設定情報
          </v-list-subheader>
          
          <v-list-item class="px-0 py-2">
            <template #prepend>
              <v-icon color="primary">mdi-server</v-icon>
            </template>
            <v-list-item-title>JIRA URL</v-list-item-title>
            <v-list-item-subtitle class="text-body-2 mt-1">
              {{ connectionConfig.baseUrl || 'Not configured' }}
            </v-list-item-subtitle>
          </v-list-item>

          <v-divider class="my-2"></v-divider>

          <v-list-item class="px-0 py-2">
            <template #prepend>
              <v-icon color="primary">mdi-account</v-icon>
            </template>
            <v-list-item-title>JIRA Username (Environment Variable)</v-list-item-title>
            <v-list-item-subtitle class="text-body-2 mt-1">
              <v-chip size="small" variant="outlined" color="info">
                {{ connectionConfig.usernameEnvKey || 'JIRA_USERNAME' }}
              </v-chip>
            </v-list-item-subtitle>
          </v-list-item>

          <v-divider class="my-2"></v-divider>

          <v-list-item class="px-0 py-2">
            <template #prepend>
              <v-icon color="primary">mdi-key</v-icon>
            </template>
            <v-list-item-title>JIRA API Token (Environment Variable)</v-list-item-title>
            <v-list-item-subtitle class="text-body-2 mt-1">
              <v-chip size="small" variant="outlined" color="warning">
                {{ connectionConfig.tokenEnvKey || 'JIRA_API_TOKEN' }}
              </v-chip>
            </v-list-item-subtitle>
          </v-list-item>

          <v-divider class="my-2"></v-divider>

          <v-list-item class="px-0 py-2">
            <template #prepend>
              <v-icon color="primary">mdi-cog</v-icon>
            </template>
            <v-list-item-title>Configuration Status</v-list-item-title>
            <v-list-item-subtitle class="text-body-2 mt-1">
              <v-chip 
                size="small" 
                :color="connectionConfig.configured ? 'success' : 'error'"
                :variant="connectionConfig.configured ? 'tonal' : 'outlined'"
              >
                {{ connectionConfig.configured ? 'Configured' : 'Not Configured' }}
              </v-chip>
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>

        <!-- Connection Test -->
        <div class="mt-6">
          <v-divider class="mb-4"></v-divider>
          <div class="d-flex align-center justify-space-between mb-3">
            <h6 class="text-h6">接続テスト</h6>
            <v-btn
              color="primary"
              :loading="testingConnection"
              :disabled="!connectionConfig?.configured"
              @click="handleTestConnection"
            >
              <v-icon left>mdi-connection</v-icon>
              テスト実行
            </v-btn>
          </div>
          
          <!-- Test Results -->
          <v-alert
            v-if="testResult"
            :type="testResult.success ? 'success' : 'error'"
            variant="tonal"
            class="mb-4"
          >
            <v-alert-title>
              {{ testResult.success ? '接続成功' : '接続失敗' }}
            </v-alert-title>
            <div class="mt-2">
              {{ testResult.message }}
              <div v-if="testResult.testedAt" class="text-caption mt-1">
                テスト実行: {{ formatDateTime(testResult.testedAt) }}
              </div>
            </div>
          </v-alert>
        </div>

        <!-- Info Notice -->
        <v-alert
          type="info"
          variant="tonal"
          icon="mdi-information"
          class="mt-4"
        >
          These settings are configured in the application configuration file and environment variables. 
          Contact your system administrator to modify these values.
        </v-alert>
      </div>
      
      <div v-else>
        <v-skeleton-loader
          type="list-item-avatar@4"
          class="mb-4"
        ></v-skeleton-loader>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useErrorNotification } from '@/composables/useErrorNotification'
import { jiraService } from '@/services/domains/jira.service'
import apiClient from '@/services/core/api.client'
import type { 
  JiraConnectionStatus 
} from '@/services/types/jira.types'

interface Emits {
  (e: 'statusUpdated', status: JiraConnectionStatus): void
}

interface TestResult {
  success: boolean
  message: string
  testedAt: string
}

const emit = defineEmits<Emits>()

const { t: $t } = useI18n()
const { showErrorNotification, showSuccessNotification } = useErrorNotification()

const connectionStatus = ref<JiraConnectionStatus | null>(null)
const connectionConfig = ref<any>(null)
const testingConnection = ref(false)
const testResult = ref<TestResult | null>(null)

// Connection Status Computed Properties
const connectionStatusType = computed(() => {
  if (!connectionStatus.value) return 'info'
  if (connectionStatus.value.success) return 'success'
  if (connectionStatus.value.error) return 'error'
  return 'warning'
})

const connectionStatusIcon = computed(() => {
  if (!connectionStatus.value) return 'mdi-help-circle'
  if (connectionStatus.value.success) return 'mdi-check-circle'
  if (connectionStatus.value.error) return 'mdi-alert-circle'
  return 'mdi-alert'
})

const connectionStatusMessage = computed(() => {
  if (!connectionStatus.value) {
    return $t('jira.status.disconnected')
  }
  
  if (connectionStatus.value.success) {
    return $t('jira.status.connected')
  }
  
  if (connectionStatus.value.error) {
    return `${$t('jira.status.error')}: ${connectionStatus.value.error}`
  }
  
  return $t('jira.status.disconnected')
})

// Utility Functions
function formatDateTime(dateTime: string): string {
  return new Date(dateTime).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// API Functions
async function loadConnectionStatus() {
  try {
    connectionStatus.value = await jiraService.getConnectionStatus(false)
    emit('statusUpdated', connectionStatus.value)
  } catch (error) {
    console.error('Failed to load connection status:', error)
    showErrorNotification(error as Error, {
      title: $t('jira.messages.connectionStatusUpdated')
    })
  }
}

async function loadConnectionConfig() {
  try {
    // Load connection configuration from the backend
    const config = await jiraService.getConnectionConfig(false)
    
    // Set configuration data using actual backend response
    connectionConfig.value = {
      baseUrl: config.jiraUrl || 'Not configured',
      usernameEnvKey: config.usernameEnvKey || 'JIRA_USERNAME',
      tokenEnvKey: config.tokenEnvKey || 'JIRA_API_TOKEN', 
      configured: config.isConfigured || false
    }
  } catch (error) {
    console.error('Failed to load connection config:', error)
    // Set default configuration even if loading fails
    connectionConfig.value = {
      baseUrl: 'Not configured',
      usernameEnvKey: 'JIRA_USERNAME', 
      tokenEnvKey: 'JIRA_API_TOKEN',
      configured: false
    }
  }
}

// Connection Test
async function handleTestConnection() {
  testingConnection.value = true
  testResult.value = null
  
  try {
    // Use the connection test endpoint (no request body needed)
    const response = await apiClient.post(`/jira/connection/test`)
    const result = response.data
    
    testResult.value = {
      success: result.success,
      message: result.success 
        ? 'JIRA接続が正常に確認されました' 
        : `接続に失敗しました: ${result.message || 'Unknown error'}`,
      testedAt: new Date().toISOString()
    }
    
    if (result.success) {
      showSuccessNotification('JIRA接続テストが成功しました')
    } else {
      showErrorNotification(`接続テストに失敗しました: ${result.message || 'Unknown error'}`)
    }
    
  } catch (error: any) {
    console.error('Connection test failed:', error)
    const errorMessage = error.response?.data?.message || error.message || 'Unknown error'
    testResult.value = {
      success: false,
      message: `接続テストでエラーが発生しました: ${errorMessage}`,
      testedAt: new Date().toISOString()
    }
    showErrorNotification(error as Error)
  } finally {
    testingConnection.value = false
  }
}

// Lifecycle
onMounted(async () => {
  await loadConnectionStatus()
  await loadConnectionConfig()
})
</script>

<style scoped>
.v-card-title {
  background-color: rgb(var(--v-theme-surface-variant));
}

.mdi-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

:deep(.v-alert) {
  border-radius: 8px;
}

:deep(.v-text-field .v-field) {
  border-radius: 8px;
}
</style>