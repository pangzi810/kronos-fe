/**
 * User management type definitions
 */

import type { PaginationParams, Status } from './common.types'

// Main User type
export interface User {
  id: string // Backend uses 'id', not 'userId'
  username: string
  email: string
  fullName: string
  active: boolean // Backend getter isActive() becomes JSON property "active"
  createdAt: string
  updatedAt: string
}


export interface UserSearchParams extends PaginationParams {
  status?: Status
  search?: string
}

export interface UserListResponse {
  users: User[]
  metadata: {
    totalElements: number
    totalPages: number
    currentPage: number
    pageSize: number
    hasNext: boolean
    hasPrevious: boolean
  }
}

// Approver relationship types (based on backend ApproverResponse)
export interface Approver {
  id: string
  userId?: string // Legacy field - V44 migration
  approverId?: string // Legacy field - V44 migration  
  targetEmail: string // V44: 対象者メールアドレス
  approverEmail: string // V44: 承認者メールアドレス
  effectiveFrom: string // ISO date format
  effectiveTo?: string // ISO date format, optional
  isDeleted: boolean
  isCurrentlyEffective: boolean
  createdAt: string // ISO datetime format
  updatedAt: string // ISO datetime format
}