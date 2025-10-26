import { ref, reactive, computed, type ComputedRef, type Ref } from 'vue'
import { projectService } from '@/services/domains/project.service'
import type {
  DynamicProjectRow,
  WorkRecordTableState,
  RowValidationError,
  ValidationRules,
  SaveWorkRecordsPayload,
  WorkRecordUpsertRequest,
} from '@/services/types/work-record-table.types'
import type { Project } from '@/services/types/project.types'
import type { WorkRecord } from '@/services/types/work-record.types'

/**
 * Options for useWorkRecordTable composable
 */
export interface UseWorkRecordTableOptions {
  initialDate?: string
  validationRules?: ValidationRules
}

/**
 * UseWorkRecordTable composable interface
 */
export interface UseWorkRecordTable {
  // === 状態管理 ===
  state: WorkRecordTableState
  // === 計算プロパティ ===
  tableData: ComputedRef<DynamicProjectRow[]>
  categoryTotals: ComputedRef<Record<string, number>>
  hasValidationErrors: ComputedRef<boolean>
  validationErrors: Ref<RowValidationError[]>
  
  // === プロジェクト管理 ===
  addProjectRow: (project: Project) => Promise<void>
  removeProjectRow: (rowId: string) => Promise<void>
  
  // === プロジェクト選択 ===
  searchProjects: (query: string, excludeRowId?: string) => Promise<Project[]>
  
  // === 時間管理 ===
  updateCategoryHours: (rowId: string, categoryCode: string, hours: number) => void
  
  // === データ操作 ===
  loadWorkRecords: (date: string, records: WorkRecord[]) => Promise<void>
  buildSaveWorkRecordsPayload: () => Promise<SaveWorkRecordsPayload>
}

// Debounce utility
function debounce<T extends (...args: any[]) => any>(func: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout>
  return ((...args: any[]) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }) as T
}

/**
 * Dynamic Work Record Table Composable
 */
export function useWorkRecordTable(options: UseWorkRecordTableOptions): UseWorkRecordTable {
  const { 
    initialDate = new Date().toISOString().split('T')[0], 
    validationRules = {} 
  } = options

  // Internal state
  const state = reactive<WorkRecordTableState>({
    selectedDate: initialDate,
    projectRows: [],
    originalRows: [],
    categories: [],
    saving: false,
    hasChanges: false,
    searching: false,
    loading: false
  })


  // Validate hours input (0.5 hour increments, max 24 hours)
  const validateHoursInput = (hours: number): number => {
    if (hours < 0) return 0
    if (hours > 24) return 24
    if (hours % 0.5 !== 0) return Math.round(hours * 2) / 2
    return hours
  }

  // Calculate row total
  const calculateRowTotal = (row: DynamicProjectRow): number => {
    return Object.values(row.categoryHours).reduce((sum, hours) => sum + (hours || 0), 0)
  }

  // Generate unique ID
  const generateId = (): string => {
    return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // === Computed Properties ===
  const tableData = computed(() => {
    return state.projectRows.filter(row => !row.isDeleted)
  })

  const totalHours = computed(() => {
    return tableData.value.reduce((sum, row) => sum + row.total, 0)
  })

  const categoryTotals = computed(() => {
    const totals: Record<string, number> = {}
    state.categories.forEach(category => {
      const categoryCode = category.code.value
      totals[categoryCode] = tableData.value.reduce((sum, row) => 
        sum + (row.categoryHours[categoryCode] || 0), 0
      )
    })
    return totals
  })

  const validationErrors = ref<RowValidationError[]>([])
  const hasValidationErrors = computed(() => validationErrors.value.length > 0)

  // === Project Management ===
  const addProjectRow = async (project: Project): Promise<void> => {
    const newId = generateId()
    const newRow: DynamicProjectRow = {
      id: newId,
      projectId: project.id,
      project: project,
      categoryHours: {},
      total: 0,
      isNew: true,
      isDirty: false,
      isDeleted: false,
      tempId: newId
    }

    // Initialize category hours
    state.categories.forEach(category => {
      newRow.categoryHours[category.code.value] = 0
    })

    state.projectRows.push(newRow)
    state.hasChanges = true
  }

  const removeProjectRow = async (rowId: string): Promise<void> => {
    const row = state.projectRows.find(r => r.id === rowId)
    if (!row) return

    if (row.isNew) {
      // Remove new rows completely
      const index = state.projectRows.findIndex(r => r.id === rowId)
      if (index >= 0) {
        state.projectRows.splice(index, 1)
      }
    } else {
      // Mark existing rows as deleted
      row.isDeleted = true
      row.isDirty = true
    }

    state.hasChanges = true
  }

  const searchProjects = async (query: string, excludeRowId?: string): Promise<Project[]> => {
    try {
      state.searching = true

      // Get excluded project IDs
      const excludeIds = state.projectRows
        .filter(row => !row.isDeleted && row.id !== excludeRowId && row.projectId)
        .map(row => row.projectId!)

      const projects = await projectService.search(query)

      // Filter out excluded projects (only IN_PROGRESS projects)
      const filteredProjects = projects.filter(project => 
        !excludeIds.includes(project.id) &&
        project.status === 'IN_PROGRESS'  // Only allow in-progress projects
      )

      return filteredProjects
    } catch (error) {
      console.error('Project search error:', error)
      return []
    } finally {
      state.searching = false
    }
  }

  // === Time Management ===
  const updateCategoryHours = (rowId: string, categoryCode: string, hours: number): void => {
    const row = state.projectRows.find(r => r.id === rowId)
    if (!row) return

    const validatedHours = validateHoursInput(hours)
    row.categoryHours[categoryCode] = validatedHours
    row.total = calculateRowTotal(row)
    row.isDirty = true
    state.hasChanges = true

    // Trigger validation
    debouncedValidation()
  }

  // === Validation ===
  const validateRow = (rowId: string): RowValidationError[] => {
    const errors: RowValidationError[] = []
    const row = state.projectRows.find(r => r.id === rowId)
    if (!row) return errors

    // Project not selected but has hours
    if (row.total > 0 && !row.projectId) {
      errors.push({
        rowId: row.id,
        field: 'project',
        message: 'プロジェクトを選択してください'
      })
    }

    // Max hours per day check
    if (validationRules.maxHoursPerDay && row.total > validationRules.maxHoursPerDay) {
      errors.push({
        rowId: row.id,
        field: 'total',
        message: `1日の最大時間（${validationRules.maxHoursPerDay}時間）を超えています`
      })
    }

    return errors
  }

  const validateAllRows = (): RowValidationError[] => {
    let allErrors: RowValidationError[] = []

    // Validate each row
    tableData.value.forEach(row => {
      allErrors = allErrors.concat(validateRow(row.id))
    })

    // Check for duplicate projects
    const projectCounts = new Map<string, string[]>()
    tableData.value.forEach(row => {
      if (row.projectId) {
        if (!projectCounts.has(row.projectId)) {
          projectCounts.set(row.projectId, [])
        }
        projectCounts.get(row.projectId)!.push(row.id)
      }
    })

    projectCounts.forEach((rowIds, _projectId) => {
      if (rowIds.length > 1) {
        rowIds.forEach(rowId => {
          allErrors.push({
            rowId,
            field: 'project',
            message: '同じプロジェクトが複数選択されています'
          })
        })
      }
    })

    // Check total hours limit
    if (validationRules.maxHoursPerDay && totalHours.value > validationRules.maxHoursPerDay) {
      allErrors.push({
        rowId: 'total',
        field: 'grandTotal',
        message: `合計時間が制限（${validationRules.maxHoursPerDay}時間）を超えています`
      })
    }

    return allErrors
  }

  const debouncedValidation = debounce(() => {
    validationErrors.value = validateAllRows()
  }, 300)

  // === Data Operations ===
  const loadWorkRecords = async (date: string, records: WorkRecord[]): Promise<void> => {
    // console.log('Loading work records for date:', date, records, new Error().stack)
    state.selectedDate = date
    state.projectRows = []

    // Convert work records to dynamic rows
    for (const record of records) {
      const row: DynamicProjectRow = {
        id: record.id,
        projectId: record.projectId,
        project: record.project,
        categoryHours: { ...record.categoryHours },
        total: calculateRowTotal({ categoryHours: record.categoryHours } as DynamicProjectRow),
        isNew: false,
        isDirty: false,
        isDeleted: false
      }
      state.projectRows.push(row)
    }

    // Store original state for change detection
    state.originalRows = JSON.parse(JSON.stringify(state.projectRows))
    state.hasChanges = false
  }

  const buildSaveWorkRecordsPayload = async (): Promise<SaveWorkRecordsPayload> => {
    const newRecords: WorkRecordUpsertRequest[] = []
    const deletedRecordIds: string[] = []
    // Process new and modified rows
    state.projectRows.forEach(row => {
      if (row.isDeleted && !row.isNew) {
        deletedRecordIds.push(row.id)
      } else if (!row.isDeleted && row.projectId) {
        newRecords.push({
          projectId: row.projectId,
          workDate: state.selectedDate,
          categoryHours: row.categoryHours,
          description: row.description || ""
        })
      }
    })

    const payload: SaveWorkRecordsPayload = {
      date: state.selectedDate,
      records: newRecords,
      deletedRecordIds: deletedRecordIds.length > 0 ? deletedRecordIds : undefined
    }
    return payload
  }

  return {
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
  }
}