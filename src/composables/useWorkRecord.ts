import { ref, computed, type Ref } from 'vue'
import { workRecordService, workCategoryService, projectService } from '@/services'
import { useDateStatusesStore } from '@/stores/dateStatuses'
import { getJSTDateString } from '@/utils/date'

import type {
  WorkRecord,
  WorkRecordUpsertRequest,
  WorkCategory,
  WorkHoursSummaryResponse,
  WorkRecordsResponse,
  WorkRecordApproval,
  Project,
  DateStatus
} from '@/services/types'
import type { SaveWorkRecordsPayload } from '@/services/types/work-record-table.types'
import { watch } from 'vue'

export interface UseWorkRecordOptions {
  cacheEnabled?: boolean
  initialDate?: string
}

export interface WorkRecordState {
  records: Ref<WorkRecord[]>
  categories: Ref<WorkCategory[]>
  summary: Ref<WorkHoursSummaryResponse | null>
  workRecordApproval: Ref<WorkRecordApproval | null>
  dateStatuses: Ref<{ [date: string]: DateStatus }>
  loading: Ref<boolean>
  error: Ref<Error | null>
}

export interface WorkRecordActions {
  // CRUD Operations
  loadRecords: (date: string) => Promise<void>
  loadRecordsByPeriod: (startDate: string, endDate: string) => Promise<void>
  saveRecords: (date: string, records: WorkRecordUpsertRequest[]) => Promise<void>
  
  // Summary & Analytics
  loadSummary: (startDate: string, endDate: string) => Promise<void>
  loadMonthlyRecords: (year: number, month: number) => Promise<void>
  
  // Date Statuses
  loadDateStatuses: (year: number, month: number) => Promise<void>
  
  // Utilities
  calculateDailyTotal: (records: WorkRecord[]) => number
  calculateProjectHours: (records: WorkRecord[]) => Map<string, number>
  
  // Data Management
  loadWorkCategories: () => Promise<void>
  refreshAll: () => Promise<void>
  clearCache: () => void
}

export interface WorkRecordHelpers {
  // Date Utilities
  formatWorkDate: (date: Date | string) => string
  getWeekRange: (date: Date) => { start: string; end: string }
  getMonthRange: (date: Date) => { start: string; end: string }
  isWeekend: (date: Date | string) => boolean
  isApproved: (record: WorkRecord) => boolean
  
  // Validation
  validateWorkHours: (hours: number) => boolean
  validateTotalDailyHours: (records: WorkRecord[]) => boolean
  canEditRecord: (record: WorkRecord) => boolean
}

export function useWorkRecord(options: UseWorkRecordOptions = {}) {
  const {
    cacheEnabled = false,
    initialDate = getJSTDateString()
  } = options

  // Use date statuses store
  const dateStatusesStore = useDateStatusesStore()

  // State
  const selectedDate = ref<string>(getInitialDate(initialDate))
  const currentCalendarMonth = ref(getInitialCalendarMonth(getInitialDate(initialDate)))
  const records = ref<WorkRecord[]>([])
  const categories = ref<WorkCategory[]>([])
  const recentProjects = ref<Project[]>([])
  const summary = ref<WorkHoursSummaryResponse | null>(null)
  const workRecordApproval = ref<WorkRecordApproval | null>(null)
  const loadingWorkRecords = ref(false)
  const loadingDateStatuses = ref(false)
  const loadingSummary = ref(false)
  const error = ref<Error | null>(null)

  // Private state for caching
  const lastFetchDate = ref<string>('')

  // Computed Properties
  const totalHours = computed(() => 
    records.value.reduce((sum, record) => {
      const hours = Object.values(record.categoryHours || {})
        .reduce((total, h) => total + h, 0)
      return sum + hours
    }, 0)
  )

  const pendingHours = computed(() =>
    records.value
      .reduce((sum, record) => {
        const hours = Object.values(record.categoryHours || {})
          .reduce((total, h) => total + h, 0)
        return sum + hours
      }, 0)
  )

  const approvedHours = computed(() =>
    records.value
      .reduce((sum, record) => {
        const hours = Object.values(record.categoryHours || {})
          .reduce((total, h) => total + h, 0)
        return sum + hours
      }, 0)
  )

  // Get date statuses from store
  const dateStatuses = computed(() => dateStatusesStore.allDateStatuses)

  const weeklyAverage = computed(() => {
    if (!summary.value) return 0
    return summary.value.totalHours / (summary.value.totalDays || 1)
  })

  // const projectBreakdown = computed(() => {
  //   const breakdown = new Map<string, number>()
    
  //   records.value.forEach(record => {
  //     const project = projects.value.find(p => p.id === record.projectId)
  //     if (project) {
  //       const hours = Object.values(record.categoryHours || {})
  //         .reduce((sum, h) => sum + h, 0)
  //       breakdown.set(project.name, (breakdown.get(project.name) || 0) + hours)
  //     }
  //   })

  //   const total = Array.from(breakdown.values()).reduce((sum, h) => sum + h, 0)
    
  //   return Array.from(breakdown.entries())
  //     .map(([project, hours]) => ({
  //       project,
  //       hours,
  //       percentage: total > 0 ? (hours / total) * 100 : 0
  //     }))
  //     .sort((a, b) => b.hours - a.hours)
  // })

  // Approval status computed properties
  const isApproved = computed(() => {
    return workRecordApproval.value?.approvalStatus === 'APPROVED'
  })

  const isRejected = computed(() => {
    return workRecordApproval.value?.approvalStatus === 'REJECTED'
  })

  const isPending = computed(() => {
    return workRecordApproval.value?.approvalStatus === 'PENDING'
  })

  const approvalStatus = computed(() => {
    return workRecordApproval.value?.approvalStatus || null
  })

  const canEdit = computed(() => {
    return !isApproved.value
  })

  // Total hours
  const grandTotal = computed(() => {
    return calculateDailyTotal(records.value)
  })

  // Missing dates count (derived from dateStatuses)
  const missingDatesCount = computed(() => {
    return Object.values(dateStatuses.value).filter(status => 
      status.approvalStatus === 'NOT_ENTERED' && !status.hasWorkRecord
    ).length
  })

  async function loadRecords(date: string) {
    // loadingWorkRecords.value = true
    error.value = null
    
    try {
      const response: WorkRecordsResponse = await workRecordService.getWorkRecordsWithApprovalStatus(
        date,
        cacheEnabled
      )
      
      records.value = response.workRecords
      workRecordApproval.value = response.workRecordApproval
      lastFetchDate.value = date
    } catch (err) {
      error.value = err as Error
      console.error('Failed to fetch work records with approval status:', err)
      // Reset to empty state on error
      records.value = []
      workRecordApproval.value = null
      throw err
    } finally {
      // loadingWorkRecords.value = false
    }
  }

  async function saveRecords(payload: SaveWorkRecordsPayload) {
    // savingWorkRecords.value = true
    error.value = null
    
    try {
      const workRecordsResponse = await workRecordService.saveWorkRecords(payload)
      records.value = workRecordsResponse.workRecords
      workRecordApproval.value = workRecordsResponse.workRecordApproval
      
      const localDate = createLocalDate(payload.date)
      const weekRange = getWeekRange(localDate)

      await loadSummary(weekRange.start, weekRange.end)
      await loadDateStatuses(localDate.getFullYear(), localDate.getMonth()+1)

    } catch (err) {
      error.value = err as Error
      // errorNotification.showErrorNotification(err as Error)
      // console.error('Failed to save work records:', err)
      throw err
    } finally {
      // savingWorkRecords.value = false
    }
  }

  async function loadSummary(startDate: string, endDate: string) {
    // loadingSummary.value = true
    error.value = null
    
    try {
      const data = await workRecordService.getWorkHoursSummary(
        startDate,
        endDate,
        cacheEnabled
      )
      summary.value = data
    } catch (err) {
      error.value = err as Error
      console.error('Failed to load work hours summary:', err)
    } finally {
      // loadingSummary.value = false
    }
  }

  async function loadDateStatuses(year: number, month: number) {
    loadingDateStatuses.value = true
    error.value = null

    try {
      await dateStatusesStore.loadDateStatuses(year, month, !cacheEnabled)
    } catch (err) {
      error.value = err as Error
      console.error('Failed to load date statuses:', err)
    } finally {
      loadingDateStatuses.value = false
    }
  }

  async function loadWorkCategories() {
    try {
      if (categories.value.length != 0)  return
      categories.value = await workCategoryService.getWorkCategories(cacheEnabled)
    } catch (err) {
      error.value = err as Error
      console.error('Failed to load work categories:', err)
    }
  }

  async function loadRecentWorkRecordedProjects() {
    try {
      if(recentProjects.value.length != 0) return
      recentProjects.value = await projectService.getRecentWorkRecordedProjects()
    } catch (err) {
      error.value = err as Error
      console.error('Failed to load recent work recorded projects:', err)
    }
  }

  async function loadPopularProjects() {
    try {
      if( recentProjects.value.length != 0) return
      recentProjects.value = await projectService.getPopularProjects()
    } catch (err) {
      error.value = err as Error
      console.error('Failed to load popular projects:', err)
    }
  }

  async function refreshAll() {
    await Promise.all([
      loadWorkCategories(),
      loadPopularProjects(),
      loadRecentWorkRecordedProjects(),
      lastFetchDate.value && loadRecords(lastFetchDate.value)
    ].filter(Boolean))
  }

  function clearCache() {
    // Clear date statuses cache
    dateStatusesStore.clearCache()

    // Clear cache by reloading without cache
    if (lastFetchDate.value) {
      loadRecords(lastFetchDate.value)
    }
  }

  // Utility Functions
  function calculateDailyTotal(recordsList: WorkRecord[]): number {
    return recordsList.reduce((total, record) => {
      const hours = Object.values(record.categoryHours || {})
        .reduce((sum, h) => sum + h, 0)
      return total + hours
    }, 0)
  }

  function _calculateProjectHours(recordsList: WorkRecord[]): Map<string, number> {
    const projectHours = new Map<string, number>()

    recordsList.forEach(record => {
      const hours = Object.values(record.categoryHours || {})
        .reduce((sum, h) => sum + h, 0)

      const current = projectHours.get(record.projectId) || 0
      projectHours.set(record.projectId, current + hours)
    })

    return projectHours
  }

  // Calculate total by category
  function _calculateCategoryHours(recordsList: WorkRecord[]): Map<string, number> {
    const categoryHours = new Map<string, number>()

    recordsList.forEach(record => {
      Object.entries(record.categoryHours || {}).forEach(([categoryId, hours]) => {
        const current = categoryHours.get(categoryId) || 0
        categoryHours.set(categoryId, current + (hours || 0))
      })
    })

    return categoryHours
  }

  // Calculate total hours for a specific project
  function _calculateProjectTotal(recordsList: WorkRecord[], projectId: string): number {
    return recordsList
      .filter(record => record.projectId === projectId)
      .reduce((sum, record) => {
        const hours = Object.values(record.categoryHours || {})
          .reduce((s, h) => s + (h || 0), 0)
        return sum + hours
      }, 0)
  }

  // Calculate total hours for a specific category
  function _calculateCategoryTotal(recordsList: WorkRecord[], categoryId: string): number {
    return recordsList.reduce((sum, record) => {
      return sum + (record.categoryHours?.[categoryId] || 0)
    }, 0)
  }

  // Date Helpers
  function createLocalDate(dateStr: string): Date {
    // YYYY-MM-DD形式の文字列をローカルタイムゾーンのDateに変換
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day) // monthは0ベース
  }
  
  function formatWorkDate(date: Date | string): string {
    let d: Date
    if (typeof date === 'string') {
      // YYYY-MM-DD形式の文字列の場合はローカルタイムゾーンで作成
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        d = createLocalDate(date)
      } else {
        d = new Date(date)
      }
    } else {
      d = date
    }
    
    // ローカル時間でYYYY-MM-DD形式にフォーマット
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function getWeekRange(date: Date) {
    const start = new Date(date)
    const end = new Date(date)
    
    // Get Monday of the week
    const day = start.getDay()
    const diff = start.getDate() - day + (day === 0 ? -6 : 1)
    start.setDate(diff)
    
    // Get Sunday of the week
    end.setDate(start.getDate() + 6)
    
    return {
      start: formatWorkDate(start),
      end: formatWorkDate(end)
    }
  }

  function getMonthRange(date: Date) {
    const year = date.getFullYear()
    const month = date.getMonth()
    
    return {
      start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      end: new Date(year, month + 1, 0).toISOString().split('T')[0]
    }
  }

  function isWeekend(date: Date | string): boolean {
    const d = typeof date === 'string' ? new Date(date) : date
    const day = d.getDay()
    return day === 0 || day === 6
  }

  function isRecordApproved(_record: WorkRecord): boolean {
    // TODO: Add approvalStatus when available
    return false
  }

  // Function to get initial date from query params or current date
  function getInitialDate(dateStr: string): string {
    if (dateStr && isValidDateString(dateStr)) {
      return dateStr
    }
    return formatWorkDate(new Date())
  }

  // Function to validate date string format
  function isValidDateString(dateStr: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(dateStr)) return false

    const date = new Date(dateStr)
    return !isNaN(date.getTime()) && dateStr === date.toISOString().split('T')[0]
  }

  // Function to get initial calendar date based on selected date
  function getInitialCalendarMonth(dateStr: string) {
    const date = new Date(dateStr)
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1
    }
  }

  // Validation Helpers
  function validateWorkHours(hours: number): boolean {
    return hours >= 0 && hours <= 24
  }

  function validateTotalDailyHours(recordsList: WorkRecord[]): boolean {
    const total = calculateDailyTotal(recordsList)
    return total <= 24
  }

  function canEditRecord(record: WorkRecord): boolean {
    // Cannot edit approved records
    if (isRecordApproved(record)) return false
    
    // Cannot edit records older than 30 days
    const recordDate = new Date(record.workDate)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    return recordDate >= thirtyDaysAgo
  }

  watch(selectedDate, async (newDate) => {
    if (newDate && isValidDateString(newDate)) {
      await loadWorkCategories()
      await loadPopularProjects()
      await loadRecentWorkRecordedProjects()
      await loadRecords(newDate)
      const localDate = createLocalDate(newDate)
      const weekRange = getWeekRange(localDate)
      await loadSummary(weekRange.start, weekRange.end)
    }
  }, { immediate: true })

  watch(currentCalendarMonth, async (newMonth) => {
    if (newMonth) {
      await loadDateStatuses(newMonth.year, newMonth.month)
    }
  }, { immediate: true })

  return {
    // State
    selectedDate,
    currentCalendarMonth,
    records,
    categories,
    summary,
    workRecordApproval,
    dateStatuses,
    loadingWorkRecords,
    loadingDateStatuses,
    loadingSummary,
    error,
    
    // Computed
    totalHours,
    pendingHours,
    approvedHours,
    weeklyAverage,
    // projectBreakdown,
    grandTotal,
    missingDatesCount,
    isApproved,
    isRejected,
    isPending,
    approvalStatus,
    canEdit,
    
    // Actions
    loadRecords,
    saveRecords,
    loadDateStatuses,
    refreshAll,
    clearCache,

    // Utilities
    formatWorkDate,
    isValidDateString,
    getWeekRange,
    getMonthRange,
    isWeekend,
    isRecordApproved,
    validateWorkHours,
    validateTotalDailyHours,
    canEditRecord
  }
}