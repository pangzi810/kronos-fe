import { ref, computed, type Ref } from 'vue'
import { projectService } from '../services'
import { useErrorNotification } from './useErrorNotification'
import type {
  Project,
  ProjectSearchParams,
  User
} from '../services/types'
import { getProjectStatusText, getProjectStatusColor } from '../services/types/project.types'

export interface UseProjectOptions {
  projectId?: string
  autoLoad?: boolean
  cacheEnabled?: boolean
}

export interface ProjectState {
  projects: Ref<Project[]>
  currentProject: Ref<Project | null>
  users: Ref<User[]>
  loading: Ref<boolean>
  error: Ref<Error | null>
}

export interface ProjectActions {
  // Project Operations
  loadProjects: (params?: ProjectSearchParams) => Promise<void>
  loadProject: (projectId: string) => Promise<void>
  searchProjects: (query: string) => Promise<void>
  
  // Data Management
  refreshAll: () => Promise<void>
  clearCache: () => void
}

export interface ProjectHelpers {
  // Filtering
  filterActiveProjects: (projects: Project[]) => Project[]
  filterByStatus: (projects: Project[], status: string) => Project[]
  filterByDateRange: (projects: Project[], startDate: Date, endDate: Date) => Project[]
  
  // Validation
  isProjectActive: (project: Project) => boolean
  
  // Formatting
  formatProjectDates: (project: Project) => { start: string; end: string }
}

export function useProject(options: UseProjectOptions = {}) {
  const {
    projectId = '',
    autoLoad = false,
    cacheEnabled = true
  } = options

  const errorNotification = useErrorNotification()

  // State
  const projects = ref<Project[]>([])
  const currentProject = ref<Project | null>(null)
  const recentWorkRecordedProjects = ref<Project[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)

  // Computed Properties
  const totalProjects = computed(() => projects.value.length)

  const projectsByStatus = computed(() => {
    const grouped = new Map<string, Project[]>()
    
    projects.value.forEach(project => {
      const statusProjects = grouped.get(project.status) || []
      statusProjects.push(project)
      grouped.set(project.status, statusProjects)
    })
    
    return grouped
  })
  
  // Project Operations
  async function loadProjects(params?: ProjectSearchParams) {
    loading.value = true
    error.value = null
    
    try {
      projects.value = await projectService.getPaginated(params, cacheEnabled)
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
      console.error('Failed to load projects:', err)
    } finally {
      loading.value = false
    }
  }

  async function loadRecentWorkRecordedProjects() {
    loading.value = true
    try {
      recentWorkRecordedProjects.value = await projectService.getRecentWorkRecordedProjects()
      console.log("loadRecentWorkRecordedProjects", recentWorkRecordedProjects.value)
    } catch (err) {
      error.value = err as Error
      errorNotification.showErrorNotification(err as Error)
      console.error('Failed to load recentWorkRecordedProjects', err)
    } finally {
      loading.value = false
    }
  }

  async function loadProject(projectId: string) {
    loading.value = true
    error.value = null
    
    try {
      currentProject.value = await projectService.getById(projectId, cacheEnabled)
      
      // Add to projects list if not already there
      const index = projects.value.findIndex(p => p.id === projectId)
      if (index === -1) {
        projects.value.push(currentProject.value)
      } else {
        projects.value[index] = currentProject.value
      }
    } catch (err) {
      error.value = err as Error
      console.error('Failed to load project:', err)
    } finally {
      loading.value = false
    }
  }

  async function searchProjects(query: string) {
    loading.value = true
    error.value = null
    
    try {
      projects.value = await projectService.search(query)
    } catch (err) {
      error.value = err as Error
      console.error('Failed to search projects:', err)
    } finally {
      loading.value = false
    }
  }

  async function refreshAll() {
    const promises: Promise<void>[] = [
      loadProjects()
    ]
    
    if (projectId) {
      promises.push(
        loadProject(projectId),
      )
    }
    
    await Promise.all(promises)
  }

  function clearCache() {
    // Clear cache by reloading without cache
    loadProjects()
    if (projectId) {
      loadProject(projectId)
    }
  }

  // Helper Functions
  function isProjectActive(project: Project): boolean {
    return project.status === 'IN_PROGRESS'
  }

  function formatProjectDates(project: Project): { start: string; end: string } {
    const formatDate = (date: string | Date) => {
      const d = typeof date === 'string' ? new Date(date) : date
      return d.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
    }
    
    return {
      start: project.startDate ? formatDate(project.startDate) : '',
      end: project.actualEndDate ? formatDate(project.actualEndDate) : '継続中'
    }
  }


  // Auto-load on mount if specified
  if (autoLoad) {
    loadProjects()
    loadRecentWorkRecordedProjects()

    if (projectId) {
      loadProject(projectId)
    }
  }

  return {
    // State
    projects,
    currentProject,
    recentWorkRecordedProjects,
    loading,
    error,
    
    // Computed
    totalProjects,
    projectsByStatus,
    
    // Actions
    loadRecentWorkRecordedProjects,
    loadProjects,
    loadProject,
    searchProjects,
    refreshAll,
    clearCache,
    
    // Helpers
    isProjectActive,
    formatProjectDates,
    getProjectStatusText,
    getProjectStatusColor
  }
}