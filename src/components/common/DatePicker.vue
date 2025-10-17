<template>
  <div class="date-picker-wrapper">
    <VueDatePicker
      v-model="internalDate"
      :locale="locale"
      :format="formatDate"
      :max-date="maxDate"
      :min-date="minDate"
      :enable-time-picker="false"
      auto-apply
      :text-input="false"
      :clearable="false"
      :disabled="disabled"
      :class="textFieldClass"
      :teleport="true"
      :action-row="{ showNow: true, showCancel: true, showSelect: false }"
      :key="locale"
      @update-month-year="handleMonthYearChange"
    >
      <template #day="{ day, date }">
        <v-tooltip
          v-if="getTooltipText(date)"
          location="top"
          :transition="false"
          :z-index="999999"
        >
          <template v-slot:activator="{ props: tooltipProps }">
            <div
              v-bind="tooltipProps"
              class="date-cell"
              :class="getDateCellClass(date)"
            >
              {{ day }}
            </div>
          </template>
          <span>{{ getTooltipText(date) }}</span>
        </v-tooltip>
        <div
          v-else
          class="date-cell"
          :class="getDateCellClass(date)"
        >
          {{ day }}
        </div>
      </template>
    </VueDatePicker>
  </div>
</template>

<script setup lang="ts">
import type { DateStatus } from '@/services/types'
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import VueDatePicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { getJSTDateString } from '@/utils/date'

interface Props {
  modelValue?: string | Date
  max?: Date | string
  min?: Date | string
  disabled?: boolean
  textFieldClass?: string
  dateStatuses?: Record<string, DateStatus>
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => getJSTDateString(),
  max: () => getJSTDateString(),
  disabled: false,
  textFieldClass: 'date-picker-input',
  dateStatuses: () => ({}),
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'month-change': [year: number, month: number]
}>()

const { t: $t, locale } = useI18n()

// Internal date state
const internalDate = ref<Date>(parseDate(props.modelValue))

// Parse string or Date to Date object
function parseDate(value: string | Date): Date {
  if (value instanceof Date) {
    return value
  }
  return new Date(value)
}

// Format Date to string (YYYY-MM-DD)
function formatDateToString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Max date
const maxDate = computed(() => {
  if (!props.max) return undefined
  return parseDate(props.max)
})

// Min date
const minDate = computed(() => {
  if (!props.min) return undefined
  return parseDate(props.min)
})

// Format date for display based on locale
const formatDate = computed(() => {
  return (date: Date): string => {
    if (!date) return ''
    if (locale.value === 'ja') {
      return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
    }
  }
})

// Watch for internal date changes and emit
watch(internalDate, (newDate) => {
  if (newDate) {
    const dateString = formatDateToString(newDate)
    emit('update:modelValue', dateString)
  }
})

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    internalDate.value = parseDate(newValue)
  }
})

// Handle month/year change in calendar
const handleMonthYearChange = (payload: { month: number; year: number }) => {
  // VueDatePicker sends 0-indexed month, so add 1 for 1-indexed month
  emit('month-change', payload.year, payload.month + 1)
}

// Check if date is in the future
const isFutureDate = (date: Date): boolean => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const checkDate = new Date(date)
  checkDate.setHours(0, 0, 0, 0)
  return checkDate > today
}

// Get date cell CSS class based on status
const getDateCellClass = (date: Date): string => {
  const dateString = formatDateToString(date)
  const status = props.dateStatuses?.[dateString]
  if (!status) return ''

  const isWeekendDate = isWeekend(date)
  const isFuture = isFutureDate(date)

  switch (status.approvalStatus) {
    case 'NOT_ENTERED':
      // Don't highlight future dates as missing entry
      if (!status.hasWorkRecord && !isWeekendDate && !isFuture) {
        return 'status-no-record'
      }
      return ''
    case 'PENDING':
      return 'status-pending'
    case 'APPROVED':
      return 'status-approved'
    case 'REJECTED':
      return 'status-rejected'
    default:
      return ''
  }
}

// Check if date is weekend (Saturday or Sunday)
const isWeekend = (date: Date): boolean => {
  const dayOfWeek = date.getDay()
  return dayOfWeek === 0 || dayOfWeek === 6 // 0 = Sunday, 6 = Saturday
}

// Get tooltip text based on date
const getTooltipText = (date: Date): string => {
  const dateString = formatDateToString(date)
  const status = props.dateStatuses?.[dateString]
  if (!status) return ''

  const hoursText = $t('workHours.totalHours', { hours: status.totalHours })

  switch (status.approvalStatus) {
    case 'NOT_ENTERED':
      return status.hasWorkRecord
        ? `${$t('workHours.notEntered')} - ${hoursText}`
        : $t('workHours.noWorkRecord')
    case 'PENDING':
      return `${$t('workHours.pending')} - ${hoursText}`
    case 'APPROVED':
      return `${$t('workHours.approved')} - ${hoursText}`
    case 'REJECTED':
      return `${$t('workHours.rejected')} - ${hoursText}`
    default:
      return ''
  }
}

</script>

<style scoped>
.date-picker-wrapper {
  position: relative;
  z-index: 1;
}

.date-picker-input {
  max-width: 200px;
}

/* Date cell customization */
.date-cell {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

/* Status colors - 工数記録なし: 赤 */
.date-cell.status-no-record {
  background-color: rgba(244, 67, 54, 0.15);
  border-radius: 50%;
}

/* 承認待ち: 黄色 */
.date-cell.status-pending {
  background-color: rgba(255, 193, 7, 0.15);
  border-radius: 50%;
}

/* 承認済み: 緑 */
.date-cell.status-approved {
  background-color: rgba(76, 175, 80, 0.15);
  border-radius: 50%;
}

/* 却下: グレー */
.date-cell.status-rejected {
  background-color: rgba(158, 158, 158, 0.15);
  border-radius: 50%;
}

</style>
