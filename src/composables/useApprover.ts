import { ref } from 'vue'
import apiClient from '@/services/core/api.client'
import { approverService } from '@/services/domains/approver.service'
import type { Approver } from '@/services/types/user.types'

/**
 * Approver management composable
 * Provides functionality for managing user approver relationships
 */
export function useApprover() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const approvers = ref<Approver[]>([])

  /**
   * Get current user's approvers using service layer
   * @returns Promise<Approver[]> List of current user's approvers
   */
  const getMyApprovers = async (): Promise<Approver[]> => {
    try {
      loading.value = true
      error.value = null
      
      const result = await approverService.getMyApprovers()
      approvers.value = result
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch approvers'
      error.value = errorMessage
      approvers.value = []
      console.error('Error fetching my approvers:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Get approvers for a specific user (admin functionality)
   * @param userId The target user ID
   * @returns Promise<Approver[]> List of user's approvers
   */
  const getUserApprovers = async (userId: string): Promise<Approver[]> => {
    try {
      loading.value = true
      error.value = null
      
      const response = await apiClient.get(`/api/approvers/user/${userId}`)
      return response.data
    } catch (err) {
      error.value = 'Failed to fetch user approvers'
      console.error('Error fetching user approvers:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Assign an approver to a user
   * @param targetEmail Target user email
   * @param approverEmail Approver email
   * @param effectiveFrom Effective from date (optional, defaults to today)
   * @returns Promise<Approver> Created approver relationship
   */
  const assignApprover = async (
    targetEmail: string,
    approverEmail: string,
    effectiveFrom?: string
  ): Promise<Approver> => {
    try {
      loading.value = true
      error.value = null
      
      const response = await apiClient.post('/api/approvers', {
        targetEmail,
        approverEmail,
        effectiveFrom: effectiveFrom || new Date().toISOString().split('T')[0]
      })
      return response.data
    } catch (err) {
      error.value = 'Failed to assign approver'
      console.error('Error assigning approver:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Remove an approver relationship
   * @param approverId Approver relationship ID
   * @returns Promise<void>
   */
  const removeApprover = async (approverId: string): Promise<void> => {
    try {
      loading.value = true
      error.value = null
      
      await apiClient.delete(`/api/approvers/${approverId}`)
    } catch (err) {
      error.value = 'Failed to remove approver'
      console.error('Error removing approver:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  getMyApprovers()
  
  return {
    // State
    loading,
    error,
    approvers,
    
    // Methods
    getMyApprovers,
    getUserApprovers,
    assignApprover,
    removeApprover
  }
}