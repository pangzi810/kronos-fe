import { ref, computed, type Ref } from 'vue'
import { jiraService } from '../services'
import { useErrorNotification } from './useErrorNotification'
import type {
  ResponseTemplate,
  ResponseTemplateCreateRequest,
  ResponseTemplateUpdateRequest,
  ResponseTemplateSearchParams,
  TemplateTestRequest,
  TemplateTestResult
} from '../services/types/jira.types'

export interface UseResponseTemplateOptions {
  autoLoad?: boolean
  cacheEnabled?: boolean
  enableSearch?: boolean
}

export interface ResponseTemplateState {
  templates: Ref<ResponseTemplate[]>
  currentTemplate: Ref<ResponseTemplate | null>
  testResult: Ref<TemplateTestResult | null>
  loading: Ref<boolean>
  testing: Ref<boolean>
  error: Ref<Error | null>
  searchQuery: Ref<string>
}

export interface ResponseTemplateActions {
  // CRUD Operations
  loadTemplates: (params?: ResponseTemplateSearchParams) => Promise<void>
  loadActiveTemplates: () => Promise<void>
  loadTemplate: (id: string) => Promise<void>
  createTemplate: (template: ResponseTemplateCreateRequest) => Promise<ResponseTemplate>
  updateTemplate: (id: string, template: ResponseTemplateUpdateRequest) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>
  duplicateTemplate: (id: string) => Promise<ResponseTemplate>
  
  // Template Testing
  testTemplate: (id: string, testData?: TemplateTestRequest) => Promise<TemplateTestResult>
  testTemplateContent: (template: string, sampleData?: Record<string, any>) => Promise<TemplateTestResult>
  
  // Version Management
  createNewVersion: (id: string) => Promise<ResponseTemplate>
  rollbackVersion: (id: string, version: number) => Promise<ResponseTemplate>
  
  // Search and Filtering
  searchTemplates: (searchTerm: string) => Promise<void>
  clearSearch: () => void
  
  // Status Management
  toggleTemplateStatus: (id: string) => Promise<void>
  activateTemplate: (id: string) => Promise<void>
  deactivateTemplate: (id: string) => Promise<void>
  
  // Usage Analytics
  trackTemplateUsage: (id: string) => Promise<void>
  getUsageStatistics: (id: string) => Promise<{ usageCount: number; lastUsed?: string }>
  
  // Data Management
  refreshAll: () => Promise<void>
  clearCache: () => void
}

export interface ResponseTemplateHelpers {
  // Filtering
  filterActiveTemplates: (templates: ResponseTemplate[]) => ResponseTemplate[]
  filterByUsage: (templates: ResponseTemplate[], minUsage: number) => ResponseTemplate[]
  filterBySearchTerm: (templates: ResponseTemplate[], searchTerm: string) => ResponseTemplate[]
  
  // Validation
  validateTemplate: (template: ResponseTemplateCreateRequest) => { valid: boolean; errors: string[] }
  validateVelocityTemplate: (template: string) => { valid: boolean; errors: string[] }
  
  // Sorting
  sortByUsage: (templates: ResponseTemplate[]) => ResponseTemplate[]
  sortByCreated: (templates: ResponseTemplate[]) => ResponseTemplate[]
  sortByName: (templates: ResponseTemplate[]) => ResponseTemplate[]
  
  // Template content helpers
  extractVariables: (template: string) => string[]
  generateSampleData: (template: string) => Record<string, any>
  
  // Usage analytics
  getUsageCategory: (usageCount: number) => 'low' | 'medium' | 'high'
  getPopularityRank: (template: ResponseTemplate, allTemplates: ResponseTemplate[]) => number
}

export function useResponseTemplate(options: UseResponseTemplateOptions = {}) {
  const {
    autoLoad = false,
    cacheEnabled = true,
    enableSearch = true
  } = options

  const errorNotification = useErrorNotification()
  
  // State
  const templates = ref<ResponseTemplate[]>([])
  const currentTemplate = ref<ResponseTemplate | null>(null)
  const testResult = ref<TemplateTestResult | null>(null)
  const loading = ref(false)
  const testing = ref(false)
  const error = ref<Error | null>(null)
  const searchQuery = ref('')

  // Computed Properties
  const activeTemplates = computed(() => 
    // isActive property not provided by backend - all templates considered active
    templates.value
  )

  const inactiveTemplates = computed(() => 
    // isActive property not provided by backend - no inactive templates
    []
  )

  const templatesByUsage = computed(() => 
    // usageCount property not provided by backend - sort by name instead
    [...templates.value].sort((a, b) => a.templateName.localeCompare(b.templateName))
  )

  const popularTemplates = computed(() => 
    // usageCount property not provided by backend - return empty array
    []
  )

  const recentTemplates = computed(() => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    return templates.value.filter(t => 
      new Date(t.createdAt) >= thirtyDaysAgo
    )
  })

  const filteredTemplates = computed(() => {
    let filtered = templates.value

    // Apply search filter
    if (searchQuery.value.trim()) {
      const search = searchQuery.value.toLowerCase().trim()
      filtered = filtered.filter(t => 
        t.templateName.toLowerCase().includes(search) ||
        t.velocityTemplate.toLowerCase().includes(search) ||
        t.templateDescription?.toLowerCase().includes(search)
      )
    }

    return filtered
  })

  const templateStats = computed(() => ({
    total: templates.value.length,
    active: activeTemplates.value.length,
    inactive: inactiveTemplates.value.length,
    mostPopular: templatesByUsage.value[0] || null,
    recentCount: recentTemplates.value.length
  }))

  const versionsMap = computed(() => {
    const map = new Map<string, ResponseTemplate[]>()
    
    templates.value.forEach(template => {
      const baseName = template.templateName.replace(/ \(v\d+\)$/, '')
      if (!map.has(baseName)) {
        map.set(baseName, [])
      }
      map.get(baseName)!.push(template)
    })
    
    return map
  })

  // CRUD Operations
  async function loadTemplates(params?: ResponseTemplateSearchParams): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      templates.value = await jiraService.getAllTemplates(params, cacheEnabled)
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
    } finally {
      loading.value = false
    }
  }

  async function loadActiveTemplates(): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      templates.value = await jiraService.getAllTemplates({}, cacheEnabled)
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
    } finally {
      loading.value = false
    }
  }

  async function loadTemplate(id: string): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      currentTemplate.value = await jiraService.getTemplateById(id, cacheEnabled)
      
      // Add to templates list if not already there
      const index = templates.value.findIndex(t => t.id === id)
      if (index === -1) {
        templates.value.push(currentTemplate.value)
      } else {
        templates.value[index] = currentTemplate.value
      }
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
    } finally {
      loading.value = false
    }
  }

  async function createTemplate(template: ResponseTemplateCreateRequest): Promise<ResponseTemplate> {
    loading.value = true
    error.value = null
    
    try {
      // Validate form first
      const validation = validateTemplate(template)
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
      }

      // Validate Velocity template syntax
      const velocityValidation = validateVelocityTemplate(template.velocityTemplate)
      if (!velocityValidation.valid) {
        throw new Error(`Template syntax errors: ${velocityValidation.errors.join(', ')}`)
      }

      const newTemplate = await jiraService.createTemplate(template)
      
      // Add to local state
      templates.value.unshift(newTemplate) // Add to beginning
      currentTemplate.value = newTemplate
      
      errorNotification.showSuccessNotification(
        `Template "${newTemplate.templateName}" created successfully`,
        { duration: 3000 }
      )
      
      return newTemplate
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateTemplate(id: string, template: ResponseTemplateUpdateRequest): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      // Validate Velocity template if provided
      if (template.velocityTemplate) {
        const validation = validateVelocityTemplate(template.velocityTemplate)
        if (!validation.valid) {
          throw new Error(`Template syntax errors: ${validation.errors.join(', ')}`)
        }
      }

      const updated = await jiraService.updateTemplate(id, template)
      
      // Update local state
      const index = templates.value.findIndex(t => t.id === id)
      if (index !== -1) {
        templates.value[index] = updated
      }
      
      // Update current template if it's the same
      if (currentTemplate.value?.id === id) {
        currentTemplate.value = updated
      }
      
      errorNotification.showSuccessNotification(
        `Template "${updated.templateName}" updated successfully`,
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

  async function deleteTemplate(id: string): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      const template = templates.value.find(t => t.id === id)
      await jiraService.deleteTemplate(id)
      
      // Remove from local state
      templates.value = templates.value.filter(t => t.id !== id)
      
      // Clear current template if it's the deleted one
      if (currentTemplate.value?.id === id) {
        currentTemplate.value = null
      }
      
      errorNotification.showSuccessNotification(
        `Template "${template?.templateName || 'Unknown'}" deleted successfully`,
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

  async function duplicateTemplate(id: string): Promise<ResponseTemplate> {
    loading.value = true
    error.value = null
    
    try {
      const originalTemplate = templates.value.find(t => t.id === id)
      if (!originalTemplate) {
        throw new Error('Template not found')
      }

      const duplicateRequest: ResponseTemplateCreateRequest = {
        templateName: `${originalTemplate.templateName} (Copy)`,
        velocityTemplate: originalTemplate.velocityTemplate,
        templateDescription: originalTemplate.templateDescription,
      }

      return await createTemplate(duplicateRequest)
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Template Testing
  async function testTemplate(id: string, testData?: TemplateTestRequest): Promise<TemplateTestResult> {
    testing.value = true
    error.value = null
    
    try {
      const result = await jiraService.testTemplate(id, testData)
      testResult.value = result
      if (result.success) {
        errorNotification.showSuccessNotification(
          'Template test completed successfully',
          { duration: 3000 }
        )
      } else {
        errorNotification.showWarningNotification(
          `Template test failed: ${result.errorMessage || 'Unknown error'}`
        )
      }
      
      return result
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
      throw err
    } finally {
      testing.value = false
    }
  }

  async function testTemplateContent(
    template: string, 
    sampleData?: Record<string, any>
  ): Promise<TemplateTestResult> {
    testing.value = true
    error.value = null
    
    try {
      // Create test data as JSON string
      const testRequest: TemplateTestRequest = {
        testData: JSON.stringify(sampleData)
      }

      // Use a mock template ID for content testing
      const result = await jiraService.testTemplate('test', testRequest)
      testResult.value = result
      
      return result
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
      throw err
    } finally {
      testing.value = false
    }
  }

  // Version Management
  async function createNewVersion(id: string): Promise<ResponseTemplate> {
    loading.value = true
    error.value = null
    
    try {
      const originalTemplate = templates.value.find(t => t.id === id)
      if (!originalTemplate) {
        throw new Error('Template not found')
      }

      const newVersion = 2 // Default version since version property is not available
      const versionRequest: ResponseTemplateCreateRequest = {
        templateName: `${originalTemplate.templateName} (Copy)`,
        velocityTemplate: originalTemplate.velocityTemplate,
        templateDescription: `Copy of ${originalTemplate.templateName}`,
      }

      return await createTemplate(versionRequest)
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function rollbackVersion(id: string, version: number): Promise<ResponseTemplate> {
    loading.value = true
    error.value = null
    
    try {
      const currentTemplateObj = templates.value.find(t => t.id === id)
      if (!currentTemplateObj) {
        throw new Error('Template not found')
      }

      // Find the version to rollback to (this is simplified - in reality you'd need version history)
      const baseName = currentTemplateObj.templateName.replace(/ \(v\d+\)$/, '')
      const versionTemplate = templates.value.find(t => 
        t.templateName === `${baseName} (v${version})`
      )

      if (!versionTemplate) {
        throw new Error(`Version ${version} not found`)
      }

      // Update current template with version content
      await updateTemplate(id, {
        velocityTemplate: versionTemplate.velocityTemplate,
        templateDescription: `Rolled back to version ${version}`
      })

      errorNotification.showSuccessNotification(
        `Template rolled back to version ${version}`,
        { duration: 3000 }
      )

      return templates.value.find(t => t.id === id)!
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Search and Filtering
  async function searchTemplates(searchTerm: string): Promise<void> {
    if (!enableSearch) return
    
    searchQuery.value = searchTerm
    
    if (searchTerm.trim()) {
      loading.value = true
      try {
        templates.value = await jiraService.searchTemplates(searchTerm)
      } catch (err) {
        error.value = err as Error
        errorNotification.showErrorNotification(err as Error)
      } finally {
        loading.value = false
      }
    } else {
      await loadTemplates() // Load all templates if search is cleared
    }
  }

  function clearSearch(): void {
    searchQuery.value = ''
    loadTemplates() // Reload all templates
  }

  async function getUsageStatistics(id: string): Promise<{ lastUsed?: string }> {
    const template = templates.value.find(t => t.id === id)
    if (!template) {
      throw new Error('Template not found')
    }

    return {
      lastUsed: template.updatedAt // Approximation - in reality this would be tracked separately
    }
  }

  // Data Management
  async function refreshAll(): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      await loadTemplates()
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

  function filterBySearchTerm(templateList: ResponseTemplate[], searchTerm: string): ResponseTemplate[] {
    const search = searchTerm.toLowerCase().trim()
    if (!search) return templateList
    
    return templateList.filter(t => 
      t.templateName.toLowerCase().includes(search) ||
      t.velocityTemplate.toLowerCase().includes(search) ||
      t.templateDescription?.toLowerCase().includes(search)
    )
  }

  function validateTemplate(template: ResponseTemplateCreateRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (!template.templateName?.trim()) {
      errors.push('Template name is required')
    }
    
    if (!template.velocityTemplate?.trim()) {
      errors.push('Velocity template content is required')
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }

  function validateVelocityTemplate(template: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (!template.trim()) {
      errors.push('Template content cannot be empty')
    }
    
    // Check for basic Velocity syntax
    const velocityDirectives = /#(set|if|foreach|end|include|parse)/g
    const openDirectives = (template.match(/#(if|foreach)/g) || []).length
    const closeDirectives = (template.match(/#end/g) || []).length
    
    if (openDirectives !== closeDirectives) {
      errors.push('Unbalanced #if/#foreach and #end directives')
    }
    
    // Check for unclosed variable references
    const openBraces = (template.match(/\${/g) || []).length
    const closeBraces = (template.match(/}/g) || []).length
    
    if (openBraces !== closeBraces) {
      errors.push('Unclosed variable references (${...})')
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }

  function sortByCreated(templateList: ResponseTemplate[]): ResponseTemplate[] {
    return [...templateList].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  function sortByName(templateList: ResponseTemplate[]): ResponseTemplate[] {
    return [...templateList].sort((a, b) => a.templateName.localeCompare(b.templateName))
  }

  function extractVariables(template: string): string[] {
    const variablePattern = /\$\{([^}]+)\}/g
    const variables = new Set<string>()
    let match

    while ((match = variablePattern.exec(template)) !== null) {
      variables.add(match[1])
    }

    return Array.from(variables)
  }

  function generateSampleData(template: string): Record<string, any> {
    const variables = extractVariables(template)
    const sampleData: Record<string, any> = {}

    variables.forEach(variable => {
      // Generate appropriate sample data based on variable name patterns
      if (variable.includes('name') || variable.includes('title')) {
        sampleData[variable] = 'Sample Name'
      } else if (variable.includes('date')) {
        sampleData[variable] = new Date().toISOString()
      } else if (variable.includes('count') || variable.includes('number')) {
        sampleData[variable] = 42
      } else if (variable.includes('url')) {
        sampleData[variable] = 'https://example.com'
      } else if (variable.includes('description')) {
        sampleData[variable] = 'Sample description text'
      } else {
        sampleData[variable] = 'Sample Value'
      }
    })

    return sampleData
  }

  function getUsageCategory(usageCount: number): 'low' | 'medium' | 'high' {
    if (usageCount === 0) return 'low'
    if (usageCount < 5) return 'low'
    if (usageCount < 20) return 'medium'
    return 'high'
  }

  function getPopularityRank(template: ResponseTemplate, allTemplates: ResponseTemplate[]): number {
    return allTemplates.findIndex(t => t.id === template.id) + 1
  }

  // Auto-load initial data
  if (autoLoad) {
    loadTemplates().catch(err => {
      console.warn('Failed to auto-load template data:', err)
    })
  }

  return {
    // State
    templates,
    currentTemplate,
    testResult,
    loading,
    testing,
    error,
    searchQuery,
    
    // Computed
    activeTemplates,
    inactiveTemplates,
    templatesByUsage,
    popularTemplates,
    recentTemplates,
    filteredTemplates,
    templateStats,
    versionsMap,
    
    // Actions
    loadTemplates,
    loadActiveTemplates,
    loadTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    testTemplate,
    testTemplateContent,
    createNewVersion,
    rollbackVersion,
    searchTemplates,
    clearSearch,
    getUsageStatistics,
    refreshAll,
    clearCache,
    
    // Helpers
    filterBySearchTerm,
    validateTemplate,
    validateVelocityTemplate,
    sortByCreated,
    sortByName,
    extractVariables,
    generateSampleData,
    getUsageCategory,
    getPopularityRank
  }
}