import { ref, computed } from 'vue'
import { useToast } from 'vue-toastification'
import { useI18n } from 'vue-i18n'
import { jiraService } from '@/services/domains/jira.service'
import type {
  JqlQuery,
  JqlQueryCreateRequest,
  JqlQueryUpdateRequest,
  JqlValidationResult,
  ResponseTemplate
} from '@/services/types/jira.types'

export interface UseJqlQueryManagerOptions {
  autoLoad?: boolean
}

export function useJqlQueryManager(_options: UseJqlQueryManagerOptions = {}) {
  
  const toast = useToast()
  const { t } = useI18n()

  // Data
  const loading = ref(false)
  const queries = ref<JqlQuery[]>([])
  const templates = ref<ResponseTemplate[]>([])
  const templatesLoading = ref(false)
  const searchQuery = ref('')
  const statusFilter = ref<boolean | null>(null)
  const templateFilter = ref<string | null>(null)

  // Dialog states
  const showQueryDialog = ref(false)
  const showDeleteDialog = ref(false)
  const editingQuery = ref<JqlQuery | null>(null)
  const deletingQuery = ref<JqlQuery | null>(null)

  // Form data
  const queryFormRef = ref()
  const queryFormValid = ref(false)
  const queryForm = ref<JqlQueryCreateRequest>({
    queryName: '',
    jqlExpression: '',
    templateId: undefined,
    isActive: true,
    priority: 1
  })

  // Validation and processing states
  const jqlValidation = ref<JqlValidationResult | null>(null)
  const validatingQueries = ref(new Set<string>())
  const saving = ref(false)
  const deleting = ref(false)

  // Validation rules
  const rules = {
    required: (value: any) => !!value || t('validation.required'),
    maxLength: (length: number) => (value: string) => 
      !value || value.length <= length || t('validation.maxLength', { length }),
    minValue: (min: number) => (value: number) => 
      value >= min || t('validation.minValue', { min })
  }

  // Table headers
  const headers = computed(() => [
    { title: t('jira.queries.queryName'), key: 'queryName', sortable: true, width: '350px' },
    { title: t('common.status'), key: 'active', sortable: true, width: '120px', align: 'center' as const },
    { title: t('jira.queries.priority'), key: 'priority', sortable: true, width: '120px' },
    { title: t('common.created'), key: 'createdAt', sortable: true, width: '180px' },
    { title: t('common.actions'), key: 'actions', sortable: false, width: '200px', align: 'center' as const }
  ])

  // Computed properties
  const filteredQueries = computed(() => {
    let filtered = queries.value

    // Filter by search query
    if (searchQuery.value) {
      const search = searchQuery.value.toLowerCase()
      filtered = filtered.filter(query =>
        query.queryName.toLowerCase().includes(search) ||
        query.jqlExpression.toLowerCase().includes(search)
      )
    }

    // Filter by status
    if (statusFilter.value !== null) {
      filtered = filtered.filter(query => query.active === statusFilter.value)
    }

    // Filter by template
    if (templateFilter.value) {
      filtered = filtered.filter(query => query.templateId === templateFilter.value)
    }

    return filtered
  })

  const statusOptions = computed(() => [
    { title: t('jira.queries.status.active'), value: true },
    { title: t('jira.queries.status.inactive'), value: false }
  ])

  const templateOptions = computed(() => [
    { title: t('jira.queries.allTemplates'), value: null },
    ...templates.value.map(template => ({
      title: template.templateName,
      value: template.id
    }))
  ])

  const templateSelectOptions = computed(() => [
    ...templates.value.map(template => ({
      title: template.templateName,
      value: template.id,
      raw: template
    }))
  ])

  // Data loading methods
  const fetchQueries = async (): Promise<void> => {
    loading.value = true
    try {
      queries.value = await jiraService.getAllQueries()
    } catch (error) {
      toast.error(t('jira.queries.fetchFailed'))
      console.error('Failed to fetch JQL queries:', error)
    } finally {
      loading.value = false
    }
  }

  const fetchTemplates = async (): Promise<void> => {
    templatesLoading.value = true
    try {
      templates.value = await jiraService.getAllTemplates()
    } catch (error) {
      toast.error(t('jira.templates.fetchFailed'))
      console.error('Failed to fetch templates:', error)
    } finally {
      templatesLoading.value = false
    }
  }

  const loadData = async (): Promise<void> => {
    await Promise.all([fetchQueries(), fetchTemplates()])
  }

  // Dialog management
  const openCreateDialog = (): void => {
    editingQuery.value = null
    queryForm.value = {
      queryName: '',
      jqlExpression: '',
      templateId: undefined,
      isActive: true,
      priority: getNextPriority()
    }
    jqlValidation.value = null
    showQueryDialog.value = true
  }

  const openEditDialog = (query: JqlQuery): void => {
    editingQuery.value = query
    queryForm.value = {
      queryName: query.queryName,
      jqlExpression: query.jqlExpression,
      templateId: query.templateId,
      isActive: query.active,
      priority: query.priority
    }
    jqlValidation.value = null
    showQueryDialog.value = true
  }

  const closeQueryDialog = (): void => {
    showQueryDialog.value = false
    jqlValidation.value = null
    if (queryFormRef.value) {
      queryFormRef.value.reset()
    }
  }

  const confirmDelete = (query: JqlQuery): void => {
    deletingQuery.value = query
    showDeleteDialog.value = true
  }

  const closeDeleteDialog = (): void => {
    showDeleteDialog.value = false
    deletingQuery.value = null
  }

  // Query operations
  const getNextPriority = (): number => {
    if (queries.value.length === 0) return 1
    return Math.max(...queries.value.map(q => q.priority)) + 1
  }

  const saveQuery = async (): Promise<void> => {
    if (!queryFormRef.value?.validate()) return

    saving.value = true
    try {
      if (editingQuery.value) {
        // Update existing query
        const updatedQuery = await jiraService.updateQuery(
          editingQuery.value.id,
          queryForm.value as JqlQueryUpdateRequest
        )
        const index = queries.value.findIndex(q => q.id === editingQuery.value!.id)
        if (index !== -1) {
          queries.value[index] = updatedQuery
        }
        toast.success(t('jira.queries.updateSuccess'))
      } else {
        // Create new query
        const newQuery = await jiraService.createQuery(queryForm.value)
        queries.value.push(newQuery)
        toast.success(t('jira.queries.createSuccess'))
      }

      closeQueryDialog()
    } catch (error) {
      const message = editingQuery.value ? t('jira.queries.updateFailed') : t('jira.queries.createFailed')
      toast.error(message)
      console.error('Failed to save query:', error)
    } finally {
      saving.value = false
    }
  }

  const deleteQuery = async (): Promise<void> => {
    if (!deletingQuery.value) return

    deleting.value = true
    try {
      await jiraService.deleteQuery(deletingQuery.value.id)
      queries.value = queries.value.filter(q => q.id !== deletingQuery.value!.id)
      toast.success(t('jira.queries.deleteSuccess'))
      closeDeleteDialog()
    } catch (error) {
      toast.error(t('jira.queries.deleteFailed'))
      console.error('Failed to delete query:', error)
    } finally {
      deleting.value = false
    }
  }

  const toggleQueryStatus = async (query: JqlQuery): Promise<void> => {
    try {
      // Send all query data with updated status
      const updatedQuery = await jiraService.updateQuery(query.id, {
        queryName: query.queryName,
        jqlExpression: query.jqlExpression,
        templateId: query.templateId,
        priority: query.priority,
        isActive: !query.active
      })
      
      const index = queries.value.findIndex(q => q.id === query.id)
      if (index !== -1) {
        queries.value[index] = updatedQuery
      }
      
      const statusText = updatedQuery.active ? t('jira.queries.status.active') : t('jira.queries.status.inactive')
      toast.success(t('jira.queries.statusChanged', { name: query.queryName, status: statusText }))
    } catch (error) {
      toast.error(t('jira.queries.statusChangeFailed'))
      console.error('Failed to toggle query status:', error)
    }
  }

  // Validation methods
  const validateJqlSyntax = async (): Promise<void> => {
    if (!queryForm.value.jqlExpression.trim()) {
      jqlValidation.value = null
      return
    }

    try {
      // For new queries, we can't validate without saving first
      if (!editingQuery.value) {
        jqlValidation.value = {
          valid: true,
          matchingProjectCount: 0
        }
        return
      }

      jqlValidation.value = await jiraService.validateQuery(editingQuery.value.id)
    } catch (error) {
      jqlValidation.value = {
        valid: false,
        matchingProjectCount: 0,
        errorMessage: t('jira.queries.validationFailed')
      }
      console.error('Failed to validate JQL:', error)
    }
  }

  const validateQuery = async (query: JqlQuery): Promise<void> => {
    validatingQueries.value.add(query.id)
    try {
      const result = await jiraService.validateQuery(query.id)
      const title = result.valid ? t('jira.queries.validationSuccess') : t('jira.queries.validationFailed')
      const type = result.valid ? 'success' : 'error'
      
      const message = result.valid ? t('jira.queries.validationSuccessDetail') : result.errorMessage
      
      // @ts-expect-error - vue-toastification types issue
      toast[type](title + (message ? '\n' + message : ''))
    } catch (error) {
      toast.error(t('jira.queries.validationFailed'))
      console.error('Failed to validate query:', error)
    } finally {
      validatingQueries.value.delete(query.id)
    }
  }


  // Utility functions
  const getTemplateName = (templateId: string): string => {
    const template = templates.value.find(t => t.id === templateId)
    return template?.templateName || templateId
  }

  const truncateJql = (jql: string): string => {
    return jql.length > 60 ? jql.substring(0, 60) + '...' : jql
  }

  const getPriorityColor = (priority: number): string => {
    if (priority <= 10) return 'success'
    if (priority <= 50) return 'primary'
    if (priority <= 100) return 'warning'
    return 'error'
  }


  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Filter management
  const clearFilters = (): void => {
    searchQuery.value = ''
    statusFilter.value = null
    templateFilter.value = null
  }

  const resetForm = (): void => {
    queryForm.value = {
      queryName: '',
      jqlExpression: '',
      templateId: undefined,
      isActive: true,
      priority: 1
    }
    jqlValidation.value = null
  }

  return {
    // State
    loading,
    queries,
    templates,
    templatesLoading,
    searchQuery,
    statusFilter,
    templateFilter,

    // Dialog states
    showQueryDialog,
    showDeleteDialog,
    editingQuery,
    deletingQuery,

    // Form data
    queryFormRef,
    queryFormValid,
    queryForm,
    jqlValidation,
    validatingQueries,
    saving,
    deleting,

    // Validation rules
    rules,

    // Computed
    headers,
    filteredQueries,
    statusOptions,
    templateOptions,
    templateSelectOptions,

    // Data loading
    fetchQueries,
    fetchTemplates,
    loadData,

    // Dialog management
    openCreateDialog,
    openEditDialog,
    closeQueryDialog,
    confirmDelete,
    closeDeleteDialog,

    // Query operations
    getNextPriority,
    saveQuery,
    deleteQuery,
    toggleQueryStatus,

    // Validation
    validateJqlSyntax,
    validateQuery,

    // Utilities
    getTemplateName,
    truncateJql,
    getPriorityColor,
    formatDate,
    clearFilters,
    resetForm
  }
}