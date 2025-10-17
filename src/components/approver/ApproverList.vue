<template>
  <div class="approver-list">
    <!-- Empty State -->
    <v-card v-if="displayApprovers.length === 0 && !loading" class="pa-4">
      <v-card-text class="text-center">
        <v-icon size="64" color="grey-lighten-1" class="mb-3">
          mdi-account-group-outline
        </v-icon>
        <h3 class="text-h6 mb-2">{{ t('approval.approver.noApproversSet') }}</h3>
        <p class="text-body-2">
          {{ t('approval.approver.contactAdmin') }}
        </p>
      </v-card-text>
    </v-card>
    
    <!-- Data Table -->
    <v-card v-else>
      <v-card-title class="d-flex align-center">
        <span class="text-h6">{{ t('approval.approver.title') }}</span>
        <v-spacer></v-spacer>
        <v-text-field
          v-model="search"
          append-inner-icon="mdi-magnify"
          :label="t('approval.approver.searchApprovers')"
          single-line
          hide-details
          density="compact"
          style="max-width: 300px"
          class="ml-4"
        ></v-text-field>
      </v-card-title>
      <v-card-subtitle>
        {{ t('approval.approver.currentEffectiveCount', { count: currentlyEffectiveCount }) }}
      </v-card-subtitle>
      
      <v-data-table
        :headers="headers"
        :items="displayApprovers"
        :search="search"
        :loading="loading"
        class="elevation-0"
        item-key="id"
        :no-data-text="t('approval.approver.notFound')"
        :loading-text="t('approval.approver.loading')"
        :items-per-page="10"
        :items-per-page-options="[5, 10, 25, 50]"
      >
      <!-- Approver Info Column -->
      <template v-slot:item.approverInfo="{ item }">
        <div class="d-flex align-center">
          <v-avatar size="32" class="mr-3">
            <v-icon color="primary">mdi-account</v-icon>
          </v-avatar>
          <div>
            <div class="font-weight-medium">{{ getApproverName(item.approverEmail) }}</div>
            <div class="text-caption text-medium-emphasis">{{ item.approverEmail }}</div>
          </div>
        </div>
      </template>
      
      <!-- Effective Period Column -->
      <template v-slot:item.effectivePeriod="{ item }">
        <div>
          <div>{{ formatDate(item.effectiveFrom) }}</div>
          <div class="text-caption text-medium-emphasis" v-if="item.effectiveTo">
            〜 {{ formatDate(item.effectiveTo) }}
          </div>
          <div class="text-caption text-medium-emphasis" v-else>
            {{ t('approval.approver.continuing') }}
          </div>
        </div>
      </template>
      
      <!-- Status Column -->
      <template v-slot:item.status="{ item }">
        <v-chip
          :color="item.isCurrentlyEffective ? 'success' : 'default'"
          :variant="item.isCurrentlyEffective ? 'tonal' : 'outlined'"
          size="small"
        >
          <v-icon start size="16">
            {{ item.isCurrentlyEffective ? 'mdi-check-circle' : 'mdi-circle-outline' }}
          </v-icon>
          {{ item.isCurrentlyEffective ? t('approval.approver.effective') : t('approval.approver.inactive') }}
        </v-chip>
      </template>
      </v-data-table>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { useApprover } from '@/composables/useApprover'
import type { Approver } from '@/services/types/user.types'

const { t } = useI18n()

const {
  approvers,
  loading,
  error
} = useApprover()

// Reactive data
const search = ref('')

// Table headers
const headers = [
  {
    title: t('approval.approver.approver'),
    key: 'approverInfo',
    align: 'start' as const,
    sortable: true,
    sort: (a: Approver, b: Approver) => {
      return getApproverName(a.approverEmail).localeCompare(getApproverName(b.approverEmail), 'ja')
    }
  },
  {
    title: t('approval.approver.effectivePeriod'),
    key: 'effectivePeriod',
    align: 'start' as const,
    sortable: false
  },
  {
    title: t('approval.approver.status'),
    key: 'status',
    align: 'center' as const,
    sortable: true,
    sort: (a: Approver, b: Approver) => {
      if (a.isCurrentlyEffective && !b.isCurrentlyEffective) return -1
      if (!a.isCurrentlyEffective && b.isCurrentlyEffective) return 1
      return 0
    }
  }
]

// Computed properties
const displayApprovers = computed(() => {
  return approvers.value
    .filter(approver => !approver.isDeleted)
    .sort((a, b) => {
      // Sort by currently effective first, then by effective from date
      if (a.isCurrentlyEffective && !b.isCurrentlyEffective) return -1
      if (!a.isCurrentlyEffective && b.isCurrentlyEffective) return 1
      return new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()
    })
})

const currentlyEffectiveCount = computed(() => {
  return approvers.value.filter(approver => 
    approver.isCurrentlyEffective && !approver.isDeleted
  ).length
})

// Helper functions
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  })
}

const getApproverName = (email: string): string => {
  // Extract name from email address (before @ symbol)
  // This is a temporary solution until we have proper name fields
  const localPart = email.split('@')[0]
  
  // Convert common patterns to more readable names
  return localPart
    .replace(/[._-]/g, ' ') // Replace separators with spaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
</script>

<style scoped>
.approver-list {
  width: 100%;
}

.v-data-table {
  border-radius: 8px;
}

.v-card-title {
  padding-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.v-card-subtitle {
  padding-top: 0;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .v-card-title {
    flex-direction: column;
    align-items: stretch;
  }
  
  .v-card-title .v-text-field {
    max-width: none !important;
    margin-left: 0 !important;
    margin-top: 8px;
  }
}
</style>