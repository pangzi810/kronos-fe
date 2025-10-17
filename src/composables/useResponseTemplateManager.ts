import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import type { ResponseTemplate } from '@/services/types/jira.types'
import { jiraService } from '@/services/domains/jira.service'

export interface UseResponseTemplateManagerOptions {
  autoLoad?: boolean
}

export function useResponseTemplateManager(options: UseResponseTemplateManagerOptions = {}) {
  const { autoLoad = true } = options
  
  const toast = useToast()

  // State
  const templates = ref<ResponseTemplate[]>([])
  const loading = ref(false)
  const deleting = ref(false)
  const searchQuery = ref('')
  const showEditorDialog = ref(false)
  const showDeleteDialog = ref(false)
  const selectedTemplate = ref<ResponseTemplate | null>(null)
  const templateToDelete = ref<ResponseTemplate | null>(null)
  const editorMode = ref<'create' | 'edit' | 'duplicate'>('create')

  // Computed
  const filteredTemplates = computed(() => {
    let filtered = templates.value

    // Apply search filter
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      filtered = filtered.filter(template =>
        template.templateName.toLowerCase().includes(query) ||
        template.templateDescription?.toLowerCase().includes(query)
      )
    }

    return filtered
  })

  const headers = computed(() => [
    { title: 'テンプレート名', key: 'templateName', sortable: true, width: '400px' },
    { title: '作成日時', key: 'createdInfo', sortable: false, width: '150px' },
    { title: '操作', key: 'actions', sortable: false, width: '200px' }
  ])

  // Data fetching
  const fetchTemplates = async () => {
    loading.value = true
    try {
      const data = await jiraService.getAllTemplates()
      templates.value = data
    } catch (error) {
      toast.error('テンプレートの取得に失敗しました')
      console.error('Failed to fetch templates:', error)
    } finally {
      loading.value = false
    }
  }

  // Template operations
  const createTemplate = () => {
    selectedTemplate.value = null
    editorMode.value = 'create'
    showEditorDialog.value = true
  }

  const editTemplate = (template: ResponseTemplate) => {
    selectedTemplate.value = template
    editorMode.value = 'edit'
    showEditorDialog.value = true
  }

  const testTemplate = async (template: ResponseTemplate) => {
    try {
      // Test with empty data - the backend should handle this gracefully
      const result = await jiraService.testTemplate(template.id)
      if (result.success) {
        toast.success(`テンプレート「${template.templateName}」のテストが成功しました`)
      } else {
        toast.warning(`テンプレートテストでエラーが発生しました: ${result.errorMessage || 'Unknown error'}`)
      }
    } catch (error) {
      toast.error('テンプレートのテストに失敗しました')
      console.error('Template test failed:', error)
    }
  }

  const duplicateTemplate = (template: ResponseTemplate) => {
    // Create a copy of the template without id and with modified name
    const duplicateTemplate: ResponseTemplate = {
      ...template,
      id: '', // Will be assigned by server
      templateName: `${template.templateName} のコピー`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    selectedTemplate.value = duplicateTemplate
    editorMode.value = 'duplicate'
    showEditorDialog.value = true
  }

  const deleteTemplate = (template: ResponseTemplate) => {
    templateToDelete.value = template
    showDeleteDialog.value = true
  }

  const confirmDelete = async () => {
    if (!templateToDelete.value) return
    
    deleting.value = true
    try {
      await jiraService.deleteTemplate(templateToDelete.value.id)
      await fetchTemplates() // Refresh the list
      toast.success(`テンプレート「${templateToDelete.value.templateName}」を削除しました`)
      showDeleteDialog.value = false
      templateToDelete.value = null
    } catch (error) {
      toast.error('テンプレートの削除に失敗しました')
      console.error('Failed to delete template:', error)
    } finally {
      deleting.value = false
    }
  }

  const handleTemplateSaved = () => {
    fetchTemplates() // Refresh the list
  }

  const handleRowClick = (_event: Event, item: { item: ResponseTemplate }) => {
    editTemplate(item.item)
  }

  // Utility functions
  const truncateDescription = (description: string | undefined): string => {
    if (!description) return ''
    return description.length > 50 ? `${description.substring(0, 50)}...` : description
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Initialize
  if (autoLoad) {
    onMounted(() => {
      fetchTemplates()
    })
  }

  return {
    // State
    templates,
    loading,
    deleting,
    searchQuery,
    showEditorDialog,
    showDeleteDialog,
    selectedTemplate,
    templateToDelete,
    editorMode,

    // Computed
    filteredTemplates,
    headers,

    // Actions
    fetchTemplates,
    createTemplate,
    editTemplate,
    testTemplate,
    duplicateTemplate,
    deleteTemplate,
    confirmDelete,
    handleTemplateSaved,
    handleRowClick,

    // Utilities
    truncateDescription,
    formatDate
  }
}