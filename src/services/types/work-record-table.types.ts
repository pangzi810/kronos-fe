import type { Project } from './project.types'
import type { WorkCategory, CategoryHours, WorkRecordApproval } from './work-record.types'

/**
 * Dynamic table row for project work records
 */
export interface DynamicProjectRow {
  id: string                    // レコードID (新規の場合は temp-{uuid})
  projectId: string | null      // プロジェクトID (未選択時はnull)
  project: Project | null       // プロジェクト詳細情報
  categoryHours: CategoryHours  // カテゴリ別時間データ
  total: number                 // 行合計時間
  isNew: boolean               // 新規追加フラグ
  isDirty: boolean             // 変更フラグ
  isDeleted: boolean           // 削除フラグ
  description?: string         // 作業内容説明
  tempId?: string              // 一時的なクライアント側ID
}

/**
 * Work record table state
 */
export interface WorkRecordTableState {
  selectedDate: string              // 選択中の日付
  projectRows: DynamicProjectRow[]  // プロジェクト行配列
  originalRows: DynamicProjectRow[] // 変更検知用の元データ
  categories: WorkCategory[]        // 作業カテゴリ一覧
  approvalInfo?: WorkRecordApproval      // 承認情報
  saving: boolean                  // 保存中フラグ
  hasChanges: boolean             // 変更有無フラグ
  searching: boolean              // 検索中フラグ
  loading: boolean               // ローディング中フラグ
}

/**
 * Row validation error
 */
export interface RowValidationError {
  rowId: string     // エラー対象行ID
  field: string     // エラーフィールド
  message: string   // エラーメッセージ
}

/**
 * Validation rules
 */
export interface ValidationRules {
  maxHoursPerDay?: number      // 1日最大時間
  maxHoursPerCategory?: number // カテゴリ別最大時間
  requiredProjects?: string[]  // 必須プロジェクト
}

/**
 * Save work records payload
 */
export interface SaveWorkRecordsPayload {
  date: string                          // 対象日付
  records: WorkRecordUpsertRequest[]    // 新規・更新レコード
  deletedRecordIds?: string[]           // 削除対象ID配列
}

/**
 * Work record create request
 */
export interface WorkRecordUpsertRequest {
  projectId: string
  workDate: string
  categoryHours: CategoryHours
  description?: string
}

/**
 * Project search state for autocomplete
 */
export interface ProjectSearchState {
  query: string
  results: Project[]
  loading: boolean
  error: string | null
  selectedIndex: number
  hasMore: boolean
}

/**
 * Project search parameters for API
 */
export interface ProjectSearchParams {
  query?: string
  status?: string[]
  limit?: number
  offset?: number
  excludeIds?: string[]
}

/**
 * Project search response
 */
export interface ProjectSearchResponse {
  projects: Project[]
  total: number
  hasMore: boolean
}