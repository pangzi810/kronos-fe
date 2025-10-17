<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <v-icon class="mr-2">mdi-play-circle</v-icon>
      {{ $t('jira.sync.trigger.title') }}
    </v-card-title>

    <v-card-text>
      <!-- Trigger Button -->
      <div class="text-center mb-4">
        <v-btn
          color="primary"
          size="large"
          :loading="triggering"
          :disabled="isAnySyncRunning"
          @click="handleOpenDialog"
        >
          <v-icon class="mr-2">
            {{ isAnySyncRunning ? 'mdi-sync' : 'mdi-play' }}
          </v-icon>
          {{ isAnySyncRunning ? $t('jira.sync.trigger.buttonRunning') : $t('jira.sync.trigger.button') }}
        </v-btn>
        
        <p v-if="isAnySyncRunning" class="text-caption text-medium-emphasis mt-2">
          {{ $t('jira.sync.trigger.alreadyRunning') }}
        </p>
      </div>

      <!-- Quick Stats -->
      <div v-if="syncStats" class="mt-4">
        <v-divider class="mb-3" />
        <div class="d-flex justify-space-around text-center">
          <div>
            <div class="text-h6 text-primary">{{ syncStats.totalSyncs }}</div>
            <div class="text-caption text-medium-emphasis">{{ $t('jira.sync.stats.totalSyncs') }}</div>
          </div>
          <div>
            <div class="text-h6 text-success">{{ syncStats.successfulSyncs }}</div>
            <div class="text-caption text-medium-emphasis">{{ $t('jira.sync.stats.successfulSyncs') }}</div>
          </div>
          <div>
            <div class="text-h6 text-error">{{ syncStats.failedSyncs }}</div>
            <div class="text-caption text-medium-emphasis">{{ $t('jira.sync.stats.failedSyncs') }}</div>
          </div>
        </div>
      </div>
    </v-card-text>

    <!-- Manual Sync Configuration Dialog -->
    <v-dialog
      v-model="showTriggerDialog"
      max-width="600"
      persistent
    >
      <v-card>
        <v-card-title>
          <span class="text-h5">{{ $t('jira.sync.trigger.title') }}</span>
        </v-card-title>

        <v-card-text>
          <v-form ref="triggerForm" @submit.prevent="triggerSync">
            <!-- Confirmation Message -->
            <v-alert
              type="info"
              variant="tonal"
              class="mb-4"
            >
              <div class="font-weight-medium">{{ $t('jira.sync.trigger.confirm') }}</div>
              <div class="text-body-2 mt-1">{{ $t('jira.sync.trigger.confirmMessage') }}</div>
            </v-alert>

            <!-- Query Selection -->
            <div class="mb-4">
              <v-label class="text-subtitle-2 font-weight-medium mb-2">
                {{ $t('jira.sync.trigger.selectQueries') }}
              </v-label>
              
              <v-radio-group v-model="syncConfig.querySelection" density="compact">
                <v-radio
                  :label="$t('jira.sync.trigger.allQueries')"
                  value="all"
                />
                <v-radio
                  :label="$t('jira.sync.trigger.selectedQueries')"
                  value="selected"
                />
              </v-radio-group>

              <!-- Query List (when selected) -->
              <div v-if="syncConfig.querySelection === 'selected'" class="ml-4">
                <v-chip-group
                  v-model="syncConfig.selectedQueryIds"
                  multiple
                  column
                  mandatory
                  class="mb-2"
                >
                  <v-chip
                    v-for="query in availableQueries"
                    :key="query.id"
                    :value="query.id"
                    filter
                    variant="outlined"
                    size="small"
                  >
                    {{ query.queryName }}
                  </v-chip>
                </v-chip-group>
                
                <p v-if="availableQueries.length === 0" class="text-body-2 text-medium-emphasis">
                  {{ $t('jira.sync.trigger.noQueries') }}
                </p>
              </div>
            </div>

            <!-- Priority Selection -->
            <div class="mb-4">
              <v-label class="text-subtitle-2 font-weight-medium mb-2">
                {{ $t('jira.sync.trigger.priority') }}
              </v-label>
              <v-select
                v-model="syncConfig.priority"
                :items="priorityOptions"
                density="compact"
                variant="outlined"
              />
            </div>

            <!-- Notes -->
            <div class="mb-4">
              <v-label class="text-subtitle-2 font-weight-medium mb-2">
                {{ $t('jira.sync.trigger.notes') }}
              </v-label>
              <v-textarea
                v-model="syncConfig.notes"
                :placeholder="$t('jira.sync.trigger.notesPlaceholder')"
                variant="outlined"
                rows="3"
                density="compact"
                auto-grow
              />
            </div>
          </v-form>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="outlined"
            @click="closeTriggerDialog"
            :disabled="triggering"
          >
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :loading="triggering"
            @click="triggerSync"
          >
            {{ $t('jira.sync.trigger.button') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useManualSyncTrigger } from '@/composables/useManualSyncTrigger'

// Emits
const emit = defineEmits<{
  syncStarted: [syncId: string]
  syncCompleted: [syncId: string, success: boolean]
}>()

// Use the composable
const {
  // Refs
  triggerForm,

  // State
  showTriggerDialog,
  triggering,
  isAnySyncRunning,
  syncStats,
  availableQueries,
  syncConfig,

  // Computed
  priorityOptions,

  // Actions
  triggerSync,
  closeTriggerDialog,
  openTriggerDialog,
  startMonitoring
} = useManualSyncTrigger({
  syncStarted: (syncId: string) => emit('syncStarted', syncId),
  syncCompleted: (syncId: string, success: boolean) => emit('syncCompleted', syncId, success)
})

// Event handler to open dialog
const handleOpenDialog = () => {
  showTriggerDialog.value = true
}

// Start monitoring on component mount
onMounted(() => {
  startMonitoring()
})
</script>

<style scoped>
.v-btn--size-large {
  min-height: 48px;
  padding: 0 24px;
}

.v-chip-group {
  max-height: 200px;
  overflow-y: auto;
}

.text-h6 {
  font-weight: 600;
}
</style>