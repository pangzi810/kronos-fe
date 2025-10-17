<template>
  <v-container fluid>
    <!-- Data table -->
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <div>
          プロジェクト一覧
          <v-chip
            color="primary"
            size="small"
            class="ml-2"
          >
            {{ projects.length }}件
          </v-chip>
        </div>
      </v-card-title>
      
      <v-divider />
      
      <!-- Search bar -->
      <v-card-text>
        <v-text-field
          v-model="searchQuery"
          prepend-inner-icon="mdi-magnify"
          label="プロジェクトを検索"
          variant="outlined"
          density="compact"
          clearable
          hide-details
          class="mb-4"
        />
      </v-card-text>
      
      <!-- Data table body -->
      <v-data-table-server
        :headers="headers"
        :items="projects"
        :items-per-page="itemsPerPage"
        :page="currentPage"
        :items-length="totalElements"
        :loading="loading"
        hover
        class="elevation-0 data-table-fixed"
        item-key="id"
        no-data-text="プロジェクトがありません"
        @click:row="handleRowClick"
        @update:page="handlePageChange"
        @update:items-per-page="handleItemsPerPageChange"
        @update:sort-by="handleSortChange"
      >
        <!-- Name column -->
        <template #item.name="{ item }">
          <div class="d-flex align-center">
            <!-- JIRA Key -->
            <v-chip
              v-if="item.jiraIssueKey"
              size="small"
              variant="tonal"
              color="blue-grey"
              class="mr-2"
            >
              <v-icon start size="x-small">mdi-jira</v-icon>
              {{ item.jiraIssueKey }}
            </v-chip>
            <v-icon size="small" class="mr-2">mdi-folder-outline</v-icon>
            <div>
              <div class="font-weight-medium">{{ item.name }}</div>
            </div>
          </div>
        </template>
        
        <!-- Status column -->
        <template #item.status="{ item }">
          <v-chip
            size="small"
            :color="getStatusColor(item.status)"
            variant="flat"
          >
            <v-icon start size="x-small">{{ getStatusIcon(item.status) }}</v-icon>
            {{ getStatusText(item.status) }}
          </v-chip>
        </template>
        
        <!-- Start date column -->
        <template #item.startDate="{ item }">
          <v-chip size="small" variant="outlined">
            <v-icon start size="x-small">mdi-calendar-start</v-icon>
            {{ formatDate(item.startDate) }}
          </v-chip>
        </template>
        
        <!-- End date column -->
        <template #item.plannedEndDate="{ item }">
          <v-chip
            size="small"
            variant="outlined"
          >
            <v-icon start size="x-small">mdi-calendar-end</v-icon>
            {{ formatDate(item.plannedEndDate) }}
          </v-chip>
        </template>

        <!-- No data template -->
        <template #no-data>
          <v-container class="pa-8 text-center">
            <v-icon
              size="64"
              color="grey-lighten-1"
              class="mb-4"
            >
              mdi-folder-open-outline
            </v-icon>
            <h3 class="text-h6 mb-2">プロジェクトがありません</h3>
            <p class="text-body-2 text-grey">
              {{ searchQuery ? '検索条件に一致するプロジェクトが見つかりませんでした' : '登録されているプロジェクトがありません' }}
            </p>
          </v-container>
        </template>

        <template #loading>
          <v-skeleton-loader
            type="table-tbody"
          ></v-skeleton-loader>
        </template>
      </v-data-table-server>
    </v-card>
    
    <!-- Project details dialog -->
    <ProjectDetailDialog
      v-model="showDetailsDialog"
      :project="selectedProject"
    />
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { watchDebounced } from '@vueuse/core'
import { projectService, type Project, type ProjectSearchParams } from '@/services'
import ProjectDetailDialog from '@/components/project/ProjectDetailDialog.vue'

const toast = useToast()

// Data
const projects = ref<Project[]>([])
const loading = ref(false)
const searchQuery = ref('')
const showDetailsDialog = ref(false)
const selectedProject = ref<Project | null>(null)

// Pagination state
const currentPage = ref(1)
const itemsPerPage = ref(10)
const totalElements = ref(0)
const totalPages = ref(0)
const sortBy = ref('createdAt')
const sortOrder = ref<'ASC' | 'DESC'>('DESC')

// Table headers
const headers = computed(() => [
  { title: 'プロジェクト名', key: 'name', sortable: true, width: '300px' },
  { title: 'ステータス', key: 'status', sortable: true, width: '130px' },
  { title: '開始日', key: 'startDate', sortable: true, width: '130px' },
  { title: '終了予定日', key: 'plannedEndDate', sortable: true, width: '130px' }
])

// Handle row click
const handleRowClick = (_event: Event, item: { item: Project }) => {
  selectedProject.value = item.item
  showDetailsDialog.value = true
}

const handlePageChange = (newPage: number) => {
  currentPage.value = newPage
  fetchProjects()
}

const handleItemsPerPageChange = (newSize: number) => {
  itemsPerPage.value = newSize
  fetchProjects()
}

const handleSortChange = (newSort: any[]) => {
  if (newSort.length > 0) {
    sortBy.value = newSort[0].key
    sortOrder.value = newSort[0].order === 'desc' ? 'DESC' : 'ASC'
    fetchProjects()
  }
}

// Status configuration
const statusConfig = {
  'PLANNING': {
    color: 'info',
    icon: 'mdi-pencil-ruler',
    text: '計画中'
  },
  'IN_PROGRESS': {
    color: 'primary',
    icon: 'mdi-progress-clock',
    text: '進行中'
  },
  'COMPLETED': {
    color: 'success',
    icon: 'mdi-check-circle',
    text: '完了'
  },
  'CANCELLED': {
    color: 'error',
    icon: 'mdi-cancel',
    text: 'キャンセル'
  }
} as const

// Status utilities
const getStatusColor = (status: string) => statusConfig[status as keyof typeof statusConfig]?.color || 'grey'
const getStatusIcon = (status: string) => statusConfig[status as keyof typeof statusConfig]?.icon || 'mdi-help-circle'
const getStatusText = (status: string) => statusConfig[status as keyof typeof statusConfig]?.text || status

// Date utilities
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ja-JP')
}

// Initialize
onMounted(() => {
  fetchProjects()
})

watchDebounced(searchQuery, () => {
  currentPage.value = 1
  fetchProjects()
}, { debounce: 500 })

// Data fetching
const fetchProjects = async () => {
  loading.value = true
  try {
    const params: ProjectSearchParams = {
      page: currentPage.value - 1,
      size: itemsPerPage.value,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
      search: searchQuery.value || undefined
    }

    const data = await projectService.getPaginated(params)
    projects.value = data
    totalElements.value = 1
    totalPages.value = 1
  } catch (error) {
    toast.error('プロジェクトの取得に失敗しました')
    console.error('Failed to fetch projects:', error)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.v-data-table {
  font-size: 0.875rem;
}

/* Fixed height for data table to accommodate exactly 10 items */
/* Header: ~56px, Row: ~52px, Total for 10 rows: ~576px */
.data-table-fixed :deep(.v-table__wrapper) {
  overflow-y: auto;
}

/* Ensure consistent row height */
.data-table-fixed :deep(.v-data-table__tr) {
  height: 52px;
}

/* Header height */
.data-table-fixed :deep(.v-data-table__th) {
  height: 56px !important;
}

</style>