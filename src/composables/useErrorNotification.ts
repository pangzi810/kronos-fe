import { useToast, POSITION } from 'vue-toastification'
import { useI18n } from 'vue-i18n'
import type { ApiError } from '@/services'
import { ErrorCodes } from './useApiError'

// User-friendly error messages
const errorMessages: Record<string, string> = {
  [ErrorCodes.AUTHENTICATION_FAILED]: 'Username or password is incorrect',
  [ErrorCodes.AUTHENTICATION_ERROR]: 'Authentication failed',
  [ErrorCodes.UNAUTHORIZED]: 'Authentication required',
  [ErrorCodes.FORBIDDEN]: 'You do not have permission to perform this operation',
  [ErrorCodes.VALIDATION_ERROR]: 'There are errors in the input',
  [ErrorCodes.INVALID_ARGUMENT]: 'Invalid parameter',
  [ErrorCodes.INVALID_STATE]: 'Cannot execute in the current state',
  [ErrorCodes.DUPLICATE_ASSIGNMENT]: 'Already assigned',
  [ErrorCodes.INTERNAL_ERROR]: 'Server error occurred',
  [ErrorCodes.NETWORK_ERROR]: 'Network error occurred',
  [ErrorCodes.TIMEOUT_ERROR]: 'Request timed out',
  [ErrorCodes.NOT_FOUND]: 'Resource not found',
  [ErrorCodes.CONFLICT]: 'Data conflict occurred',
}

function getUserFriendlyMessage(error: ApiError): string {
  if (errorMessages[error.code]) {
    return errorMessages[error.code]
  }
  
  if (error.message && !error.message.includes('Error')) {
    return error.message
  }
  
  return 'An error occurred. Please try again later.'
}

/**
 * エラー通知用のコンポーザブル関数
 * 
 * Toast通知を使用してエラーメッセージを表示し、
 * エラーの種類に応じて適切な処理を行う
 */
export function useErrorNotification() {
  const toast = useToast()
  const { t: $t } = useI18n()

  /**
   * エラー通知を表示する
   * 
   * @param error APIエラーオブジェクト
   * @param options 通知オプション
   */
  const showErrorNotification = (
    error: ApiError | Error | string,
    options: {
      title?: string
      duration?: number
      showDetails?: boolean
    } = {}
  ) => {
    const { title = $t('notifications.error'), duration = 5000, showDetails = false } = options

    let message = ''
    let errorCode = ''

    // エラーの種類に応じてメッセージを取得
    if (typeof error === 'string') {
      message = error
    } else if (error instanceof Error) {
      message = error.message || $t('errors.unexpectedError')
    } else {
      // ApiError の場合
      message = getUserFriendlyMessage(error)
      errorCode = (error as ApiError).code || ''
    }

    // エラーコードに基づく特別な処理
    if (errorCode === ErrorCodes.FORBIDDEN) {
      // 403エラーは警告として表示
      toast.warning(message, {
        timeout: duration,
        position: POSITION.TOP_RIGHT
      })
    } else if (errorCode === ErrorCodes.NETWORK_ERROR) {
      // ネットワークエラーは情報として表示
      toast.info(message, {
        timeout: duration,
        position: POSITION.TOP_RIGHT
      })
    } else {
      // その他のエラーはエラーとして表示
      toast.error(message, {
        timeout: duration,
        position: POSITION.TOP_RIGHT
      })
    }

    // デバッグ情報をコンソールに出力
    if (showDetails && typeof error === 'object') {
      console.error('Error details:', error)
    }
  }

  /**
   * 成功通知を表示する
   * 
   * @param message 成功メッセージ
   * @param options 通知オプション
   */
  const showSuccessNotification = (
    message: string,
    options: {
      duration?: number
    } = {}
  ) => {
    const { duration = 3000 } = options

    toast.success(message, {
      timeout: duration,
      position: POSITION.TOP_RIGHT
    })
  }

  /**
   * 情報通知を表示する
   * 
   * @param message 情報メッセージ
   * @param options 通知オプション
   */
  const showInfoNotification = (
    message: string,
    options: {
      duration?: number
    } = {}
  ) => {
    const { duration = 4000 } = options

    toast.info(message, {
      timeout: duration,
      position: POSITION.TOP_RIGHT
    })
  }

  /**
   * 警告通知を表示する
   * 
   * @param message 警告メッセージ
   * @param options 通知オプション
   */
  const showWarningNotification = (
    message: string,
    options: {
      duration?: number
    } = {}
  ) => {
    const { duration = 4000 } = options

    toast.warning(message, {
      timeout: duration,
      position: POSITION.TOP_RIGHT
    })
  }

  /**
   * 承認済みデータ更新試行時の専用エラー処理
   * 
   * @param onApprovalStatusRefresh 承認ステータス再取得のコールバック
   */
  const handleApprovalRestrictionError = async (
    onApprovalStatusRefresh?: () => Promise<void>
  ) => {
    showErrorNotification($t('errors.approvedDataUpdateRestricted'), {
      title: $t('errors.updateRestriction'),
      duration: 6000
    })

    // 承認ステータスを再取得して最新状態に同期
    if (onApprovalStatusRefresh) {
      try {
        await onApprovalStatusRefresh()
        showInfoNotification($t('errors.approvalStatusUpdated'), {
          duration: 3000
        })
      } catch (refreshError) {
        console.warn('Failed to refresh approval status:', refreshError)
      }
    }
  }

  /**
   * ネットワークエラー時の専用処理
   */
  const handleNetworkError = () => {
    showErrorNotification($t('errors.networkError'), {
      title: $t('errors.networkErrorTitle'),
      duration: 6000
    })
  }

  /**
   * バリデーションエラー時の専用処理
   * 
   * @param error APIエラーオブジェクト
   */
  const handleValidationError = (error: ApiError) => {
    let message = $t('errors.validationError')
    
    if (error.details) {
      try {
        const validationDetails = JSON.parse(error.details)
        // バリデーションエラーの詳細を表示
        if (Array.isArray(validationDetails) && validationDetails.length > 0) {
          message = validationDetails.join(', ')
        }
      } catch (e) {
        // details がJSONでない場合はそのまま使用
        message = error.details
      }
    }

    showErrorNotification(message, {
      title: $t('errors.validationErrorTitle'),
      duration: 5000
    })
  }

  return {
    showErrorNotification,
    showSuccessNotification,
    showInfoNotification,
    showWarningNotification,
    handleApprovalRestrictionError,
    handleNetworkError,
    handleValidationError
  }
}