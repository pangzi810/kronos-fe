export function useUtils() {

  // Date utilities
  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('ja-JP')
  }

  function formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString('ja-JP')
  }

  function formatTime(dateString: string): string {
    return new Date(dateString).toLocaleTimeString('ja-JP')
  }

  function formatMonth(dateString: string): string {
    const date = new Date(dateString)
    return `${date.getFullYear()}年${date.getMonth() + 1}月`
  }

  // Number utilities
  function formatHours(hours: number): string {
    return `${hours}h`
  }

  function formatPercentage(value: number, total: number): string {
    if (total === 0) return '0%'
    return `${Math.round((value / total) * 100)}%`
  }

  // Validation utilities
  function isValidDate(dateString: string): boolean {
    const date = new Date(dateString)
    return !isNaN(date.getTime())
  }

  function isWeekend(dateString: string): boolean {
    const date = new Date(dateString)
    const day = date.getDay()
    return day === 0 || day === 6
  }

  function isPastDate(dateString: string): boolean {
    const date = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  function isFutureDate(dateString: string): boolean {
    const date = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date > today
  }


  return {
    // Date utilities
    formatDate,
    formatDateTime,
    formatTime,
    formatMonth,
    
    // Number utilities
    formatHours,
    formatPercentage,
    
    // Validation utilities
    isValidDate,
    isWeekend,
    isPastDate,
    isFutureDate,
  }
}

export type UseUtilsReturn = ReturnType<typeof useUtils>