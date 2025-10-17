<template>
  <v-container fluid>
    <!-- Data table -->
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <div>
          {{ $t('approval.pendingApprovalList') }}
          <v-chip
            color="warning"
            size="small"
            class="ml-2"
          >
            {{ aggregatedApprovals.length }}件
          </v-chip>
        </div>
        
        <!-- Batch action buttons -->
        <div>
          <v-btn
            color="success"
            variant="outlined"
            size="small"
            class="mr-2"
            :disabled="!selectedItems.length"
            @click="handleBatchApprove"
          >
            <v-icon start>mdi-check-all</v-icon>
            {{ $t('approval.actions.batchApprove') }}
          </v-btn>
          <v-btn
            color="error"
            variant="outlined"
            size="small"
            :disabled="!selectedItems.length"
            @click="handleBatchReject"
          >
            <v-icon start>mdi-close-circle-outline</v-icon>
            {{ $t('approval.actions.batchReject') }}
          </v-btn>
        </div>
      </v-card-title>
      
      <v-divider />
      
      <!-- Data table body -->
      <v-data-table
        v-model="selectedItems"
        :headers="headers"
        :items="aggregatedApprovals"
        :items-per-page="10"
        :item-value="(item) => `${item.userId}_${item.workDate}`"
        :loading="loading"
        show-select
        hover
        class="elevation-0"
        return-object
        @click:row="handleRowClick"
      >
        <!-- User column -->
        <template #item.user="{ item }">
          <div class="d-flex align-center">
            <v-avatar size="32" class="mr-2">
              <v-icon>mdi-account</v-icon>
            </v-avatar>
            <div>
              <div class="font-weight-medium">{{ item.user.fullName }}</div>
            </div>
          </div>
        </template>
        
        <!-- Work date column -->
        <template #item.workDate="{ item }">
            {{ formatDate(item.workDate) }}
        </template>
        
        <!-- Category hours column -->
        <template #item.categoryHours="{ item }">
          <div class="d-flex flex-wrap ga-1">
            <v-chip
              v-for="(hours, category) in item.categoryHours"
              :key="category"
              size="x-small"
              variant="tonal"
              color="secondary"
            >
              {{ category }}: {{ hours }}h
            </v-chip>
          </div>
        </template>
        
        <!-- Total hours column -->
        <template #item.totalHours="{ item }">
          <v-chip
            size="small"
            :color="item.totalHours > 8 ? 'warning' : 'success'"
            variant="flat"
          >
            <strong>{{ item.totalHours }}h</strong>
          </v-chip>
        </template>
        
        <!-- Projects column -->
        <template #item.projects="{ item }">
          <v-tooltip 
            :text="$t('approval.counts.projects', { count: item.projectBreakdowns.length })"
            location="top"
          >
            <template #activator="{ props }">
              <v-chip
                v-bind="props"
                size="small"
                variant="outlined"
                color="info"
              >
                {{ $t('approval.counts.items', { count: item.projectBreakdowns.length }) }}
              </v-chip>
            </template>
          </v-tooltip>
        </template>
        
        <!-- Status column -->
        <template #item.approvalStatus="{ item }">
          <v-chip
            size="small"
            :color="getStatusColor(item.approvalStatus)"
            variant="flat"
          >
            {{ $t(`approval.status.${item.approvalStatus.toLowerCase()}`, getStatusText(item.approvalStatus)) }}
          </v-chip>
        </template>
        
        <!-- Actions column -->
        <template #item.actions="{ item }">
          <div class="d-flex ga-1">
            <v-tooltip :text="$t('approval.actions.approve')" location="top">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-check-circle"
                  color="success"
                  size="small"
                  variant="text"
                  :disabled="item.approvalStatus !== 'PENDING'"
                  @click.stop="handleApprove(item)"
                />
              </template>
            </v-tooltip>
            
            <v-tooltip :text="$t('approval.actions.reject')" location="top">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-close-circle"
                  color="error"
                  size="small"
                  variant="text"
                  :disabled="item.approvalStatus !== 'PENDING'"
                  @click.stop="handleReject(item)"
                />
              </template>
            </v-tooltip>
          </div>
        </template>
        
        <!-- Pagination -->
        <template #bottom>
          <div class="text-center pt-2">
            <v-pagination
              v-model="page"
              :length="pageCount"
              :total-visible="5"
              size="small"
            />
          </div>
        </template>

        <template #no-data>
          承認待ちの作業記録はありません
        </template>

        <template #loading>
        </template>
      </v-data-table>
    </v-card>
    
    <!-- Rejection dialog -->
    <RejectApprovalRequestDialog
      v-model="showRejectionDialog"
      :target-count="rejectionTargets.length"
      :reason="rejectionReason"
      @confirm="confirmRejection"
      @cancel="cancelRejection"
    />
    
    <!-- Details dialog -->
    <ApprovalRequestDetailDialog
      v-model="showDetailsDialog"
      :approval="selectedApproval"
      @close="handleCloseDetails"
    />
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useI18n } from 'vue-i18n'
import { useApproval } from '@/composables'
import type { AggregatedApproval } from '@/services'
import RejectApprovalRequestDialog from './RejectApprovalRequestDialog.vue'
import ApprovalRequestDetailDialog from './ApprovalRequestDetailDialog.vue'

const toast = useToast()
const { t: $t } = useI18n()

// Use approval composable
const {
  pendingApprovals: aggregatedApprovals,
  loading,
  fetchPendingApprovals,
  approveDaily,
  batchApprove: batchApproveItems,
  batchReject: batchRejectItems,
  getApprovalStatusColor: getStatusColor,
  getApprovalStatusText: getStatusText,
  formatDate
} = useApproval({ autoLoad: true })

// Local state for dialogs
const selectedItems = ref<AggregatedApproval[]>([])
const showRejectionDialog = ref(false)
const showDetailsDialog = ref(false)
const rejectionTargets = ref<AggregatedApproval[]>([])
const rejectionReason = ref('')
const selectedApproval = ref<AggregatedApproval | null>(null)
const page = ref(1)

// Table headers
const headers = computed(() => [
  { title: $t('approval.applicant'), key: 'user', sortable: true, width: '200px' },
  { title: $t('approval.workDate'), key: 'workDate', sortable: true, width: '120px' },
  { title: $t('approval.totalHours'), key: 'totalHours', sortable: true, width: '100px' },
  { title: $t('approval.actionsHeader'), key: 'actions', sortable: false, align: 'center' as const, width: '120px' }
])

// Computed
const pageCount = computed(() => Math.ceil(aggregatedApprovals.value.length / 10))

// Data fetching
const fetchAggregatedApprovals = async () => {
  try {
    await fetchPendingApprovals()
  } catch (error) {
    toast.error($t('approval.messages.fetchFailed'))
    console.error('Failed to fetch aggregated approvals:', error)
  }
}

// Approval handling
const handleApprove = async (approval: AggregatedApproval) => {
  try {
    await approveDaily({
      userId: approval.userId,
      workDate: approval.workDate
    })
    toast.success($t('approval.messages.approveSuccess'))
    await fetchAggregatedApprovals()
  } catch (error) {
    toast.error($t('approval.messages.approveFailed'))
    console.error('Failed to approve:', error)
  }
}

// Rejection handling
const handleReject = (approval: AggregatedApproval) => {
  rejectionTargets.value = [approval]
  rejectionReason.value = ''
  showRejectionDialog.value = true
}

// Batch approval
const handleBatchApprove = async () => {
  if (!selectedItems.value.length) return
  
  try {
    console.log('Selected items for batch approval:', selectedItems.value)
    await batchApproveItems(selectedItems.value)
    toast.success($t('approval.messages.batchApproveSuccess', { count: selectedItems.value.length }))
    selectedItems.value = []
    await fetchAggregatedApprovals()
  } catch (error) {
    toast.error($t('approval.messages.batchApproveFailed'))
    console.error('Failed to batch approve:', error)
  }
}

// Batch rejection
const handleBatchReject = () => {
  if (!selectedItems.value.length) return
  rejectionTargets.value = [...selectedItems.value]
  rejectionReason.value = ''
  showRejectionDialog.value = true
}

// Confirm rejection
const confirmRejection = async (reason: string) => {
  try {
    await batchRejectItems(rejectionTargets.value, reason)
    
    toast.success($t('approval.messages.rejectSuccess', { count: rejectionTargets.value.length }))
    selectedItems.value = []
    showRejectionDialog.value = false
    rejectionTargets.value = []
    rejectionReason.value = ''
    await fetchAggregatedApprovals()
  } catch (error) {
    toast.error($t('approval.messages.rejectFailed'))
    console.error('Failed to reject:', error)
  }
}

// Cancel rejection
const cancelRejection = () => {
  showRejectionDialog.value = false
  rejectionTargets.value = []
  rejectionReason.value = ''
}

const handleRowClick = (_event: Event, item: { item: AggregatedApproval }) => {
  selectedApproval.value = item.item
  showDetailsDialog.value = true
}

// Close details dialog
const handleCloseDetails = () => {
  showDetailsDialog.value = false
  selectedApproval.value = null
}

// Initialize
onMounted(() => {
  fetchAggregatedApprovals()
})
</script>

<style scoped>
.v-data-table {
  font-size: 0.875rem;
}
</style>