<template>
  <div class="jira-settings">
    <!-- Page Header -->
    <div class="d-flex flex-column flex-sm-row align-start align-sm-center justify-space-between mb-6">
      <div>
        <h1 class="text-h4 font-weight-bold mb-2">
          <v-icon class="me-3" color="primary">mdi-api</v-icon>
          {{ $t('jira.title') }}
        </h1>
        <p class="text-body-1 text-medium-emphasis mb-0">
          {{ $t('jira.description') }}
        </p>
      </div>

      <!-- Quick Status Indicator -->
      <v-chip
        :color="statusChipColor"
        :prepend-icon="statusChipIcon"
        variant="tonal"
        size="large"
      >
        {{ statusChipText }}
      </v-chip>
    </div>

    <!-- Main Content -->
    <v-row>
      <v-col cols="12" lg="12">
        <!-- Connection Settings Card -->
        <jira-connection-settings
          @status-updated="handleStatusUpdated"
          @configuration-saved="handleConfigurationSaved"
        />
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useErrorNotification } from '@/composables/useErrorNotification'
import { jiraService } from '@/services/domains/jira.service'
import JiraConnectionSettings from '@/components/jira/JiraConnectionSettings.vue'
import type {
  JiraConnectionStatus,
  JiraConnectionConfig
} from '@/services/types/jira.types'

const { t: $t } = useI18n()
const {
  showErrorNotification,
  showInfoNotification
} = useErrorNotification()

const connectionStatus = ref<JiraConnectionStatus | null>(null)

// Computed Properties
const statusChipColor = computed(() => {
  if (!connectionStatus.value) return 'default'
  return connectionStatus.value.success ? 'success' : 'error'
})

const statusChipIcon = computed(() => {
  if (!connectionStatus.value) return 'mdi-help-circle'
  return connectionStatus.value.success ? 'mdi-check-circle' : 'mdi-alert-circle'
})

const statusChipText = computed(() => {
  if (!connectionStatus.value) return $t('jira.status.dissuccess')
  return connectionStatus.value.success ? $t('jira.status.success') : $t('jira.status.dissuccess')
})

// Event Handlers
function handleStatusUpdated(status: JiraConnectionStatus) {
  connectionStatus.value = status
}

function handleConfigurationSaved(_config: JiraConnectionConfig) {
  showInfoNotification($t('jira.messages.settingsSaved'))
}


// Lifecycle
onMounted(async () => {
  try {
    connectionStatus.value = await jiraService.getConnectionStatus()
  } catch (error) {
    console.error('Failed to load initial connection status:', error)
    showErrorNotification($t('jira.messages.configurationRequired'))
  }
})
</script>

<style scoped>
.jira-settings {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.v-card-title {
  background-color: rgb(var(--v-theme-surface-variant));
}

:deep(.v-list-item) {
  border-radius: 8px;
  margin-bottom: 4px;
}

:deep(.v-list-item:hover) {
  background-color: rgba(var(--v-theme-primary), 0.1);
}

:deep(.v-chip) {
  font-weight: 600;
}

@media (max-width: 960px) {
  .jira-settings {
    padding: 16px;
  }
}
</style>