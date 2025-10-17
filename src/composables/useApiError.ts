import { ref, type Ref } from 'vue'
import type { ApiError } from '@/services'

// Error code constants
export const ErrorCodes = {
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  INVALID_STATE: 'INVALID_STATE',
  DUPLICATE_ASSIGNMENT: 'DUPLICATE_ASSIGNMENT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
} as const

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
 * Composable for handling API errors in components
 */
export function useApiError() {
  const error: Ref<ApiError | null> = ref(null)
  const errorMessage: Ref<string> = ref('')
  const isLoading: Ref<boolean> = ref(false)

  /**
   * Clear error state
   */
  const clearError = () => {
    error.value = null
    errorMessage.value = ''
  }

  /**
   * Handle API error
   */
  const handleError = (apiError: ApiError) => {
    error.value = apiError
    errorMessage.value = getUserFriendlyMessage(apiError)
    
    // Custom handling for specific error codes
    switch (apiError.code) {
      case ErrorCodes.VALIDATION_ERROR:
        // You can parse validation details if needed
        if (apiError.details) {
          try {
            const validationErrors = JSON.parse(apiError.details)
            console.log('Validation errors:', validationErrors)
          } catch (e) {
            // details is not JSON
          }
        }
        break
        
      case ErrorCodes.DUPLICATE_ASSIGNMENT:
        // Handle duplicate assignment specifically
        console.warn('Duplicate assignment detected')
        break
        
      case ErrorCodes.NOT_FOUND:
        // Handle not found errors
        console.warn('Resource not found')
        break
    }
  }

  /**
   * Execute async function with error handling
   */
  const executeWithErrorHandling = async <T>(
    fn: () => Promise<T>,
    options: {
      onSuccess?: (result: T) => void
      onError?: (error: ApiError) => void
      showLoading?: boolean
    } = {}
  ): Promise<T | null> => {
    const { onSuccess, onError, showLoading = true } = options
    
    clearError()
    
    if (showLoading) {
      isLoading.value = true
    }
    
    try {
      const result = await fn()
      if (onSuccess) {
        onSuccess(result)
      }
      return result
    } catch (err) {
      const apiError = err as ApiError
      handleError(apiError)
      
      if (onError) {
        onError(apiError)
      }
      
      return null
    } finally {
      if (showLoading) {
        isLoading.value = false
      }
    }
  }

  return {
    error,
    errorMessage,
    isLoading,
    clearError,
    handleError,
    executeWithErrorHandling,
  }
}