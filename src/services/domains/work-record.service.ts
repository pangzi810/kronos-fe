import { apiCache } from '../core/api.cache'
import { handleApiError } from '../core/error.handler'
import { BaseApiService } from '../core/base.service'
import type {
  WorkRecord,
  WorkRecordUpsertRequest,
  WorkRecordUpdateRequest,
  WorkRecordSearchParams,
  WorkRecordWithApproval,
  WorkRecordsResponse,
  WorkHoursSummaryResponse,
  DateStatusResponse,
  DateStatus
} from '../types/work-record.types'
import { type AxiosError } from 'axios'
import type { SaveWorkRecordsPayload } from '../types/work-record-table.types'

/**
 * Work Record Service
 * Handles all work record related operations
 */
class WorkRecordService extends BaseApiService {
  constructor() {
    super({
      baseURL: '/work-records',
      cacheTime: 5 * 60 * 1000, // 5 minutes
      defaultCacheEnabled: true
    })
  }

  /**
   * Save work records (create or update)
   */
  async saveWorkRecords(
    payload: SaveWorkRecordsPayload
  ): Promise<WorkRecordsResponse> {
    try {
      const { data } = await this.api.put<WorkRecordsResponse>(
        `${this.baseURL}/me/${payload.date}`, payload )

      // Invalidate related caches
      this.invalidateWorkRecordCaches(payload.date)

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get work records by date
   */
  async getWorkRecordsByDate(
    userId: string,
    date: string,
    useCache = true
  ): Promise<WorkRecord[]> {
    const cacheKey = `work-records:me:${date}`

    try {
      return await this.get<WorkRecord[]>(
        `/me/period`,
        {
          params: { startDate: date, endDate: date }
        },
        cacheKey,
        useCache
      )
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get work records with approval status
   */
  async getWorkRecordsWithApprovalStatus(
    date: string,
    useCache = true
  ): Promise<WorkRecordsResponse> {
    const cacheKey = `work-records:me:approval:${date}`

    try {
      return await this.get<WorkRecordsResponse>(
        `/me/${date}`,
        undefined,
        cacheKey,
        useCache
      )
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get work records for a period
   */
  async getWorkRecordsForPeriod(
    startDate: string,
    endDate: string,
    useCache = true
  ): Promise<WorkRecord[]> {
    const cacheKey = this.buildCacheKey(`work-records:me:period`, {
      startDate,
      endDate
    })

    try {
      return await this.get<WorkRecord[]>(
        `/me/period`,
        {
          params: { startDate, endDate }
        },
        cacheKey,
        useCache
      )
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get monthly work records
   */
  async getMonthlyWorkRecords(
    userId: string,
    year: number,
    month: number,
    useCache = true
  ): Promise<WorkRecordWithApproval[]> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]
    
    const cacheKey = `work-records:me:monthly:${year}-${month}`

    try {
      // Check cache
      if (useCache) {
        const cached = apiCache.get<WorkRecordWithApproval[]>(cacheKey)
        if (cached) return cached
      }

      // Fetch from API
      const { data } = await this.api.get<WorkRecordWithApproval[]>(
        `${this.baseURL}/me/period`,
        {
          params: { startDate, endDate }
        }
      )

      // Cache result (don't cache current month for too long)
      const now = new Date()
      const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
      const ttl = isCurrentMonth ? 60 * 1000 : this.cacheTime
      
      apiCache.set(cacheKey, data, ttl)

      return data
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get work hours summary for a period
   */
  async getWorkHoursSummary(
    startDate: string,
    endDate: string,
    useCache = true
  ): Promise<WorkHoursSummaryResponse> {
    const cacheKey = this.buildCacheKey(`work-records:me:summary`, {
      startDate,
      endDate
    })

    try {
      return await this.get<WorkHoursSummaryResponse>(
        `/me/summary`,
        {
          params: { startDate, endDate }
        },
        cacheKey,
        useCache
      )
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Get date statuses for a month (new API)
   */
  async getDateStatuses(
    year: number,
    month: number,
    useCache = true
  ): Promise<{ [date: string]: DateStatus }> {
    const cacheKey = `work-records:me:date-statuses:${year}-${month}`

    try {
      const result = await this.get<DateStatusResponse>(
        '/me/date-statuses',
        {
          params: { year, month }
        },
        cacheKey,
        useCache
      )
      return result.dateStatuses
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Create work record
   */
  async createWorkRecord(data: WorkRecordUpsertRequest): Promise<WorkRecord> {
    try {
      const result = await this.post<WorkRecord>('', data)
      
      // Invalidate caches
      this.invalidateWorkRecordCaches(data.workDate)
      
      return result
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Update work record
   */
  async updateWorkRecord(
    id: string,
    data: WorkRecordUpdateRequest
  ): Promise<WorkRecord> {
    try {
      const result = await this.put<WorkRecord>(`/${id}`, data)
      
      // Invalidate caches
      this.invalidateCache()
      
      return result
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Delete work record
   */
  async deleteWorkRecord(workRecordId: string): Promise<void> {
    try {
      await this.delete(`/${workRecordId}`)

      // Invalidate all work record caches
      this.invalidateCache()
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Search work records
   */
  async searchWorkRecords(
    params: WorkRecordSearchParams,
    useCache = false
  ): Promise<WorkRecord[]> {
    const cacheKey = this.buildCacheKey('work-records:search', params)

    try {
      return await this.get<WorkRecord[]>(
        '/search',
        { params },
        cacheKey,
        useCache
      )
    } catch (error) {
      throw handleApiError(error as AxiosError)
    }
  }

  /**
   * Invalidate work record caches for a specific date
   */
  private invalidateWorkRecordCaches(date: string): void {
    // Invalidate specific date caches
    apiCache.invalidate(new RegExp(`work-records.*${date}`))
    
    // Invalidate summary caches that might include this date
    apiCache.invalidate(/work-records:.*:summary/)
    apiCache.invalidate(/work-records:.*:monthly/)
  }
}

// Export singleton instance
export const workRecordService = new WorkRecordService()
export default workRecordService