/**
 * Work Record and Approval type definitions
 */

import type { PaginationParams } from './common.types'
import type { Project } from './project.types'

// Work Category types
export interface WorkCategory {
  id: string
  code: {
    value: string
  }
  name: {
    value: string
  }
  description: string
  displayOrder: {
    value: number
  }
  color: string
  active: boolean
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
}

// Category Hours type
export interface CategoryHours {
  [categoryCode: string]: number
}

// Main Work Record type
export interface WorkRecord {
  id: string
  userId: string
  projectId: string
  project: Project
  workDate: string
  categoryHours: CategoryHours
  description: string
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
}

// Work Record Request types
export interface WorkRecordUpsertRequest {
  projectId: string
  workDate: string
  categoryHours: CategoryHours
  description?: string
}

export interface WorkRecordUpdateRequest {
  categoryHours?: CategoryHours
  description?: string
}

// Approval types
export type ApprovalStatus = 'NOT_ENTERED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'DRAFT' | 'SUBMITTED'

export interface ApprovalStatusConfig {
  text: string
  color: string
  i18nKey: string
}

export const approvalStatusConfig: Record<ApprovalStatus, ApprovalStatusConfig> = {
  NOT_ENTERED: { text: '未入力', color: 'grey', i18nKey: 'approval.status.notEntered' },
  PENDING: { text: '承認待ち', color: 'warning', i18nKey: 'approval.status.pending' },
  APPROVED: { text: '承認済み', color: 'success', i18nKey: 'approval.status.approved' },
  REJECTED: { text: '差し戻し', color: 'error', i18nKey: 'approval.status.rejected' },
  CANCELLED: { text: 'キャンセル', color: 'grey', i18nKey: 'approval.status.cancelled' },
  DRAFT: { text: '下書き', color: 'grey', i18nKey: 'approval.status.draft' },
  SUBMITTED: { text: '提出済み', color: 'info', i18nKey: 'approval.status.submitted' }
}

export function getApprovalStatusDisplayName(status: ApprovalStatus, t: (key: string) => string): string {
  const config = approvalStatusConfig[status]
  return config ? t(config.i18nKey) : t('approval.status.unknown')
}

export function getApprovalStatusColor(status: ApprovalStatus): string {
  return approvalStatusConfig[status]?.color || 'grey'
}

export function getApprovalStatusText(status: ApprovalStatus): string {
  return approvalStatusConfig[status]?.text || status
}

export interface WorkRecordApproval {
  userId: string
  date: string
  approvalStatus: ApprovalStatus
  approvedBy?: string
  approvedAt?: string
  editable?: boolean
  approved?: boolean
  pending?: boolean
  rejected?: boolean
  rejectionReason?: string
  createdAt: string
  updatedAt: string
}

// Response types
export interface WorkRecordsResponse {
  workRecords: WorkRecord[]
  workRecordApproval: WorkRecordApproval
}

// Work Hours Summary types - matches backend exactly
export interface WorkHoursSummaryResponse {
  userId: string
  userFullName: string // Backend uses userFullName, not userName
  startDate: string
  endDate: string
  totalHours: number
  totalDays: number
  averageHoursPerDay: number
  projectHours: { [projectName: string]: number } // Backend uses projectHours, not projectBreakdown
  categoryHours: { [categoryCode: string]: number }
  dailyHours: { [date: string]: number }
  weeklySummaries: WeeklySummary[]
}

export interface WeeklySummary {
  weekStart: string
  weekEnd: string
  totalHours: number
  workingDays: number
  averageHoursPerDay: number
}

// Use WorkHoursSummaryResponse directly - it matches backend exactly

export interface ProjectHoursSummary {
  projectId: string
  projectName: string
  totalHours: number
  workDays: number
}

// Search params
export interface WorkRecordSearchParams extends PaginationParams {
  userId?: string
  projectId?: string
  workDateFrom?: string
  workDateTo?: string
  status?: ApprovalStatus
}

// Approval request types
export interface ApprovalRequest {
  workRecordIds: string[]
  comment?: string
}

export interface ApprovalDecision {
  action: 'APPROVE' | 'REJECT'
  comment?: string
  rejectionReason?: string
}

export interface WorkRecordWithApproval extends WorkRecord {
  approval?: WorkRecordApproval
}

// Date Status response (new API)
export interface DateStatus {
  hasWorkRecord: boolean
  approvalStatus: ApprovalStatus
  totalHours: number
}

export interface DateStatusResponse {
  dateStatuses: { [date: string]: DateStatus }
}

// Approval history
export interface ApprovalHistory {
  id: string
  workRecordApprovalId: string
  action: 'CREATE' | 'UPDATE' | 'APPROVE' | 'REJECT' | 'CANCEL'
  actorId: string
  actorName: string
  comment?: string
  createdAt: string
}