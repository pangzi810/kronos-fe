<template>
  <v-container fluid>
    <!-- Loading indicator -->
    <v-progress-linear
      v-if="loading"
      indeterminate
      color="primary"
      class="mb-4"
    />

    <!-- Header with actions -->
    <v-card class="mb-4">
      <v-card-title class="d-flex align-center justify-space-between">
        <div class="d-flex align-center">
          <v-icon class="mr-2" color="primary">mdi-database-search</v-icon>
          <span>{{ $t('jira.queries.title') }}</span>
          <v-chip
            v-if="queries.length > 0"
            color="primary"
            size="small"
            class="ml-2"
          >
            {{ queries.length }}件
          </v-chip>
        </div>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          @click="openCreateDialog"
        >
          {{ $t('jira.queries.create') }}
        </v-btn>
      </v-card-title>

      <v-divider />

      <!-- Search and filters -->
      <v-card-text>
        <v-row>
          <v-col cols="12" md="8">
            <v-text-field
              v-model="searchQuery"
              prepend-inner-icon="mdi-magnify"
              :label="$t('jira.queries.search')"
              variant="outlined"
              density="compact"
              clearable
              hide-details
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-select
              v-model="statusFilter"
              :items="statusOptions"
              :label="$t('common.status')"
              variant="outlined"
              density="compact"
              clearable
              hide-details
            />
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- No data alert -->
    <v-alert
      v-if="!loading && filteredQueries.length === 0 && queries.length === 0"
      type="info"
      variant="tonal"
      class="mb-4"
    >
      <v-icon start>mdi-information-outline</v-icon>
      {{ $t('jira.queries.noQueries') }}
    </v-alert>

    <!-- No search results alert -->
    <v-alert
      v-else-if="!loading && filteredQueries.length === 0 && queries.length > 0"
      type="info"
      variant="tonal"
      class="mb-4"
    >
      <v-icon start>mdi-filter-variant</v-icon>
      {{ $t('jira.queries.noSearchResults') }}
    </v-alert>

    <!-- Queries data table -->
    <v-card v-else-if="!loading">
      <v-data-table
        :headers="headers"
        :items="filteredQueries"
        :items-per-page="10"
        hover
        class="elevation-0"
        item-key="id"
        :sort-by="[{ key: 'priority', order: 'asc' }]"
      >
        <!-- Query name column -->
        <template #item.queryName="{ item }">
          <div class="d-flex align-center">
            <v-icon 
              size="small" 
              class="mr-2"
              :color="item.active ? 'success' : 'grey'"
            >
              mdi-database-search
            </v-icon>
            <div>
              <div class="font-weight-medium">{{ item.queryName }}</div>
            </div>
          </div>
        </template>

        <!-- Status column -->
        <template #item.active="{ item }">
          <v-switch
            :model-value="item.active"
            color="success"
            density="compact"
            hide-details
            @update:model-value="toggleQueryStatus(item)"
          />
        </template>

        <!-- Priority column -->
        <template #item.priority="{ item }">
          <v-chip
            size="small"
            :color="getPriorityColor(item.priority)"
            variant="flat"
          >
            <v-icon start size="x-small">mdi-numeric</v-icon>
            {{ item.priority }}
          </v-chip>
        </template>

        <!-- Created date column -->
        <template #item.createdAt="{ item }">
          <div class="text-body-2">{{ formatDate(item.createdAt) }}</div>
          <div class="text-caption text-medium-emphasis">
            {{ $t('common.by') }} {{ item.createdBy }}
          </div>
        </template>

        <!-- Actions column -->
        <template #item.actions="{ item }">
          <div class="d-flex gap-2">
            <v-tooltip :text="$t('jira.queries.validate')" location="top">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-check-circle"
                  size="small"
                  variant="text"
                  :loading="validatingQueries.has(item.id)"
                  @click="validateQuery(item)"
                />
              </template>
            </v-tooltip>

            <v-tooltip :text="$t('common.edit')" location="top">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-pencil"
                  size="small"
                  variant="text"
                  @click="openEditDialog(item)"
                />
              </template>
            </v-tooltip>

            <v-tooltip :text="$t('common.delete')" location="top">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-delete"
                  size="small"
                  variant="text"
                  color="error"
                  @click="confirmDelete(item)"
                />
              </template>
            </v-tooltip>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- Query Form Dialog -->
    <v-dialog v-model="showQueryDialog" max-width="800px" persistent>
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon class="mr-2">{{ editingQuery ? 'mdi-pencil' : 'mdi-plus' }}</v-icon>
          {{ editingQuery ? $t('jira.queries.edit') : $t('jira.queries.create') }}
        </v-card-title>

        <v-divider />

        <v-card-text>
          <v-form ref="queryFormRef" v-model="queryFormValid">
            <v-row>
              <v-col cols="12" md="8">
                <v-text-field
                  v-model="queryForm.queryName"
                  :label="$t('jira.queries.queryName')"
                  :rules="[rules.required, rules.maxLength(100)]"
                  variant="outlined"
                  required
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="queryForm.priority"
                  :label="$t('jira.queries.priority')"
                  type="number"
                  min="1"
                  max="999"
                  :rules="[rules.required, rules.minValue(1)]"
                  variant="outlined"
                  required
                />
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12">
                <v-textarea
                  v-model="queryForm.jqlExpression"
                  :label="$t('jira.queries.jqlExpression')"
                  :rules="[rules.required]"
                  variant="outlined"
                  rows="4"
                  required
                  @blur="validateJqlSyntax"
                />
                <!-- JQL Validation feedback -->
                <div v-if="jqlValidation" class="mt-2">
                  <v-alert
                    v-if="!jqlValidation.valid && jqlValidation.errorMessage"
                    type="error"
                    density="compact"
                    variant="tonal"
                  >
                    <div class="font-weight-medium mb-1">
                      {{ $t('jira.queries.validationErrors') }}
                    </div>
                    <div class="pl-4">
                      {{ jqlValidation.errorMessage }}
                    </div>
                  </v-alert>
                  <v-alert
                    v-else
                    type="success"
                    density="compact"
                    variant="tonal"
                  >
                    {{ $t('jira.queries.validationSuccess') }}
                    <span v-if="jqlValidation.matchingProjectCount">
                      ({{ $t('jira.queries.estimatedResults', { count: jqlValidation.matchingProjectCount }) }})
                    </span>
                  </v-alert>
                </div>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="queryForm.templateId"
                  :items="templateSelectOptions"
                  :label="$t('jira.templates.select')"
                  variant="outlined"
                  clearable
                  :loading="templatesLoading"
                >
                  <template #item="{ props, item }">
                    <v-list-item v-bind="props">
                      <template #prepend>
                        <v-icon>mdi-file-document-outline</v-icon>
                      </template>
                      <v-list-item-title>{{ item.title }}</v-list-item-title>
                    </v-list-item>
                  </template>
                </v-select>
              </v-col>
              <v-col cols="12" md="6">
                <v-switch
                  v-model="queryForm.isActive"
                  :label="$t('jira.queries.isActive')"
                  color="success"
                />
              </v-col>
            </v-row>

          </v-form>
        </v-card-text>

        <v-divider />

        <v-card-actions>
          <v-spacer />
          <v-btn @click="closeQueryDialog">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :loading="saving"
            :disabled="!queryFormValid || (jqlValidation !== null && !jqlValidation.valid)"
            @click="saveQuery"
          >
            {{ $t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="500px">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon class="mr-2" color="error">mdi-delete</v-icon>
          {{ $t('jira.queries.deleteConfirm') }}
        </v-card-title>

        <v-card-text>
          <div class="text-body-1 mb-3">
            {{ $t('jira.queries.deleteMessage', { name: deletingQuery?.queryName }) }}
          </div>
          <v-alert type="warning" density="compact" variant="tonal">
            {{ $t('jira.queries.deleteWarning') }}
          </v-alert>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn @click="handleCloseDeleteDialog">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="error"
            :loading="deleting"
            @click="deleteQuery"
          >
            {{ $t('common.delete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useJqlQueryManager } from '@/composables/useJqlQueryManager'

// Use the composable
const {
  // State
  loading,
  queries,
  templatesLoading,
  searchQuery,
  statusFilter,

  // Dialog states
  showQueryDialog,
  showDeleteDialog,
  editingQuery,
  deletingQuery,

  // Form data
  queryFormRef,
  queryFormValid,
  queryForm,
  jqlValidation,
  validatingQueries,
  saving,
  deleting,

  // Validation rules
  rules,

  // Computed
  headers,
  filteredQueries,
  statusOptions,
  templateSelectOptions,

  // Data loading
  loadData,

  // Dialog management
  openCreateDialog,
  openEditDialog,
  closeQueryDialog,
  confirmDelete,

  // Query operations
  saveQuery,
  deleteQuery,
  toggleQueryStatus,

  // Validation
  validateJqlSyntax,
  validateQuery,

  // Utilities
  getPriorityColor,
  formatDate
} = useJqlQueryManager()

// Load data on component mount
onMounted(() => {
  loadData()
})

// Event handlers for dialogs
const handleCloseDeleteDialog = () => {
  showDeleteDialog.value = false
}
</script>

<style scoped>
.jql-preview {
  font-family: 'Roboto Mono', monospace;
  font-size: 0.85rem;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: help;
}

.v-data-table {
  font-size: 0.875rem;
}

/* Make the JQL expression column more readable */
.jql-preview {
  background: rgba(0, 0, 0, 0.05);
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}
</style>