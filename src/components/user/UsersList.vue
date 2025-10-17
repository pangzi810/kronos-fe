<template>
  <v-container fluid>
    <!-- Data table -->
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <div>
          ユーザー一覧
          <v-chip
            color="primary"
            size="small"
            class="ml-2"
          >
            {{ totalElements }}名
          </v-chip>
        </div>
        
        <!-- Filter chips -->
        <div class="d-flex ga-2">
          <v-switch
            v-model="showActiveOnly"
            label="アクティブのみ"
            density="compact"
            hide-details
            color="primary"
            @update:model-value="handleFilterChange"
          />
        </div>
      </v-card-title>
      
      <v-divider />
      
      <!-- Search bar -->
      <v-card-text>
        <v-text-field
          v-model="searchQuery"
          prepend-inner-icon="mdi-magnify"
          label="ユーザーを検索"
          placeholder="名前、ユーザー名、メールアドレスで検索"
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
        :items="users"
        :items-per-page="itemsPerPage"
        :page="currentPage"
        :items-length="totalElements"
        :loading="loading"
        hover
        class="elevation-0 data-table-fixed"
        item-key="userId"
        @click:row="handleRowClick"
        @update:page="handlePageChange"
        @update:items-per-page="handleItemsPerPageChange"
        @update:sort-by="handleSortChange"
      >
        <!-- User column -->
        <template #item.user="{ item }">
          <div class="d-flex align-center">
            <v-avatar size="36" class="mr-3">
              <v-icon>mdi-account-circle</v-icon>
            </v-avatar>
            <div>
              <div class="font-weight-medium">{{ item.fullName }}</div>
              <div class="text-caption text-medium-emphasis">@{{ item.username }}</div>
            </div>
          </div>
        </template>
        
        <!-- Email column -->
        <template #item.email="{ item }">
          <div class="d-flex align-center">
            <v-icon size="small" class="mr-2">mdi-email-outline</v-icon>
            <a :href="`mailto:${item.email}`" class="text-decoration-none">
              {{ item.email }}
            </a>
          </div>
        </template>
        
        <!-- Status column -->
        <template #item.active="{ item }">
          <v-chip
            size="small"
            :color="item.active ? 'success' : 'error'"
            variant="flat"
          >
            <v-icon start size="x-small">
              {{ item.active ? 'mdi-check-circle' : 'mdi-cancel' }}
            </v-icon>
            {{ item.active ? 'アクティブ' : '非アクティブ' }}
          </v-chip>
        </template>
        
        <!-- Created date column -->
        <template #item.createdAt="{ item }">
          <v-tooltip :text="formatDateTime(item.createdAt)" location="top">
            <template #activator="{ props }">
              <span v-bind="props" class="text-caption">
                {{ formatDate(item.createdAt) }}
              </span>
            </template>
          </v-tooltip>
        </template>
        
        <!-- Updated date column -->
        <template #item.updatedAt="{ item }">
          <v-tooltip :text="formatDateTime(item.updatedAt)" location="top">
            <template #activator="{ props }">
              <span v-bind="props" class="text-caption">
                {{ getRelativeTime(item.updatedAt) }}
              </span>
            </template>
          </v-tooltip>
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
            <h3 class="text-h6 mb-2">ユーザが登録されていません</h3>
            <p class="text-body-2 text-grey">
              {{ searchQuery ? '該当するユーザが見つかりません' : 'ユーザが登録されていません' }}
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
    
    <!-- User details dialog -->
    <v-dialog
      v-model="showDetailsDialog"
      max-width="600"
    >
      <v-card v-if="selectedUser">
        <v-card-title>
          <v-icon start>mdi-account-details</v-icon>
          ユーザー詳細
        </v-card-title>
        
        <v-divider />
        
        <v-card-text>
          <!-- User avatar and basic info -->
          <div class="d-flex align-center mb-4">
            <v-avatar size="80" class="mr-4">
              <v-icon size="60">mdi-account-circle</v-icon>
            </v-avatar>
            <div>
              <h3 class="text-h5 mb-1">{{ selectedUser.fullName }}</h3>
              <div class="text-body-2 text-medium-emphasis">@{{ selectedUser.username }}</div>
            </div>
          </div>
          
          <v-divider class="mb-4" />
          
          <!-- Detailed information -->
          <v-list density="compact">
            <v-list-item>
              <template #prepend>
                <v-icon>mdi-identifier</v-icon>
              </template>
              <v-list-item-title>ユーザーID</v-list-item-title>
              <v-list-item-subtitle>
                <code>{{ selectedUser.id }}</code>
              </v-list-item-subtitle>
            </v-list-item>
            
            <v-list-item>
              <template #prepend>
                <v-icon>mdi-email</v-icon>
              </template>
              <v-list-item-title>メールアドレス</v-list-item-title>
              <v-list-item-subtitle>
                <a :href="`mailto:${selectedUser.email}`" class="text-decoration-none">
                  {{ selectedUser.email }}
                </a>
              </v-list-item-subtitle>
            </v-list-item>
            
            
            <v-list-item>
              <template #prepend>
                <v-icon>mdi-toggle-switch</v-icon>
              </template>
              <v-list-item-title>ステータス</v-list-item-title>
              <v-list-item-subtitle>
                <v-chip
                  size="small"
                  :color="selectedUser.active ? 'success' : 'error'"
                  variant="flat"
                >
                  {{ selectedUser.active ? 'アクティブ' : '非アクティブ' }}
                </v-chip>
              </v-list-item-subtitle>
            </v-list-item>
            
            <v-list-item>
              <template #prepend>
                <v-icon>mdi-calendar-plus</v-icon>
              </template>
              <v-list-item-title>作成日時</v-list-item-title>
              <v-list-item-subtitle>{{ formatDateTime(selectedUser.createdAt) }}</v-list-item-subtitle>
            </v-list-item>
            
            <v-list-item>
              <template #prepend>
                <v-icon>mdi-calendar-edit</v-icon>
              </template>
              <v-list-item-title>最終更新日時</v-list-item-title>
              <v-list-item-subtitle>{{ formatDateTime(selectedUser.updatedAt) }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showDetailsDialog = false"
          >
            閉じる
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { watchDebounced } from '@vueuse/core'
import { userService, type User, type UserSearchParams } from '@/services'

const toast = useToast()

// Data
const users = ref<User[]>([])
const loading = ref(false)
const searchQuery = ref('')
const showDetailsDialog = ref(false)
const selectedUser = ref<User | null>(null)
const showActiveOnly = ref(true)

// Pagination state
const currentPage = ref(1)
const itemsPerPage = ref(10)
const totalElements = ref(0)
const totalPages = ref(0)
const sortBy = ref('createdAt')
const sortOrder = ref<'ASC' | 'DESC'>('DESC')

// Table headers
const headers = computed(() => [
  { title: 'ユーザー', key: 'user', sortable: true, width: '250px' },
  { title: 'メールアドレス', key: 'email', sortable: true, width: '200px' },
  { title: 'ステータス', key: 'active', sortable: true, width: '120px' },
  { title: '作成日', key: 'createdAt', sortable: true, width: '100px' },
  { title: '更新日', key: 'updatedAt', sortable: true, width: '100px' }
])

// Watch for filter changes
watchDebounced(searchQuery, () => {
  currentPage.value = 1
  fetchUsers()
}, { debounce: 500 })

const handleFilterChange = () => {
  currentPage.value = 1
  fetchUsers()
}

// Data fetching
const fetchUsers = async () => {
  loading.value = true
  try {
    const params: UserSearchParams = {
      page: currentPage.value - 1, // Backend expects 0-based page index
      size: itemsPerPage.value,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
      search: searchQuery.value || undefined
    }

    // Add status filter
    if (showActiveOnly.value) {
      params.status = 'ACTIVE'
    }

    const response = await userService.getPaginated(params)
    users.value = response.users
    totalElements.value = response.metadata.totalElements
    totalPages.value = response.metadata.totalPages
  } catch (error) {
    toast.error('ユーザーの取得に失敗しました')
    console.error('Failed to fetch users:', error)
  } finally {
    loading.value = false
  }
}

// Pagination handlers
const handlePageChange = (newPage: number) => {
  currentPage.value = newPage
  fetchUsers()
}

const handleItemsPerPageChange = (newItemsPerPage: number) => {
  itemsPerPage.value = newItemsPerPage
  currentPage.value = 1
  fetchUsers()
}

const handleSortChange = (newSort: any[]) => {
  if (newSort.length > 0) {
    sortBy.value = newSort[0].key
    sortOrder.value = newSort[0].order === 'desc' ? 'DESC' : 'ASC'
    fetchUsers()
  }
}

// Handle row click
const handleRowClick = (_event: Event, item: { item: User }) => {
  selectedUser.value = item.item
  showDetailsDialog.value = true
}

// Date utilities
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ja-JP')
}

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ja-JP') + ' ' + date.toLocaleTimeString('ja-JP')
}

const getRelativeTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      if (diffMinutes === 0) {
        return 'たった今'
      }
      return `${diffMinutes}分前`
    }
    return `${diffHours}時間前`
  } else if (diffDays === 1) {
    return '昨日'
  } else if (diffDays < 7) {
    return `${diffDays}日前`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks}週間前`
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months}ヶ月前`
  } else {
    const years = Math.floor(diffDays / 365)
    return `${years}年前`
  }
}

// Initialize
onMounted(() => {
  fetchUsers()
})
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