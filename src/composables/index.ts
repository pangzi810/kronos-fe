/**
 * Composables for Vue components
 * Reusable composition functions that encapsulate stateful logic
 */

export { useWorkRecord } from './useWorkRecord'
export type { 
  UseWorkRecordOptions,
  WorkRecordState,
  WorkRecordActions,
  WorkRecordHelpers
} from './useWorkRecord'

export { useApproval } from './useApproval'
export type {
  UseApprovalOptions,
  ApprovalState,
  ApprovalActions,
  ApprovalFilters,
  ApprovalComputed,
  UseApprovalReturn
} from './useApproval'

export { useUtils } from './useUtils'
export type {
  UseUtilsReturn
} from './useUtils'


export { useProject } from './useProject'
export type {
  UseProjectOptions,
  ProjectState,
  ProjectActions,
  ProjectHelpers
} from './useProject'

