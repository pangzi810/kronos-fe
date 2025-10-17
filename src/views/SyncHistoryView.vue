<template>
  <v-container fluid class="pa-6">
    <!-- Header -->
    <v-row>
      <v-col cols="12">
        <div class="d-flex align-center justify-space-between mb-4">
          <div>
            <h2 class="text-h4 mb-2">{{ $t('jira.sync.title') }}</h2>
            <p class="text-body-1 text-medium-emphasis">
              {{ $t('jira.sync.description') }}
            </p>
          </div>
        </div>
      </v-col>
    </v-row>

    <!-- History Section -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-history</v-icon>
            {{ $t('jira.sync.history.title') }}
          </v-card-title>
          <v-card-text>
            <SyncHistoryViewer 
              :refreshTrigger="historyRefreshTrigger"
              @refresh="handleRefresh"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <v-row class="mb-4">
      <v-col>
        <ManualSyncTrigger 
          @sync-started="handleSyncStarted"
          @sync-completed="handleSyncCompleted"
        />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useErrorNotification } from '@/composables/useErrorNotification'
import SyncStatusMonitor from '@/components/jira/SyncStatusMonitor.vue'
import ManualSyncTrigger from '@/components/jira/ManualSyncTrigger.vue'
import SyncHistoryViewer from '@/components/jira/SyncHistoryViewer.vue'
import jiraSyncService from '@/services/domains/jira-sync.service'

const { t: $t } = useI18n()
const { showSuccessNotification, showErrorNotification } = useErrorNotification()

// State
const refreshing = ref(false)
const historyRefreshTrigger = ref(0)

/**
 * Refresh all components
 */
async function handleRefresh() {
  if (refreshing.value) return

  refreshing.value = true
  try {
    // Trigger refresh for all child components
    historyRefreshTrigger.value++
    
    showSuccessNotification($t('jira.sync.messages.refreshing'))
  } catch (error) {
    console.error('Error refreshing sync data:', error)
    showErrorNotification(error as Error)
  } finally {
    refreshing.value = false
  }
}

/**
 * Handle sync start event from child components
 */
function handleSyncStarted(syncId: string) {
  console.log('Sync started:', syncId)
  // Success notification is already shown by useJiraSync composable

  // Refresh history to show the new sync entry
  historyRefreshTrigger.value++
}

/**
 * Handle sync completion event from child components
 */
function handleSyncCompleted(syncId: string, success: boolean) {
  console.log('Sync completed:', syncId, success)
  
  if (success) {
    showSuccessNotification($t('jira.sync.messages.syncCompleted'))
  } else {
    showErrorNotification($t('jira.sync.messages.syncFailed'))
  }
  
  // Refresh history to show updated sync status
  historyRefreshTrigger.value++
}

// Lifecycle
onMounted(() => {
  // Initial load handled by child components
})

onUnmounted(() => {
  // Cleanup any polling operations
  jiraSyncService.stopAllStatusPolling()
})
</script>

<style scoped>
.gap-3 {
  gap: 12px;
}
</style>