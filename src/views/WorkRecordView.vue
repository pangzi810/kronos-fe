<template>
  <v-container fluid class="pa-6">
    <!-- Header -->
    <v-row class="mb-4">
      <v-col>
        <h2 class="text-h6">{{ $t('navigation.workRecords') }}</h2>
      </v-col>
      <v-col cols="auto" class="d-flex align-center">
        <DatePicker
          v-model="selectedDate"
          :dateStatuses="dateStatuses"
          @update:model-value="handleDateChange"
          @month-change="handleMonthChange"
        />
      </v-col>
    </v-row>

    <!-- Main Content -->
    <v-row>
      <!-- Work Hours Input Section -->
      <v-col>
        <!-- Permission Check: Can Edit Work Hours -->
          <v-card>
            <v-card-text>
              <WorkHoursTable
                ref="workHoursTableRef"
                :date="selectedDate"
                :categories="categories"
                :records="records"
                :loading="loadingWorkRecords"
                :work-record-approval="workRecordApproval"
                @save="handleBatchSaveWorkRecords"
                />
            </v-card-text>
          </v-card>
      </v-col>
    </v-row>

    <!-- Statistics Cards -->
    <!-- <v-row>
      <v-col>
        <WorkHorusSummary
          :summary="summary"
          :period="'month'"
          :loadingSummary="loadingSummary" />
      </v-col>
    </v-row> -->
  </v-container>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useWorkRecord } from '@/composables'
import type { SaveWorkRecordsPayload } from '@/services/types/work-record-table.types'
import WorkHoursTable from '@/components/work-hours/WorkHoursTable.vue'
import DatePicker from '@/components/common/DatePicker.vue'

const { t: $t } = useI18n()
const router = useRouter()
const route = useRoute()

// Refs
const workHoursTableRef = ref<InstanceType<typeof WorkHoursTable>>()

// Use the work record composable
const {
  selectedDate,
  records,
  categories,
  dateStatuses,
  loadingWorkRecords,
  workRecordApproval,
  saveRecords,
  isValidDateString,
  loadDateStatuses,
} = useWorkRecord({
  cacheEnabled: false,
  initialDate: route.query.date as string,
})


async function handleBatchSaveWorkRecords(payload: SaveWorkRecordsPayload) {
  try {
    await saveRecords(payload)
    workHoursTableRef.value?.handleSaveSuccess()
  } catch (error) {
    workHoursTableRef.value?.handleSaveError(error)
  }
}

async function handleDateChange(date: string) {
  await router.push({
    path: route.path,
    query: {
      ...route.query,
      date: date
    }
  })
}

// Handle month change in DatePicker
async function handleMonthChange(year: number, month: number) {
  await loadDateStatuses(year, month)
}

// Watch for route query changes (browser back/forward navigation)
watch(
  () => route.query.date,
  async (newDateQuery) => {
    const newDate = newDateQuery as string
    if (newDate && isValidDateString(newDate) && newDate !== selectedDate.value) {
      selectedDate.value = newDate
    }
  }
)
</script>