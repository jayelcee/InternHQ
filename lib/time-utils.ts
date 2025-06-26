/**
 * Centralized time calculation utilities
 * This module provides consistent time calculation functions used across the application
 */

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
