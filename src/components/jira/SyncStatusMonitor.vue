<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <v-icon class="mr-2">mdi-pulse</v-icon>
      {{ $t('jira.sync.status.title') }}
      <v-spacer />
      <v-btn
        variant="text"
        size="small"
        :loading="loading"
        @click="refresh"
      >
        <v-icon>mdi-refresh</v-icon>
      </v-btn>
    </v-card-title>

    <v-card-text>
      <!-- No Active Sync -->
      <div v-if="!currentSync && !loading" class="text-center py-4">
        <v-icon size="48" class="mb-2 text-medium-emphasis">
          mdi-check-circle-outline
        </v-icon>
        <p class="text-body-1 text-medium-emphasis">
          {{ $t('jira.sync.status.noActive') }}
        </p>
        
        <!-- Last Sync Info -->
        <div v-if="syncStats" class="mt-4">
          <v-divider class="my-3" />
          <div class="d-flex justify-space-between align-center">
            <span class="text-body-2 text-medium-emphasis">
              {{ $t('jira.sync.status.lastSync') }}:
            </span>
            <span class="text-body-2">
              {{ formatLastSyncTime(syncStats.lastSyncAt) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Active Sync -->
      <div v-else-if="currentSync" class="py-2">
        <!-- Sync Status Header -->
        <div class="d-flex align-center justify-space-between mb-3">
          <div class="d-flex align-center">
            <v-chip 
              :color="getStatusColor(currentSync.status)"
              size="small"
              class="mr-2"
            >
              <v-icon size="14" class="mr-1">
                {{ getStatusIcon(currentSync.status) }}
              </v-icon>
              {{ $t(`jira.sync.status.${currentSync.status.toLowerCase()}`) }}
            </v-chip>
            <span class="text-body-2 text-medium-emphasis">
              {{ currentSync.syncId }}
            </span>
          </div>
          
          <!-- Cancel Button for In Progress Sync -->
          <v-btn
            v-if="currentSync.status === 'IN_PROGRESS'"
            variant="outlined"
            color="error"
            size="small"
            @click="cancelSync"
            :loading="cancelling"
          >
            {{ $t('jira.sync.trigger.cancel') }}
          </v-btn>
        </div>

        <!-- Progress Information -->
        <div v-if="currentSync.status === 'IN_PROGRESS'">
          <!-- Current Step -->
          <div class="mb-2">
            <div class="d-flex justify-space-between align-center mb-1">
              <span class="text-body-2 font-weight-medium">
                {{ $t('jira.sync.status.step') }}
              </span>
              <span class="text-body-2 text-medium-emphasis">
                {{ currentSync.currentStep }}
              </span>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="mb-3">
            <div class="d-flex justify-space-between align-center mb-1">
              <span class="text-body-2 font-weight-medium">
                {{ $t('jira.sync.status.progress') }}
              </span>
              <span class="text-body-2">
                {{ currentSync.progressPercentage.toFixed(1) }}%
              </span>
            </div>
            <v-progress-linear
              :model-value="currentSync.progressPercentage"
              color="primary"
              height="8"
              rounded
            />
          </div>

          <!-- Queries Progress -->
          <div class="mb-3">
            <div class="d-flex justify-space-between align-center mb-1">
              <span class="text-body-2 font-weight-medium">
                {{ $t('jira.sync.status.queries') }}
              </span>
              <span class="text-body-2">
                {{ currentSync.processedQueries }} / {{ currentSync.totalQueries }}
              </span>
            </div>
            <v-progress-linear
              :model-value="(currentSync.processedQueries / Math.max(currentSync.totalQueries, 1)) * 100"
              color="info"
              height="6"
              rounded
            />
          </div>

          <!-- Time Information -->
          <div class="d-flex justify-space-between align-center text-body-2 text-medium-emphasis">
            <div>
              <span>{{ $t('jira.sync.status.elapsed') }}:</span>
              <span class="ml-1">{{ formatElapsedTime(currentSync.startedAt) }}</span>
            </div>
            <div v-if="currentSync.estimatedRemainingTime">
              <span>{{ $t('jira.sync.status.remaining') }}:</span>
              <span class="ml-1">{{ formatDuration(currentSync.estimatedRemainingTime) }}</span>
            </div>
          </div>
        </div>

        <!-- Completed/Failed Sync Summary -->
        <div v-else-if="['COMPLETED', 'FAILED'].includes(currentSync.status)">
          <div class="d-flex justify-space-between align-center text-body-2">
            <div>
              <span class="font-weight-medium">{{ $t('jira.sync.status.queries') }}:</span>
              <span class="ml-1">{{ currentSync.processedQueries }} / {{ currentSync.totalQueries }}</span>
            </div>
            <div>
              <span class="font-weight-medium">{{ $t('jira.sync.status.elapsed') }}:</span>
              <span class="ml-1">{{ formatElapsedTime(currentSync.startedAt) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-else class="text-center py-4">
        <v-progress-circular indeterminate color="primary" />
        <p class="text-body-2 text-medium-emphasis mt-2">
          {{ $t('common.loading') }}
        </p>
      </div>

      <!-- Connection Health -->
      <div v-if="syncStats && !loading" class="mt-4">
        <v-divider class="mb-3" />
        <div class="d-flex justify-space-between align-center">
          <span class="text-body-2 font-weight-medium">
            {{ $t('jira.sync.status.connectionHealth') }}
          </span>
          <v-chip 
            :color="syncStats.runningsyncs > 0 ? 'success' : 'default'"
            size="small"
          >
            {{ syncStats.runningsyncs > 0 ? 'Active' : 'Idle' }}
          </v-chip>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useSyncStatusMonitor } from '@/composables/useSyncStatusMonitor'

// Emits
const emit = defineEmits<{
  refresh: []
  syncStarted: [syncId: string]
  syncCompleted: [syncId: string, success: boolean]
}>()

// Use the composable
const {
  // State
  loading,
  cancelling,
  currentSync,
  syncStats,

  // Actions
  refresh,
  cancelSync,
  startMonitoring,

  // Utilities
  getStatusColor,
  getStatusIcon,
  formatElapsedTime,
  formatDuration,
  formatLastSyncTime
} = useSyncStatusMonitor({
  refresh: () => emit('refresh'),
  syncStarted: (syncId: string) => emit('syncStarted', syncId),
  syncCompleted: (syncId: string, success: boolean) => emit('syncCompleted', syncId, success)
})

// Start monitoring on component mount
onMounted(() => {
  startMonitoring()
})
</script>

<style scoped>
.v-progress-linear {
  border-radius: 4px;
}

.v-chip {
  font-weight: 500;
}
</style>