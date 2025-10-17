import { ref, computed, type Ref } from 'vue'
import { jiraService } from '../services'
import { useErrorNotification } from './useErrorNotification'
import type {
  JqlQuery,
  JqlQueryCreateRequest,
  JqlQueryUpdateRequest,
  JqlQuerySearchParams,
  JqlValidationResult,
  ResponseTemplate,
  JiraIssue
} from '../services/types/jira.types'

export interface UseJqlQueryOptions {
  autoLoad?: boolean
  cacheEnabled?: boolean
  enableSearch?: boolean
}

export interface JqlQueryState {
  queries: Ref<JqlQuery[]>
  currentQuery: Ref<JqlQuery | null>
  availableTemplates: Ref<ResponseTemplate[]>
  validationResult: Ref<JqlValidationResult | null>
  testResults: Ref<JiraIssue[]>
  loading: Ref<boolean>
  validating: Ref<boolean>
  testing: Ref<boolean>
  error: Ref<Error | null>
  searchQuery: Ref<string>
}

export interface JqlQueryActions {
  // CRUD Operations
  loadQueries: (params?: JqlQuerySearchParams) => Promise<void>
  loadActiveQueries: () => Promise<void>
  loadQuery: (id: string) => Promise<void>
  createQuery: (query: JqlQueryCreateRequest) => Promise<JqlQuery>
  updateQuery: (id: string, query: JqlQueryUpdateRequest) => Promise<void>
  deleteQuery: (id: string) => Promise<void>
  duplicateQuery: (id: string) => Promise<JqlQuery>
  
  // Validation and Testing
  validateQuery: (id: string) => Promise<JqlValidationResult>
  testQueryExecution: (id: string) => Promise<JiraIssue[]>
  
  // Template Management
  loadAvailableTemplates: () => Promise<void>
  associateTemplate: (queryId: string, templateId: string) => Promise<void>
  dissociateTemplate: (queryId: string) => Promise<void>
  
  // Search and Filtering
  searchQueries: (searchTerm: string) => Promise<void>
  clearSearch: () => void
  
  // Priority Management
  updateQueryPriority: (id: string, priority: number) => Promise<void>
  reorderQueries: (queries: { id: string; priority: number }[]) => Promise<void>
  
  // Status Management
  toggleQueryStatus: (id: string) => Promise<void>
  activateQuery: (id: string) => Promise<void>
  deactivateQuery: (id: string) => Promise<void>
  
  // Data Management
  refreshAll: () => Promise<void>
  clearCache: () => void
}

export interface JqlQueryHelpers {
  // Filtering
  filterActiveQueries: (queries: JqlQuery[]) => JqlQuery[]
  filterByTemplate: (queries: JqlQuery[], templateId: string) => JqlQuery[]
  filterBySearchTerm: (queries: JqlQuery[], searchTerm: string) => JqlQuery[]
  
  // Validation
  validateQueryForm: (query: JqlQueryCreateRequest) => { valid: boolean; errors: string[] }
  isJqlValid: (jql: string) => boolean
  
  // Sorting
  sortByPriority: (queries: JqlQuery[]) => JqlQuery[]
  sortByLastExecution: (queries: JqlQuery[]) => JqlQuery[]
  sortByName: (queries: JqlQuery[]) => JqlQuery[]
  
  // Statistics
  getExecutionStats: (query: JqlQuery) => { 
    lastRun: string | null
    frequency: string
    successRate: number
  }
  
  // Template helpers
  getTemplateForQuery: (queryId: string) => ResponseTemplate | null
  getQueriesForTemplate: (templateId: string) => JqlQuery[]
}

export function useJqlQuery(options: UseJqlQueryOptions = {}) {
  const {
    autoLoad = false,
    cacheEnabled = true,
    enableSearch = true
  } = options

  const errorNotification = useErrorNotification()
  
  // State
  const queries = ref<JqlQuery[]>([])
  const currentQuery = ref<JqlQuery | null>(null)
  const availableTemplates = ref<ResponseTemplate[]>([])
  const validationResult = ref<JqlValidationResult | null>(null)
  const testResults = ref<JiraIssue[]>([])
  const loading = ref(false)
  const validating = ref(false)
  const testing = ref(false)
  const error = ref<Error | null>(null)
  const searchQuery = ref('')

  // Computed Properties
  const activeQueries = computed(() => 
    queries.value.filter(q => q.active)
  )

  const inactiveQueries = computed(() => 
    queries.value.filter(q => !q.active)
  )

  const queriesByPriority = computed(() => 
    [...queries.value].sort((a, b) => b.priority - a.priority)
  )

  const queriesWithTemplates = computed(() => 
    queries.value.filter(q => q.templateId)
  )

  const queriesWithoutTemplates = computed(() => 
    queries.value.filter(q => !q.templateId)
  )

  const filteredQueries = computed(() => {
    let filtered = queries.value

    // Apply search filter
    if (searchQuery.value.trim()) {
      const search = searchQuery.value.toLowerCase().trim()
      filtered = filtered.filter(q => 
        q.queryName.toLowerCase().includes(search) ||
        q.jqlExpression.toLowerCase().includes(search)
        // Removed q.description - property doesn't exist in backend
      )
    }

    return filtered
  })

  // Removed totalExecutions - executionCount doesn't exist in backend
  const totalExecutions = computed(() => 0)

  const averageExecutionCount = computed(() => {
    if (queries.value.length === 0) return 0
    return Math.round(totalExecutions.value / queries.value.length)
  })

  const templatesInUse = computed(() => {
    const templateIds = new Set(queries.value.map(q => q.templateId).filter(Boolean))
    return availableTemplates.value.filter(t => templateIds.has(t.id))
  })

  const queryStats = computed(() => ({
    total: queries.value.length,
    active: activeQueries.value.length,
    inactive: inactiveQueries.value.length,
    withTemplates: queriesWithTemplates.value.length,
    withoutTemplates: queriesWithoutTemplates.value.length,
    totalExecutions: totalExecutions.value,
    averageExecutions: averageExecutionCount.value
  }))

  // CRUD Operations
  async function loadQueries(params?: JqlQuerySearchParams): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      queries.value = await jiraService.getAllQueries(params, cacheEnabled)
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
    } finally {
      loading.value = false
    }
  }

  async function loadActiveQueries(): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      queries.value = await jiraService.getActiveQueries(cacheEnabled)
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
    } finally {
      loading.value = false
    }
  }

  async function loadQuery(id: string): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      currentQuery.value = await jiraService.getQueryById(id, cacheEnabled)
      
      // Add to queries list if not already there
      const index = queries.value.findIndex(q => q.id === id)
      if (index === -1) {
        queries.value.push(currentQuery.value)
      } else {
        queries.value[index] = currentQuery.value
      }
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
    } finally {
      loading.value = false
    }
  }

  async function createQuery(query: JqlQueryCreateRequest): Promise<JqlQuery> {
    loading.value = true
    error.value = null
    
    try {
      // Validate form first
      const validation = validateQueryForm(query)
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
      }

      const newQuery = await jiraService.createQuery(query)
      
      // Add to local state
      queries.value.unshift(newQuery) // Add to beginning
      currentQuery.value = newQuery
      
      errorNotification.showSuccessNotification(
        `Query "${newQuery.queryName}" created successfully`,
        { duration: 3000 }
      )
      
      return newQuery
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateQuery(id: string, query: JqlQueryUpdateRequest): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      const updated = await jiraService.updateQuery(id, query)
      
      // Update local state
      const index = queries.value.findIndex(q => q.id === id)
      if (index !== -1) {
        queries.value[index] = updated
      }
      
      // Update current query if it's the same
      if (currentQuery.value?.id === id) {
        currentQuery.value = updated
      }
      
      errorNotification.showSuccessNotification(
        `Query "${updated.queryName}" updated successfully`,
        { duration: 3000 }
      )
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteQuery(id: string): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      const query = queries.value.find(q => q.id === id)
      await jiraService.deleteQuery(id)
      
      // Remove from local state
      queries.value = queries.value.filter(q => q.id !== id)
      
      // Clear current query if it's the deleted one
      if (currentQuery.value?.id === id) {
        currentQuery.value = null
      }
      
      errorNotification.showSuccessNotification(
        `Query "${query?.queryName || 'Unknown'}" deleted successfully`,
        { duration: 3000 }
      )
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function duplicateQuery(id: string): Promise<JqlQuery> {
    loading.value = true
    error.value = null
    
    try {
      const originalQuery = queries.value.find(q => q.id === id)
      if (!originalQuery) {
        throw new Error('Query not found')
      }

      const duplicateRequest: JqlQueryCreateRequest = {
        queryName: `${originalQuery.queryName} (Copy)`,
        jqlExpression: originalQuery.jqlExpression,
        templateId: originalQuery.templateId,
        // Removed description - property doesn't exist in backend
        isActive: false, // Duplicates start inactive
        priority: originalQuery.priority
      }

      return await createQuery(duplicateRequest)
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Validation and Testing
  async function validateQuery(id: string): Promise<JqlValidationResult> {
    validating.value = true
    error.value = null
    
    try {
      const result = await jiraService.validateQuery(id)
      validationResult.value = result
      
      if (result.valid) {
        errorNotification.showSuccessNotification(
          'JQL query is valid',
          { duration: 2000 }
        )
      } else {
        errorNotification.showWarningNotification(
          `JQL validation failed: ${result.errorMessage || 'Unknown validation error'}`
        )
      }
      
      return result
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
      throw err
    } finally {
      validating.value = false
    }
  }

  async function testQueryExecution(id: string): Promise<JiraIssue[]> {
    testing.value = true
    error.value = null
    
    try {
      const results = await jiraService.testQueryExecution(id)
      testResults.value = results
      errorNotification.showInfoNotification(
        `Query test completed. Found ${results.length} issues.`,
        { duration: 3000 }
      )
      
      return results
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
      throw err
    } finally {
      testing.value = false
    }
  }

  // Template Management
  async function loadAvailableTemplates(): Promise<void> {
    try {
      availableTemplates.value = await jiraService.getAllTemplates({}, cacheEnabled)
    } catch (err) {
      error.value = err as Error
      console.warn('Failed to load templates:', err)
    }
  }

  async function associateTemplate(queryId: string, templateId: string): Promise<void> {
    try {
      await updateQuery(queryId, { templateId })
      
      errorNotification.showSuccessNotification(
        'Template associated successfully',
        { duration: 2000 }
      )
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
      throw err
    }
  }

  async function dissociateTemplate(queryId: string): Promise<void> {
    try {
      await updateQuery(queryId, { templateId: undefined })
      
      errorNotification.showSuccessNotification(
        'Template dissociated successfully',
        { duration: 2000 }
      )
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
      throw err
    }
  }

  // Search and Filtering
  async function searchQueries(searchTerm: string): Promise<void> {
    if (!enableSearch) return
    
    searchQuery.value = searchTerm
    
    if (searchTerm.trim()) {
      loading.value = true
      try {
        queries.value = await jiraService.searchQueries(searchTerm)
      } catch (err) {
        error.value = err as Error
        errorNotification.showErrorNotification(err as Error)
      } finally {
        loading.value = false
      }
    } else {
      await loadQueries() // Load all queries if search is cleared
    }
  }

  function clearSearch(): void {
    searchQuery.value = ''
    loadQueries() // Reload all queries
  }

  // Priority Management
  async function updateQueryPriority(id: string, priority: number): Promise<void> {
    try {
      await updateQuery(id, { priority })
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
      throw err
    }
  }

  async function reorderQueries(reorderedQueries: { id: string; priority: number }[]): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      // Update all queries in parallel
      await Promise.all(
        reorderedQueries.map(({ id, priority }) => 
          jiraService.updateQuery(id, { priority })
        )
      )
      
      // Refresh the list to reflect new order
      await loadQueries()
      
      errorNotification.showSuccessNotification(
        'Query order updated successfully',
        { duration: 2000 }
      )
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Status Management
  async function toggleQueryStatus(id: string): Promise<void> {
    const query = queries.value.find(q => q.id === id)
    if (!query) return
    
    // Send all query data with updated status
    await updateQuery(id, {
      queryName: query.queryName,
      jqlExpression: query.jqlExpression,
      templateId: query.templateId,
      priority: query.priority,
      isActive: !query.active  // Convert from response 'active' to request 'isActive'
    })
  }

  async function activateQuery(id: string): Promise<void> {
    const query = queries.value.find(q => q.id === id)
    if (!query) return
    
    // Send all query data with activated status
    await updateQuery(id, {
      queryName: query.queryName,
      jqlExpression: query.jqlExpression,
      templateId: query.templateId,
      priority: query.priority,
      isActive: true
    })
  }

  async function deactivateQuery(id: string): Promise<void> {
    const query = queries.value.find(q => q.id === id)
    if (!query) return
    
    // Send all query data with deactivated status
    await updateQuery(id, {
      queryName: query.queryName,
      jqlExpression: query.jqlExpression,
      templateId: query.templateId,
      priority: query.priority,
      isActive: false
    })
  }

  // Data Management
  async function refreshAll(): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      await Promise.all([
        loadQueries(),
        loadAvailableTemplates()
      ])
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
    } finally {
      loading.value = false
    }
  }

  function clearCache(): void {
    jiraService.clearAllCaches()
    refreshAll()
  }

  // Helper Functions
  function filterActiveQueries(queryList: JqlQuery[]): JqlQuery[] {
    return queryList.filter(q => q.active)
  }

  function filterByTemplate(queryList: JqlQuery[], templateId: string): JqlQuery[] {
    return queryList.filter(q => q.templateId === templateId)
  }

  function filterBySearchTerm(queryList: JqlQuery[], searchTerm: string): JqlQuery[] {
    const search = searchTerm.toLowerCase().trim()
    if (!search) return queryList
    
    return queryList.filter(q => 
      q.queryName.toLowerCase().includes(search) ||
      q.jqlExpression.toLowerCase().includes(search)
      // Removed q.description - property doesn't exist in backend
    )
  }

  function validateQueryForm(query: JqlQueryCreateRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (!query.queryName?.trim()) {
      errors.push('Query name is required')
    }
    
    if (!query.jqlExpression?.trim()) {
      errors.push('JQL expression is required')
    }
    
    if (query.priority !== undefined && (query.priority < 0 || query.priority > 100)) {
      errors.push('Priority must be between 0 and 100')
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }

  function isJqlValid(jql: string): boolean {
    // Basic JQL syntax validation
    if (!jql.trim()) return false
    
    // Check for basic JQL structure - must have at least one field comparison
    const hasFieldComparison = /\w+\s*[=!~<>]\s*["\w]+/i.test(jql)
    
    return hasFieldComparison
  }

  function sortByPriority(queryList: JqlQuery[]): JqlQuery[] {
    return [...queryList].sort((a, b) => b.priority - a.priority)
  }

  // Removed sortByLastExecution - lastExecuted property doesn't exist in backend
  function sortByLastExecution(queryList: JqlQuery[]): JqlQuery[] {
    return [...queryList] // No sorting available without lastExecuted
  }

  function sortByName(queryList: JqlQuery[]): JqlQuery[] {
    return [...queryList].sort((a, b) => a.queryName.localeCompare(b.queryName))
  }

  function getExecutionStats(query: JqlQuery): { 
    lastRun: string | null
    frequency: string
    successRate: number
  } {
    // Backend doesn't provide lastExecuted or executionCount
    const lastRun = null
    const frequency = 'Unknown' // No execution data available
    const successRate = 0 // No execution data available
    
    return {
      lastRun,
      frequency,
      successRate
    }
  }

  function getTemplateForQuery(queryId: string): ResponseTemplate | null {
    const query = queries.value.find(q => q.id === queryId)
    if (!query?.templateId) return null
    
    return availableTemplates.value.find(t => t.id === query.templateId) || null
  }

  function getQueriesForTemplate(templateId: string): JqlQuery[] {
    return queries.value.filter(q => q.templateId === templateId)
  }

  // Auto-load initial data
  if (autoLoad) {
    Promise.all([
      loadQueries(),
      loadAvailableTemplates()
    ]).catch(err => {
      console.warn('Failed to auto-load query data:', err)
    })
  }

  return {
    // State
    queries,
    currentQuery,
    availableTemplates,
    validationResult,
    testResults,
    loading,
    validating,
    testing,
    error,
    searchQuery,
    
    // Computed
    activeQueries,
    inactiveQueries,
    queriesByPriority,
    queriesWithTemplates,
    queriesWithoutTemplates,
    filteredQueries,
    totalExecutions,
    averageExecutionCount,
    templatesInUse,
    queryStats,
    
    // Actions
    loadQueries,
    loadActiveQueries,
    loadQuery,
    createQuery,
    updateQuery,
    deleteQuery,
    duplicateQuery,
    validateQuery,
    testQueryExecution,
    loadAvailableTemplates,
    associateTemplate,
    dissociateTemplate,
    searchQueries,
    clearSearch,
    updateQueryPriority,
    reorderQueries,
    toggleQueryStatus,
    activateQuery,
    deactivateQuery,
    refreshAll,
    clearCache,
    
    // Helpers
    filterActiveQueries,
    filterByTemplate,
    filterBySearchTerm,
    validateQueryForm,
    isJqlValid,
    sortByPriority,
    sortByLastExecution,
    sortByName,
    getExecutionStats,
    getTemplateForQuery,
    getQueriesForTemplate
  }
}