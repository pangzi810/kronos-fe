<template>
  <div>
    <!-- History Table -->
    <v-data-table-server
      v-model:items-per-page="pagination.pageSize"
      v-model:page="pagination.page"
      :headers="headers"
      :items="history"
      :items-length="totalItems"
      :loading="loading"
      :no-data-text="$t('jira.sync.history.noHistory')"
      item-key="id"
      hover
      @update:options="loadHistory"
      @click:row="handleRowClick"
    >
      <!-- Status Column -->
      <template #item.syncStatus="{ item }">
        <v-chip
          :color="getStatusColor(item.syncStatus)"
          size="small"
          :prepend-icon="getStatusIcon(item.syncStatus)"
        >
          {{ $t(`jira.sync.status.${item.syncStatus.toLowerCase()}`) }}
        </v-chip>
      </template>

      <!-- Type Column -->
      <template #item.syncType="{ item }">
        <span class="text-body-2">
          {{ $t(`jira.sync.types.${item.syncType}`) }}
        </span>
      </template>

      <!-- Started At Column -->
      <template #item.startedAt="{ item }">
        <div class="text-body-2">
          <div>{{ formatDateTime(item.startedAt) }}</div>
          <div class="text-caption text-medium-emphasis">
            {{ formatRelativeTime(item.startedAt) }}
          </div>
        </div>
      </template>

      <!-- Duration Column -->
      <template #item.duration="{ item }">
        <span class="text-body-2">
          {{ formatDuration(item.durationMinutes * 60000) }}
        </span>
      </template>

      <!-- Results Summary Column -->
      <template #item.results="{ item }">
        <div class="text-body-2">
          <div class="d-flex align-center">
            <v-icon size="14" color="success" class="mr-1">mdi-plus-circle</v-icon>
            <span class="text-success mr-2">{{ item.successCount || 0 }}</span>
            <v-icon size="14" color="info" class="mr-1">mdi-pencil-circle</v-icon>
            <span class="text-info mr-2">{{ item.totalProjectsProcessed || 0 }}</span>
            <v-icon size="14" color="warning" class="mr-1">mdi-minus-circle</v-icon>
            <span class="text-warning">{{ (item.totalProjectsProcessed || 0) - (item.successCount || 0) - (item.errorCount || 0) }}</span>
          </div>
          <div v-if="(item.errorCount || 0) > 0" class="d-flex align-center mt-1">
            <v-icon size="14" color="error" class="mr-1">mdi-alert-circle</v-icon>
            <span class="text-error">{{ item.errorCount }} {{ $t('jira.sync.details.errors') }}</span>
          </div>
        </div>
      </template>

    </v-data-table-server>

    <!-- Details Dialog -->
    <v-dialog
      v-model="showDetailsDialog"
      max-width="800"
      scrollable
    >
      <v-card v-if="selectedHistory">
        <v-card-title class="d-flex align-center">
          <span>{{ $t('jira.sync.details.syncId') }}: {{ selectedHistory.syncHistoryId }}</span>
          <v-spacer />
          <v-btn
            variant="text"
            icon="mdi-close"
            @click="handleCloseDialog"
          />
        </v-card-title>

        <v-card-text>
          <v-row>
            <!-- Basic Information -->
            <v-col cols="12" md="6">
              <v-list density="compact">
                <v-list-subheader>{{ $t('common.info') }}</v-list-subheader>
                
                <v-list-item>
                  <template #prepend>
                    <v-icon>mdi-tag</v-icon>
                  </template>
                  <v-list-item-title>{{ $t('jira.sync.details.type') }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ $t(`jira.sync.types.${selectedHistory.syncType}`) }}
                  </v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template #prepend>
                    <v-icon>mdi-clock-start</v-icon>
                  </template>
                  <v-list-item-title>{{ $t('jira.sync.details.startTime') }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ formatDateTime(selectedHistory.startedAt) }}
                  </v-list-item-subtitle>
                </v-list-item>

                <v-list-item v-if="selectedHistory.completedAt">
                  <template #prepend>
                    <v-icon>mdi-clock-end</v-icon>
                  </template>
                  <v-list-item-title>{{ $t('jira.sync.details.endTime') }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ formatDateTime(selectedHistory.completedAt) }}
                  </v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template #prepend>
                    <v-icon>mdi-timelapse</v-icon>
                  </template>
                  <v-list-item-title>{{ $t('jira.sync.details.duration') }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ formatDuration(selectedHistory.durationMinutes * 60000) }}
                  </v-list-item-subtitle>
                </v-list-item>

                <v-list-item v-if="selectedHistory.triggeredBy">
                  <template #prepend>
                    <v-icon>mdi-account</v-icon>
                  </template>
                  <v-list-item-title>{{ $t('jira.sync.details.triggeredBy') }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ selectedHistory.triggeredBy }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-col>

            <!-- Results Summary -->
            <v-col cols="12" md="6">
              <v-list density="compact">
                <v-list-subheader>{{ $t('jira.sync.details.projects') }}</v-list-subheader>
                
                <v-list-item>
                  <template #prepend>
                    <v-icon color="success">mdi-plus-circle</v-icon>
                  </template>
                  <v-list-item-title>{{ $t('jira.sync.details.created') }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ selectedHistory.successCount }} {{ $t('projects') }}
                  </v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template #prepend>
                    <v-icon color="info">mdi-pencil-circle</v-icon>
                  </template>
                  <v-list-item-title>{{ $t('jira.sync.details.updated') }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ selectedHistory.totalProjectsProcessed || 0 }} {{ $t('projects') }}
                  </v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template #prepend>
                    <v-icon color="warning">mdi-minus-circle</v-icon>
                  </template>
                  <v-list-item-title>{{ $t('jira.sync.details.skipped') }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ (selectedHistory.totalProjectsProcessed || 0) - (selectedHistory.successCount || 0) - (selectedHistory.errorCount || 0) }} {{ $t('projects') }}
                  </v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template #prepend>
                    <v-icon>mdi-database-search</v-icon>
                  </template>
                  <v-list-item-title>{{ $t('jira.sync.details.queries') }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ selectedHistory.totalProjectsProcessed || 0 }} processed
                  </v-list-item-subtitle>
                </v-list-item>

                <v-list-item v-if="(selectedHistory.errorCount || 0) > 0">
                  <template #prepend>
                    <v-icon color="error">mdi-alert-circle</v-icon>
                  </template>
                  <v-list-item-title>{{ $t('jira.sync.details.errors') }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ selectedHistory.errorCount }} {{ $t('jira.sync.details.errors') }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-col>
          </v-row>

          <!-- Error Details -->
          <div v-if="selectedHistory.errorDetails" class="mt-4">
            <v-divider class="mb-3" />
            <v-list-subheader>{{ $t('jira.sync.details.errorDetails') }}</v-list-subheader>
            <p class="text-body-2 ml-4">{{ selectedHistory.errorDetails }}</p>
          </div>

          <!-- Detailed Results -->
          <div v-if="historyDetails?.details && historyDetails.details.length > 0" class="mt-4">
            <v-divider class="mb-3" />
            <v-list-subheader>{{ $t('jira.sync.details.queryBreakdown') }}</v-list-subheader>
            
            <v-expansion-panels variant="accordion" class="mt-2">
              <v-expansion-panel
                v-for="detail in historyDetails.details.sort((a, b) => a.seq - b.seq)"
                :key="detail.detailId"
                :title="detail.processedAt + ': ' + detail.operation"
              >
                <v-expansion-panel-text>
                  <div v-if="!isJson(detail.result)" class="text-body-2 mb-2">
                    {{ detail.result }}
                  </div>
                  <VueJsonPretty
                    v-if="isJson(detail.result)"
                    :data="JSON.parse(detail.result)"
                    :show-double-quotes="true"
                    :show-length="true"
                    :show-line="true"
                    :show-line-number="true"
                    :expand-depth="3"
                    :collapsed-on-click-brackets="true"
                    :show-icon="true"
                  />
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="outlined"
            @click="handleCloseDialog"
          >
            {{ $t('common.close') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useSyncHistoryViewer } from '@/composables/useSyncHistoryViewer'
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'

// Props
interface Props {
  refreshTrigger?: number
}

const props = withDefaults(defineProps<Props>(), {
  refreshTrigger: 0
})

// Emits
const _emit = defineEmits<{
  refresh: []
}>()

// Use the composable
const {
  // State
  loading,
  history,
  totalItems,
  showDetailsDialog,
  selectedHistory,
  historyDetails,
  pagination,

  // Computed
  headers,

  // Actions
  loadHistory,
  showDetails,

  // Utilities
  getStatusColor,
  getStatusIcon,
  formatDateTime,
  formatRelativeTime,
  formatDuration
} = useSyncHistoryViewer()

// Event handlers with composable-specific functionality
const handleRowClick = (event: Event, { item }: { item: any }) => {
  showDetails(item)
}

const isJson = (str: string) => {
  try {
    const parsed = JSON.parse(str)
    if (parsed && typeof parsed === "object") {
      return true
    }
  } catch {
    return false
  }
  return false
}

const handleCloseDialog = () => {
  showDetailsDialog.value = false
}

// Watch for refresh trigger from parent
watch(() => props.refreshTrigger, () => {
  loadHistory()
})
</script>

<style scoped>
.v-data-table-server {
  background-color: transparent;
}

.v-data-table-server :deep(tbody tr) {
  cursor: pointer;
}

.v-expansion-panels {
  background-color: transparent;
}

.text-body-2 strong {
  font-weight: 600;
}
</style>