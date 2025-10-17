/**
 * Date utility functions for handling Japanese Standard Time (JST)
 */

/**
 * Get current date in JST timezone as a Date object
 * @returns Date object representing current time in JST
 */
export function getJSTDate(): Date {
  // JST is UTC+9
  const now = new Date()
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000)
  const jstTime = utcTime + (9 * 60 * 60 * 1000)
  return new Date(jstTime)
}

/**
 * Get current date in JST timezone as YYYY-MM-DD string
 * @returns Date string in YYYY-MM-DD format (JST)
 */
export function getJSTDateString(): string {
  const jstDate = getJSTDate()
  const year = jstDate.getFullYear()
  const month = String(jstDate.getMonth() + 1).padStart(2, '0')
  const day = String(jstDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get current date and time in JST timezone as ISO string
 * @returns ISO string in JST timezone
 */
export function getJSTISOString(): string {
  const jstDate = getJSTDate()
  return jstDate.toISOString()
}

/**
 * Convert a date string or Date object to JST Date
 * @param date - Date string or Date object
 * @returns Date object in JST
 */
export function toJSTDate(date: string | Date): Date {
  const inputDate = typeof date === 'string' ? new Date(date) : date
  const utcTime = inputDate.getTime() + (inputDate.getTimezoneOffset() * 60000)
  const jstTime = utcTime + (9 * 60 * 60 * 1000)
  return new Date(jstTime)
}

/**
 * Format a date to YYYY-MM-DD in JST
 * @param date - Date string or Date object
 * @returns Date string in YYYY-MM-DD format (JST)
 */
export function formatJSTDate(date: string | Date): string {
  const jstDate = toJSTDate(date)
  const year = jstDate.getFullYear()
  const month = String(jstDate.getMonth() + 1).padStart(2, '0')
  const day = String(jstDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get start of month in JST
 * @param year - Year
 * @param month - Month (1-12)
 * @returns Date string in YYYY-MM-DD format
 */
export function getJSTMonthStart(year: number, month: number): string {
  const monthStr = String(month).padStart(2, '0')
  return `${year}-${monthStr}-01`
}

/**
 * Get end of month in JST
 * @param year - Year
 * @param month - Month (1-12)
 * @returns Date string in YYYY-MM-DD format
 */
export function getJSTMonthEnd(year: number, month: number): string {
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const lastDay = new Date(nextYear, nextMonth - 1, 0).getDate()
  const monthStr = String(month).padStart(2, '0')
  const dayStr = String(lastDay).padStart(2, '0')
  return `${year}-${monthStr}-${dayStr}`
}

/**
 * Get current year and month in JST
 * @returns Object with year and month (1-12)
 */
export function getJSTYearMonth(): { year: number; month: number } {
  const jstDate = getJSTDate()
  return {
    year: jstDate.getFullYear(),
    month: jstDate.getMonth() + 1
  }
}
