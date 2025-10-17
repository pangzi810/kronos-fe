/**
 * Project management type definitions
 */

import type { PaginationParams } from './common.types'
import type { User } from './user.types'

// Project Status enum
export type ProjectStatus = 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface ProjectStatusConfig {
  text: string
  color: string
  icon: string
}

export const projectStatusConfig: Record<ProjectStatus, ProjectStatusConfig> = {
  PLANNING: { text: '計画中', color: 'info', icon: 'mdi-pencil-ruler' },
  IN_PROGRESS: { text: '進行中', color: 'primary', icon: 'mdi-progress-clock' },
  COMPLETED: { text: '完了', color: 'success', icon: 'mdi-check-circle' },
  CANCELLED: { text: 'キャンセル', color: 'error', icon: 'mdi-cancel' }
}

export function getProjectStatusText(status: ProjectStatus): string {
  return projectStatusConfig[status]?.text || status
}

export function getProjectStatusColor(status: ProjectStatus): string {
  return projectStatusConfig[status]?.color || 'grey'
}

export function getProjectStatusIcon(status: ProjectStatus): string {
  return projectStatusConfig[status]?.icon || 'mdi-help-circle'
}

// Main Project type
export interface Project {
  id: string
  name: string
  description?: string
  status: ProjectStatus
  startDate: string
  plannedEndDate: string
  actualEndDate?: string
  createdBy: string // Backend has this as required, not optional
  createdAt: string
  updatedAt: string
  jiraIssueKey?: string // Backend JIRA integration property
  customFields?: string
}

// Search and filter types
export interface ProjectSearchParams extends PaginationParams {
  status?: ProjectStatus
  search?: string
  startDateFrom?: string
  startDateTo?: string
  endDateFrom?: string
  endDateTo?: string
}

// Statistics type
export interface ProjectStatistics {
  projectId: string
  totalMembers: number
  activeMembers: number
  progressPercentage: number
  daysRemaining: number
  isOverdue: boolean
}