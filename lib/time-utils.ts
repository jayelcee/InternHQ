/**
 * Centralized time calculation utilities
 * This module provides consistent time calculation functions used across the application
 * 
 * Key utilities:
 * - calculateTimeWorked: Main function for time duration calculations
 * - calculateInternshipProgress: Calculates total completed hours for an intern
 * - DAILY_REQUIRED_HOURS: Centralized constant for required daily hours
 * - Date/time formatting functions for consistent display
 * 
 * Usage: Import these functions instead of creating local time calculation logic
 * to ensure consistency across all components.
 */

/**
 * Constants
 */
export const DAILY_REQUIRED_HOURS = 9

/**
 * Truncates a decimal number to 2 decimal places (no rounding)
 */
export function truncateTo2Decimals(val: number): string {
  const [int, dec = ""] = val.toString().split(".")
  return dec.length > 0 ? `${int}.${dec.slice(0, 2).padEnd(2, "0")}` : `${int}.00`
}

/**
 * Formats duration in hours and minutes
 */
export function formatDuration(hours: number, minutes: number): string {
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`
}

/**
 * Centralized time calculation function
 * Calculates duration and hours from timestamps using truncation (not rounding)
 * @param timeIn - Start time as string or Date
 * @param timeOut - End time as string or Date
 * @returns Object with duration string, hoursWorked number, and decimal string
 */
export function calculateTimeWorked(timeIn: string | Date, timeOut: string | Date) {
  const inDate = new Date(timeIn)
  const outDate = new Date(timeOut)
  const diffMs = outDate.getTime() - inDate.getTime()
  
  if (diffMs <= 0) {
    return {
      duration: "0h 00m",
      hoursWorked: 0,
      decimal: "0.00"
    }
  }
  
  // Truncate to completed minutes (remove partial seconds)
  const totalMinutes = Math.floor(diffMs / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  
  // Calculate hours worked with truncation (not rounding) for exact decimal representation
  const hoursWorked = diffMs / (1000 * 60 * 60)
  
  return {
    duration: formatDuration(hours, minutes),
    hoursWorked,
    decimal: truncateTo2Decimals(hoursWorked)
  }
}

/**
 * Gets truncated decimal hours from time log entry
 * @param timeIn - Start time string
 * @param timeOut - End time string
 * @returns Truncated decimal hours as number
 */
export function getTruncatedDecimalHours(timeIn: string, timeOut: string): number {
  if (!timeIn || !timeOut) return 0
  const result = calculateTimeWorked(timeIn, timeOut)
  return Number(result.decimal)
}

/**
 * Centralized internship progress calculation function
 * Calculates total completed hours from time logs using consistent truncation logic
 * Only counts approved overtime hours towards internship progress
 * @param logs - Array of time logs with time_in and time_out fields
 * @param internId - Optional intern ID to filter logs (can be string or number)
 * @returns Total completed hours as a number, truncated to 2 decimal places
 */
export function calculateInternshipProgress(
  logs: Array<{
    time_in?: string | null
    time_out?: string | null
    timeIn?: string | null
    timeOut?: string | null
    status?: string
    user_id?: number | string
    internId?: number | string
    log_type?: string
    overtime_status?: string
  }>,
  internId?: string | number
): number {
  // Filter logs for specific intern if provided
  const filteredLogs = internId 
    ? logs.filter(log => 
        (log.user_id?.toString() === internId.toString()) ||
        (log.internId?.toString() === internId.toString())
      )
    : logs

  // Sum all durations using truncation, then convert sum to hours
  let totalDurationMs = 0

  filteredLogs.forEach(log => {
    // Handle both naming conventions: time_in/time_out and timeIn/timeOut
    const timeIn = log.time_in || log.timeIn
    const timeOut = log.time_out || log.timeOut

    // Only count completed logs with both times
    if (timeIn && timeOut && (!log.status || log.status === 'completed')) {
      // For overtime logs, only count if approved, skip if rejected or pending
      if (log.log_type === 'overtime') {
        if (log.overtime_status !== 'approved') {
          return // Skip pending or rejected overtime
        }
      }

      const inDate = new Date(timeIn)
      const outDate = new Date(timeOut)
      const diffMs = outDate.getTime() - inDate.getTime()
      
      if (diffMs > 0) {
        // Truncate seconds from individual durations before adding
        const truncatedMs = Math.floor(diffMs / (1000 * 60)) * (1000 * 60)
        totalDurationMs += truncatedMs
      }
    }
  })

  // Convert total duration to hours and truncate to 2 decimals
  const totalHours = totalDurationMs / (1000 * 60 * 60)
  return Number(truncateTo2Decimals(totalHours))
}

/**
 * Converts UTC date string to local date string (YYYY-MM-DD)
 */
export function getLocalDateString(dateStr: string): string {
  const d = new Date(dateStr)
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0")
}

/**
 * Gets current date in YYYY-MM-DD format
 */
export function getCurrentDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Gets the Monday-Sunday range for a given date
 */
export function getWeekRange(date = new Date()) {
  const day = date.getDay()
  const diffToMonday = (day === 0 ? -6 : 1) - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMonday)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { monday, sunday }
}

/**
 * Extracts date string in YYYY-MM-DD format from a Date object or timestamp
 */
export function extractDateString(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  
  // Check if date is valid
  if (isNaN(d.getTime())) {
    return ""  // Return empty string for invalid dates
  }
  
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * Filters logs by intern ID (matches either user_id or internId)
 */
export function filterLogsByInternId<T extends { user_id?: number | string; internId?: number | string }>(
  logs: T[], 
  internId: string | number | undefined
): T[] {
  if (!internId) return logs
  return logs.filter(log =>
    log.user_id?.toString() === internId.toString() ||
    log.internId?.toString() === internId.toString()
  )
}

/**
 * Default internship details for fallback values
 */
export const DEFAULT_INTERNSHIP_DETAILS = {
  school: { name: "N/A" },
  department: { name: "N/A" },
  supervisor: "N/A",
  required_hours: 0,
  start_date: "",
  end_date: "",
  status: "",
} as const
