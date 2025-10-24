<template>
  <div :class="['work-hours-table-container', { 'approved': workRecordApproval?.approved }]">
    <!-- Header -->
    <div class="d-flex align-center justify-end mb-4">
      <v-btn
        color="primary"
        @click="handleSave"
        :disabled="!state.hasChanges || state.saving || workRecordApproval?.approved || hasValidationErrors"
        :loading="state.saving"
      >
        <v-icon start>mdi-content-save</v-icon>
        {{ workRecordApproval?.approved ? $t('workHours.alreadyApproved') : $t('common.save') }}
      </v-btn>
    </div>

    <v-alert type="error" variant="tonal" v-if="workRecordApproval?.rejected" class="mb-4">
      {{ $t('workHours.rejected') }}
      <div v-if="workRecordApproval" class="mt-2">
        <small>
          {{ $t('workHours.reason') }}: {{ workRecordApproval.rejectionReason }}
        </small>
      </div>
    </v-alert>

    <v-alert type="success" variant="tonal" v-if="workRecordApproval?.approved" class="mb-4">
      {{ $t('workHours.approvedStatus') }}
      <div v-if="state.approvalInfo" class="mt-2">
        <small>
          {{ $t('workHours.approvedDate') }}: {{ formatDate(workRecordApproval?.approvedAt) }}
        </small>
      </div>
    </v-alert>

    <!-- Validation Errors -->
    <v-alert 
      v-if="hasValidationErrors" 
      type="error" 
      variant="tonal" 
      class="mb-4"
    >
      <div class="font-weight-medium">{{ $t('errors.validationError') }}</div>
      <ul class="mt-2">
        <li v-for="error in validationErrors" :key="`${error.rowId}-${error.field}`">
          {{ error.message }}
        </li>
      </ul>
    </v-alert>

    <!-- Mobile: List View (xs, sm) -->
    <div v-if="isMobile" class="mobile-work-hours-list">
      <v-list v-if="!loading && tableData.length > 0">
        <v-list-item
          v-for="item in tableData"
          :key="item.id"
          @click="openMobileDialog(item)"
          class="mobile-list-item"
        >
          <template v-slot:prepend>
            <v-icon>mdi-folder</v-icon>
          </template>
          <v-list-item-title v-if="item.project">
            {{ item.project.jiraIssueKey }} {{ item.project.name }}
          </v-list-item-title>
          <v-list-item-subtitle v-if="item.project">
            {{ $t('common.total') }}: {{ item.total }}h
          </v-list-item-subtitle>
          <template v-slot:append>
            <v-btn
              icon="mdi-delete"
              size="small"
              variant="text"
              color="error"
              @click.stop="removeProjectRow(item.id)"
              :disabled="workRecordApproval?.approved"
            />
          </template>
        </v-list-item>
      </v-list>

      <!-- Empty state for mobile -->
      <v-card v-if="!loading && tableData.length === 0" variant="outlined" class="pa-4 text-center">
        <v-icon size="48" color="grey">mdi-folder-open-outline</v-icon>
        <div class="text-grey mt-2">{{ $t('workRecords.addProject') }}</div>
      </v-card>

      <!-- Loading state for mobile -->
      <v-skeleton-loader v-if="loading" type="list-item@3"></v-skeleton-loader>

      <!-- Add project for mobile -->
      <v-card v-if="!workRecordApproval?.approved && !loading" variant="outlined" class="pa-2">
        <v-autocomplete
          ref="emptyRowAutocompleteRef"
          autocomplete="off"
          v-model="selectedProjectValue"
          :items="availableProjectsForEmpty"
          item-title="name"
          variant="outlined"
          density="compact"
          :placeholder="$t('workRecords.selectProjectToAdd')"
          :search="emptyRowSearchQuery"
          :loading="emptyRowSearchLoading"
          @update:search="handleEmptyRowSearch"
          @update:model-value="handleEmptyRowProjectSelect"
          :no-filter="true"
          :auto-select-first="false"
          return-object
          @update:focused="handleEmptyRowFocused"
          class="mobile-project-autocomplete"
        >
          <template v-slot:item="{ props, item: searchItem }">
            <v-list-item
              v-bind="props"
              :title="searchItem.raw.name"
              :subtitle="searchItem.raw.description"
            >
              <template v-slot:prepend>
                <v-chip color="success" size="x-small" variant="tonal">
                  {{ searchItem.raw.jiraIssueKey }}
                </v-chip>
                &nbsp;
              </template>
            </v-list-item>
          </template>
          <template v-slot:no-data>
            <div class="px-4 py-2 text-caption text-grey">
              {{ emptyRowSearchLoading ? $t('common.searching') : $t('workRecords.projectNotFound') }}
            </div>
          </template>
        </v-autocomplete>
      </v-card>
    </div>

    <!-- Desktop: Data Table (md and up) -->
    <v-data-table
      v-else
      :headers="headers"
      :items="tableData"
      :items-per-page="-1"
      :loading="loading"
      density="compact"
      fixed-header
      hide-default-footer
      class="work-hours-table"
      :no-data-text="$t('workRecords.addProject')"
    >
      <!-- Category Headers with Totals -->
      <template 
        v-for="category in props.categories"
        :key="category.code.value"
        v-slot:[`header.${category.code.value}`]
      >
        <div class="text-center">
          <div class="font-weight-medium">{{ category.name.value }}</div>
          <v-chip color="secondary" variant="flat" size="x-small" class="mt-1">
            {{ categoryTotals[category.code.value] || 0 }}h
          </v-chip>
        </div>
      </template>

      <!-- Project Label Column -->
      <template v-slot:item.projectName="{ item }">
        <div class="project-label-container">
          <v-tooltip v-if="item.project" location="top" :transition="false">
            <template v-slot:activator="{ props }">
              <v-chip
                v-bind="props"
                color="primary"
                variant="tonal"
                size="small"
                class="project-chip"
              >
                <v-icon start size="small">mdi-folder</v-icon>
                {{ item.project.jiraIssueKey }} {{ item.project.name }}
              </v-chip>
            </template>
            <div class="tooltip-content">
              <div class="font-weight-bold">{{ item.project.jiraIssueKey }} {{ item.project.name }}</div>
              <div v-if="item.project.description" class="text-caption mt-1">
                {{ item.project.description }}
              </div>
              <div class="text-caption mt-1">
                <v-chip size="x-small" variant="text">
                  {{ item.project.status }}
                </v-chip>
              </div>
            </div>
          </v-tooltip>
          <div v-else class="text-grey text-caption">
            {{ $t('workRecords.noProjectSelected') }}
          </div>
        </div>
      </template>

      <!-- Dynamic Category Hours Input Columns -->
      <template 
        v-for="category in props.categories" 
        :key="category.code.value"
        v-slot:[`item.${category.code.value}`]="{ item }"
      >
        <v-text-field
          :model-value="item.categoryHours[category.code.value] || 0"
          type="number"
          min="0"
          max="24"
          step="0.5"
          density="compact"
          variant="outlined"
          hide-details
          hide-spin-buttons
          :disabled="workRecordApproval?.approved"
          @update:model-value="updateCategoryHours(item.id, category.code.value, parseFloat($event) || 0)"
          :class="[
            'hours-input', 
            { 
              'hours-input--disabled': workRecordApproval?.approved,
              'hours-input--has-value': (item.categoryHours[category.code.value] || 0) > 0
            }
          ]"
        >
          <template v-slot:append-inner>
            <span class="text-caption text-grey">h</span>
          </template>
        </v-text-field>
      </template>

      <!-- Total Hours Column -->
      <template v-slot:item.total="{ item }">
        <v-chip color="primary" variant="tonal" size="small" class="total-chip">
          {{ item.total }}h
        </v-chip>
      </template>

      <!-- Actions Column -->
      <template v-slot:item.actions="{ item }">
        <div class="d-flex justify-center">
          <v-btn
            icon="mdi-delete"
            size="small"
            variant="text"
            color="error"
            @click="removeProjectRow(item.id)"
            :disabled="workRecordApproval?.approved"
            :title="'行を削除'"
          />
        </div>
      </template>

      <!-- Empty Project Row for Adding New Projects -->
      <template #body.append>
        <tr v-if="!workRecordApproval?.approved && !loading" class="empty-project-row">
          <td :colspan="headers.length" class="pa-2">
            <v-autocomplete
              ref="emptyRowAutocompleteRef"
              autocomplete="off"
              v-model="selectedProjectValue"
              :items="availableProjectsForEmpty"
              item-title="name"
              variant="outlined"
              density="compact"
              :placeholder="$t('workRecords.selectProjectToAdd')"
              :search="emptyRowSearchQuery"
              :loading="emptyRowSearchLoading"
              @update:search="handleEmptyRowSearch"
              @update:model-value="handleEmptyRowProjectSelect"
              @keydown.enter.prevent="handleEnterKey"
              :no-filter="true"
              :auto-select-first="false"
              class="project-autocomplete"
              return-object
            >
              <template v-slot:item="{ props, item: searchItem }">
                <v-list-item
                  v-bind="props"
                  :title="searchItem.raw.name"
                  :subtitle="searchItem.raw.description"
                >
                  <template v-slot:prepend>
                    <v-chip
                      color="success"
                      size="x-small"
                      variant="tonal"
                    >
                      {{ searchItem.raw.jiraIssueKey }} 
                    </v-chip>
                    &nbsp;                     
                  </template>
                </v-list-item>
              </template>
              
              <template v-slot:no-data>
                <div class="px-4 py-2 text-caption text-grey">
                  {{ emptyRowSearchLoading ? $t('common.searching') : $t('workRecords.projectNotFound') }}
                </div>
              </template>
            </v-autocomplete>
          </td>
        </tr>
      </template>

      <template #no-data>
        プロジェクトを追加してください
      </template>
      
      <template #loading>
          <v-skeleton-loader
            type="table-row@3"
          ></v-skeleton-loader>
      </template>
    </v-data-table>

    <!-- Success/Error Messages -->
    <v-snackbar v-model="showSuccessMessage" color="success" :timeout="3000">
      {{ $t('workRecords.messages.saveWorkRecordSucceeded') }}
    </v-snackbar>

    <v-snackbar v-model="showErrorMessage" color="error" :timeout="5000">
      {{ errorMessage || $t('errors.saveFailed') }}
    </v-snackbar>

    <!-- Mobile Work Hours Input Dialog -->
    <v-dialog v-model="showMobileDialog" max-width="500px">
      <v-card class="mobile-dialog-card">
        <v-card-title class="d-flex align-center">
          <v-icon class="mr-2">mdi-folder</v-icon>
          <div v-if="selectedRow?.project" class="text-truncate">
            {{ selectedRow.project.jiraIssueKey }} {{ selectedRow.project.name }}
          </div>
        </v-card-title>
        <v-divider />
        <v-card-text class="mobile-dialog-content">
          <div v-for="category in props.categories" :key="category.code.value" class="category-row">
            <label class="text-subtitle-2 category-name">{{ category.name.value }}</label>
            <v-slider
              :model-value="selectedRow?.categoryHours[category.code.value] || 0"
              :min="0"
              :max="24"
              :step="0.5"
              :disabled="workRecordApproval?.approved"
              @update:model-value="(value) => updateCategoryHours(selectedRow?.id || '', category.code.value, typeof value === 'number' ? value : parseFloat(value) || 0)"
              color="primary"
              :track-size="8"
              :thumb-size="24"
              class="work-hours-slider"
            />
            <v-chip size="small" color="primary" variant="tonal" class="category-hours-chip">
              {{ selectedRow?.categoryHours[category.code.value] || 0 }}h
            </v-chip>
          </div>
        </v-card-text>
        <v-divider />
        <div class="mobile-dialog-footer">
          <v-alert
            v-if="hasExceededMaxHours"
            type="error"
            density="compact"
            class="mx-4 mt-2 mb-0"
          >
            この日の全プロジェクトの合計時間({{ totalHoursForDay.toFixed(1) }}h)が24時間を超えています
          </v-alert>
          <div class="d-flex justify-space-between align-center px-4 py-2">
            <div class="d-flex align-center" style="gap: 12px;">
              <span class="font-weight-bold">{{ $t('common.total') }}</span>
              <v-chip
                :color="hasExceededMaxHours ? 'error' : 'primary'"
                variant="tonal"
                size="small"
              >
                {{ selectedRow?.total || 0 }}h
              </v-chip>
            </div>
            <v-btn color="primary" variant="text" @click="closeMobileDialog" size="small">
              {{ $t('common.close') }}
            </v-btn>
          </div>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import { useWorkRecordTable } from '@/composables/useWorkRecordTable'
import type { Project, WorkCategory, WorkRecord, WorkRecordApproval } from '@/services/types'
import { projectService } from '@/services'

interface Props {
  date?: string
  categories: WorkCategory[]
  records?: WorkRecord[]
  projectAutoSuggest?: WorkRecord[]
  loading?: boolean
  workRecordApproval?: WorkRecordApproval | null
  onSaveSuccess?: () => void
  onSaveError?: (error: any) => void
}

const props = withDefaults(defineProps<Props>(), {
  date: () => {
    const jst = new Date(Date.now() + 9 * 60 * 60 * 1000)
    return jst.toISOString().split('T')[0]
  },
  records: () => [],
  loading: false,
})

const emit = defineEmits<{
  save: [payload: any]
  'records-change': [project_id: string, category_code: string]
  'refresh': []
}>()

const { t: $t } = useI18n()

// Responsive breakpoint detection
const { xs, sm, md } = useDisplay()
const isMobile = computed(() => xs.value || sm.value)

// Mobile dialog state
const showMobileDialog = ref(false)
const selectedRow = ref<any>(null)

// Initialize the composable
const {
  state,
  tableData,
  categoryTotals,
  hasValidationErrors,
  validationErrors,
  addProjectRow,
  removeProjectRow,
  searchProjects,
  updateCategoryHours,
  loadWorkRecords,
  buildSaveWorkRecordsPayload,
} = useWorkRecordTable({
  initialDate: props.date,
  validationRules: {
    maxHoursPerDay: 24
  }
})

// UI state
const showSuccessMessage = ref(false)
const showErrorMessage = ref(false)
const errorMessage = ref('')

// Date state
const selectedDate = ref<string>(props.date)

// Flag to prevent duplicate loadWorkRecords execution
const isInitialized = ref(false)

// Empty row search state
const emptyRowSearchQuery = ref('')
const emptyRowSearchLoading = ref(false)
const availableProjectsForEmpty = ref<Project[]>([])
const emptyRowAutocompleteRef = ref()
const autocompleteMenuOpen = ref(false)
const selectedProjectValue = ref<Project | null>(null)

// Table headers
const headers = computed(() => {
  const baseHeaders = [
    { 
      title: $t('common.project'),
      key: 'projectName',
      sortable: false,
      width: '250px',
      align: 'start' as const
    }
  ]
  
  // Dynamic category headers
  const categoryHeaders = props.categories.map(category => ({
    title: category.name.value,
    key: category.code.value,
    sortable: false,
    align: 'center' as const,
    width: '120px',
  }))
  
  // Total and actions headers
  const endHeaders = [
    {
      title: $t('common.total'),
      key: 'total',
      sortable: false,
      align: 'center' as const,
      width: '80px'
    },
    {
      title: $t('common.actions'),
      key: 'actions',
      sortable: false,
      align: 'center' as const,
      width: '120px'
    }
  ]
  
  return [...baseHeaders, ...categoryHeaders, ...endHeaders]
})

// Calculate total hours for the day (sum of all projects)
const totalHoursForDay = computed(() => {
  return tableData.value.reduce((sum, row) => sum + row.total, 0)
})

// Check if total hours exceed 24 hours
const hasExceededMaxHours = computed(() => {
  return totalHoursForDay.value > 24
})

// Handle save operation
const handleSave = async () => {
  // Validate max hours before saving
  if (hasExceededMaxHours.value) {
    showErrorMessage.value = true
    errorMessage.value = '1日の合計時間は24時間を超えることはできません'
    return
  }

  try {
    const payload = await buildSaveWorkRecordsPayload()
    emit('save', payload)

    // Note: Success/error handling will be called by parent via exposed methods
  } catch (error: any) {
    handleSaveError(error)
  }
}

// Handle save success (called from parent component via ref)
const handleSaveSuccess = () => {
  showSuccessMessage.value = true
  showErrorMessage.value = false
  
  // Call parent's success handler if provided
  if (props.onSaveSuccess) {
    props.onSaveSuccess()
  }
  
  emit('refresh')
}

// Handle save error (called from parent component via ref)
const handleSaveError = (error: any) => {
  showSuccessMessage.value = false
  
  // Set error message
  if (error?.message) {
    errorMessage.value = error.message
  } else if (typeof error === 'string') {
    errorMessage.value = error
  } else {
    errorMessage.value = $t('errors.generalError')
  }
  
  showErrorMessage.value = true
  
  // Call parent's error handler if provided
  if (props.onSaveError) {
    props.onSaveError(error)
  }
}

// Format date for display
const formatDate = (dateString?: string): string => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleDateString()
}

// Debounce用のタイマー管理
const searchTimeout = ref<number | null>(null)

// 実際の検索処理
const performSearch = async (query: string) => {
  emptyRowSearchLoading.value = true

  try {
    const projects = 
      !query.trim() ? await projectService.getRecentWorkRecordedProjects() : await searchProjects(query)

    // Get already selected project IDs
    const selectedProjectIds = tableData.value
      .filter(row => row.project?.id)
      .map(row => row.project!.id)

    // Filter out already selected projects
    availableProjectsForEmpty.value = projects.filter(project =>
      !selectedProjectIds.includes(project.id)
    )
  } catch (error) {
    console.error('Empty row search error:', error)
    availableProjectsForEmpty.value = []
  } finally {
    emptyRowSearchLoading.value = false
  }
}

// Debounce処理付きの検索ハンドラー
const handleEmptyRowSearch = async (query: string) => {
  emptyRowSearchQuery.value = query

  // 既存のタイマーをクリア
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value)
    searchTimeout.value = null
  }

  if (!query.trim()) {
    availableProjectsForEmpty.value = []
    emptyRowSearchLoading.value = false
    return
  }

  // ローディング状態を即座に表示
  emptyRowSearchLoading.value = true

  // 300ms後に検索実行
  searchTimeout.value = window.setTimeout(() => {
    performSearch(query)
  }, 150)
}

const handleEmptyRowFocused = async (focused: boolean) => {
  performSearch("")
}

const handleEmptyRowProjectSelect = async (project: Project | null) => {
  if (!project) return
  
  // Add new project row with the selected project
  await addProjectRow(project)
  
  // Clear the autocomplete value, text and search query
  selectedProjectValue.value = null
  emptyRowSearchQuery.value = ''
  emptyRowAutocompleteRef.value.blur()
}

const handleEnterKey = async (event: KeyboardEvent) => {
}

// Mobile dialog handlers
const openMobileDialog = (item: any) => {
  selectedRow.value = item
  showMobileDialog.value = true
}

const closeMobileDialog = () => {
  showMobileDialog.value = false
  selectedRow.value = null
}

const closeAutocompleteDropdown = async () => {
  // Force close the menu immediately
  autocompleteMenuOpen.value = false
  
  // Clear search and items
  emptyRowSearchQuery.value = ''
  availableProjectsForEmpty.value = []
  
  // Wait for Vue to update
  await nextTick()
  
  if (emptyRowAutocompleteRef.value) {
    // Blur the input to ensure dropdown closes
    const inputElement = emptyRowAutocompleteRef.value.$el?.querySelector('input')
    if (inputElement) {
      inputElement.blur()
    }
  }
  
  // Force update to ensure menu is closed
  await nextTick()
}

// Global ESC key handler for reliable dropdown closing
const globalKeyHandler = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && autocompleteMenuOpen.value) {
    closeAutocompleteDropdown()
  }
}

// Initialize data when props change
watch(() => props.records, async () => {
    if (!isInitialized.value) {
        isInitialized.value = true
        return
    }
    loadWorkRecords(props.date, props.records)
}, { deep: true, immediate: true })

// Update selectedDate when props.date changes
watch(() => props.date, (newDate) => {
  selectedDate.value = newDate
})

// Update state.categories when props.categories changes
watch(() => props.categories, (newCategories) => {
  state.categories = newCategories
}, { immediate: true })

// watch(() => props.approvalInfo, (newValue) => {
//   updateApprovalState(props.isApproved, newValue)
// })

// Lifecycle hooks
onMounted(() => {
  // Add global ESC key listener for reliable dropdown closing
  document.addEventListener('keydown', globalKeyHandler)
})

onUnmounted(() => {
  // Clean up global event listener to prevent memory leaks
  document.removeEventListener('keydown', globalKeyHandler)

  // Clean up search timeout to prevent memory leaks
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value)
    searchTimeout.value = null
  }
})

// Expose methods for parent component
defineExpose({
  handleSaveSuccess,
  handleSaveError,
  state
})
</script>

<style scoped>
.work-hours-table {
  position: relative;
  overflow: visible;
}

.work-hours-table.approved {
  opacity: 0.9;
}

.work-hours-table {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
}

.work-hours-table :deep(.v-data-table__wrapper) {
  border-radius: 4px;
}

.work-hours-table :deep(thead) {
  background-color: rgba(0, 0, 0, 0.03);
}

.work-hours-table :deep(th) {
  font-weight: 600 !important;
  padding: 8px 4px !important;
}

.work-hours-table :deep(td) {
  padding: 4px !important;
  vertical-align: middle;
}

/* Project column styling */
.project-label-container {
  min-width: 200px;
  padding: 4px 0;
}

.project-chip {
  max-width: 180px;
}

.project-chip :deep(.v-chip__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-autocomplete {
  min-width: 200px;
}

.project-autocomplete :deep(.v-field) {
  min-height: 32px;
}

/* Hours input styling */
.hours-input {
  width: 60px;
  margin: 0 auto;
}

.hours-input :deep(.v-field) {
  min-height: 32px;
  text-align: center;
}

.hours-input :deep(.v-field__input) {
  text-align: center;
  padding: 2px 4px;
  font-size: 0.85rem;
}

.hours-input :deep(.v-field__append-inner) {
  font-size: 0.7rem;
  padding-left: 2px;
}

.hours-input--disabled {
  opacity: 0.6;
}

.hours-input--has-value :deep(.v-field) {
  background-color: rgba(76, 175, 80, 0.1) !important;
}

.hours-input--has-value :deep(.v-field__outline) {
  border-color: rgba(76, 175, 80, 0.3) !important;
}

/* Total chip styling */
.total-chip {
  min-width: 60px;
  justify-content: center;
  font-weight: 600;
}

/* Action buttons */
.work-hours-table :deep(.v-btn) {
  min-width: auto;
}

/* Hover effect for rows */
.work-hours-table :deep(.v-data-table__tr:hover) {
  background-color: rgba(0, 0, 0, 0.02) !important;
}

.text-bold {
  font-weight: 700;
}

.flex-grow-1 {
  flex-grow: 1;
  text-align: center;
}

.flex-spacer {
  flex-grow: 1;
}

.approval-status {
  margin-top: 16px;
}

/* Empty project row styling */
.empty-project-row {
  background-color: rgba(0, 0, 0, 0.02);
  border-top: 2px dashed rgba(0, 0, 0, 0.12);
}

.empty-project-row td {
  vertical-align: middle;
}

.empty-project-row .project-autocomplete :deep(.v-field) {
  display: flex;
  align-items: center;
}

.empty-project-row .project-autocomplete :deep(.v-field__input) {
  display: flex;
  align-items: center;
  min-height: 40px;
}

.hours-input-placeholder,
.total-placeholder {
  text-align: center;
  color: rgba(0, 0, 0, 0.38);
  font-size: 0.875rem;
  font-style: italic;
}

.actions-placeholder {
  height: 32px; /* Match button height */
}

/* Responsive adjustments */
@media (max-width: 960px) {
  .project-autocomplete {
    min-width: 150px;
  }

  .hours-input {
    max-width: 60px;
  }
}

/* Mobile list styling */
.mobile-work-hours-list {
  width: 100%;
}

.mobile-list-item {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  margin-bottom: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.mobile-list-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.mobile-list-item:active {
  background-color: rgba(0, 0, 0, 0.08);
}

/* Mobile dialog styling */
.mobile-dialog-card {
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}

.mobile-dialog-content {
  flex: 1;
  overflow-y: auto;
}

.mobile-dialog-footer {
  position: sticky;
  bottom: 0;
  background-color: white;
  z-index: 1;
}

/* Category row styling */
.category-row {
  display: grid;
  grid-template-columns: 80px 1fr auto;
  align-items: center;
  gap: 12px;
  height: 48px;
}

.category-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 48px;
}

.category-hours-chip {
  min-width: 50px;
  justify-content: center;
  height: 32px;
}

/* Work hours slider styling */
.work-hours-slider {
  margin: 0;
  padding: 0;
  height: 48px;
}

.work-hours-slider :deep(.v-slider) {
  height: 48px !important;
  padding: 0 !important;
  display: flex;
  align-items: center;
}

.work-hours-slider :deep(.v-input__control) {
  height: 48px;
  display: flex;
  align-items: center;
}

.work-hours-slider :deep(.v-slider__container) {
  height: 48px;
  display: flex;
  align-items: center;
}

.work-hours-slider :deep(.v-slider__track-container) {
  margin: 0;
}

/* Mobile project autocomplete */
.mobile-project-autocomplete :deep(.v-field__input) {
  display: flex;
  align-items: center;
  min-height: 40px;
}

.mobile-project-autocomplete :deep(.v-field) {
  display: flex;
  align-items: center;
}
</style>