/**
 * Common UI component utilities and patterns for consistent behavior
 * 
 * Key utilities:
 * - groupLogsByDate: Centralized log grouping logic used by DTR and other components
 * - formatLogDate: Consistent date formatting across time log displays
 * - Badge styling utilities for consistent color schemes
 * 
 * Usage: Import these functions instead of creating duplicate grouping/formatting
 * logic in individual components.
 */

import { useState, useCallback } from "react"
import { calculateTimeWorked, extractDateString } from "@/lib/time-utils"

/**
 * Common time log interface used across components
 */
export interface TimeLogDisplay {
  id: number
  time_in: string | null
  time_out: string | null
  status: "pending" | "completed"
  log_type?: "regular" | "overtime" | "extended_overtime"
  overtime_status?: "pending" | "approved" | "rejected"
  user_id?: number | string
  internId?: number | string
  hoursWorked?: number
  duration?: string | null
}

/**
 * Common internship details interface
 */
export interface InternshipDetails {
  school?: { name: string }
  department?: { name: string }
  supervisor?: string
  required_hours: number
  start_date: string
  end_date: string
  status?: string
}

/**
 * Hook for managing async actions with loading states
 */
export function useAsyncAction() {
  const [loading, setLoading] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const executeAction = useCallback(async (
    actionName: string,
    action: () => Promise<void>
  ) => {
    if (loading) return
    
    setLoading(true)
    setLoadingAction(actionName)
    
    try {
      await action()
    } finally {
      setLoading(false)
      setLoadingAction(null)
    }
  }, [loading])

  return { loading, loadingAction, executeAction }
}

/**
 * Groups time logs by date for consistent display across components
 */
export function groupLogsByDate(logs: TimeLogDisplay[]): Array<[string, TimeLogDisplay[]]> {
  const map = new Map<string, TimeLogDisplay[]>()
  
  logs.forEach(log => {
    const internId = log.user_id ?? log.internId ?? ""
    
    let dateKey = ""
    if (log.time_in) {
      dateKey = extractDateString(log.time_in)
    } else if (log.time_out) {
      dateKey = extractDateString(log.time_out)
    }
    
    // Skip logs with invalid or empty dates
    if (!dateKey) return
    
    const key = `${internId}-${dateKey}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(log)
  })
  
  // Sort logs within each group by time_in
  map.forEach(arr => arr.sort((a, b) => {
    const aTime = a.time_in || a.time_out || ""
    const bTime = b.time_in || b.time_out || ""
    
    // Handle invalid dates in sorting
    const aDate = new Date(aTime)
    const bDate = new Date(bTime)
    
    if (isNaN(aDate.getTime()) && isNaN(bDate.getTime())) return 0
    if (isNaN(aDate.getTime())) return 1
    if (isNaN(bDate.getTime())) return -1
    
    return aDate.getTime() - bDate.getTime()
  }))
  
  // Return sorted by date ascending
  return Array.from(map.entries()).sort((a, b) => {
    const aDate = a[0].split("-").slice(-3).join("-")
    const bDate = b[0].split("-").slice(-3).join("-")
    
    const dateA = new Date(aDate)
    const dateB = new Date(bDate)
    
    // Handle invalid dates in sorting
    if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0
    if (isNaN(dateA.getTime())) return 1
    if (isNaN(dateB.getTime())) return -1
    
    return dateA.getTime() - dateB.getTime()
  })
}

/**
 * Formats a date string for consistent display
 */
export function formatLogDate(dateStr: string): string {
  // Handle potential invalid dates gracefully
  if (!dateStr || dateStr === "Invalid Date") {
    return "Invalid Date"
  }
  
  const date = new Date(dateStr)
  
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return "Invalid Date"
  }
  
  return date.toLocaleDateString("en-US", { 
    month: "short", 
    day: "numeric", 
    year: "numeric" 
  })
}

/**
 * Gets time badge styling configuration for consistent appearance
 */
export function getTimeBadgeConfig(
  time: string,
  logType: "regular" | "overtime" | "extended_overtime" = "regular",
  variant: "in" | "out" | "active" = "in"
) {
  let classes = ""
  
  if (logType === "overtime" || logType === "extended_overtime") {
    classes = "bg-purple-50 text-purple-700 border-purple-300"
  } else {
    switch (variant) {
      case "in":
        classes = "bg-green-50 text-green-700 border-green-300"
        break
      case "out":
        classes = "bg-blue-50 text-blue-700 border-blue-300"
        break
      case "active":
        classes = "bg-yellow-50 text-yellow-700 border-yellow-300"
        break
    }
  }

  const displayTime = variant === "active" 
    ? "In Progress" 
    : new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  return {
    className: classes,
    displayTime,
    variant: "outline" as const
  }
}

/**
 * Calculates duration display for time logs with consistent formatting
 */
export function getDurationDisplay(log: TimeLogDisplay): string {
  if (log.time_in && log.time_out) {
    const result = calculateTimeWorked(log.time_in, log.time_out)
    return result.duration
  }
  return "--"
}

/**
 * Calculates decimal hours display for time logs
 */
export function getDecimalHoursDisplay(log: TimeLogDisplay): string {
  if (log.time_in && log.time_out) {
    const result = calculateTimeWorked(log.time_in, log.time_out)
    return `${result.decimal}h`
  }
  return "--"
}

/**
 * Default internship details for fallback
 */
export const DEFAULT_INTERNSHIP_DETAILS: InternshipDetails = {
  school: { name: "N/A" },
  department: { name: "N/A" },
  supervisor: "N/A",
  required_hours: 0,
  start_date: "",
  end_date: "",
  status: "",
}

/**
 * Calculates progress percentage with bounds checking
 */
export function calculateProgressPercentage(completed: number, required: number): number {
  if (required <= 0) return 0
  return Math.min((completed / required) * 100, 100)
}

/**
 * Common fetch wrapper with error handling
 */
export async function fetchWithErrorHandling<T>(
  url: string,
  options: RequestInit = {}
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const response = await fetch(url, {
      credentials: "include",
      ...options,
    })

    if (!response.ok) {
      return { success: false, error: `Request failed with status ${response.status}` }
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Network error" 
    }
  }
}

/**
 * Calculate overtime statistics from a list of logs
 */
export function calculateOvertimeStats(logs: TimeLogDisplay[]) {
  const overtimeLogs = logs.filter(log => log.log_type === "overtime" || log.log_type === "extended_overtime")
  
  return {
    hasApproved: overtimeLogs.some(log => log.overtime_status === "approved"),
    hasRejected: overtimeLogs.some(log => log.overtime_status === "rejected"), 
    hasPending: overtimeLogs.some(log => !log.overtime_status || log.overtime_status === "pending"),
    approved: overtimeLogs.filter(log => log.overtime_status === "approved"),
    rejected: overtimeLogs.filter(log => log.overtime_status === "rejected"),
    pending: overtimeLogs.filter(log => !log.overtime_status || log.overtime_status === "pending")
  }
}

/**
 * Calculate overtime hours for different statuses
 */
export function calculateOvertimeHours(logs: TimeLogDisplay[], status: "approved" | "rejected" | "pending") {
  return logs
    .filter(log => {
      if (status === "pending") {
        return !log.overtime_status || log.overtime_status === "pending"
      }
      return log.overtime_status === status
    })
    .reduce((sum, log) => {
      if (!log.time_in || !log.time_out) return sum
      const result = calculateTimeWorked(log.time_in, log.time_out)
      return sum + result.hoursWorked
    }, 0)
}

/**
 * Centralized sorting direction type
 */
export type SortDirection = "asc" | "desc"

/**
 * Centralized sort button component props and utilities
 */
export interface SortButtonConfig {
  direction: SortDirection
  onToggle: () => void
  label?: string
}

/**
 * Get sort button text based on direction
 */
export function getSortButtonText(direction: SortDirection, label: string = "Date"): string {
  if (direction === "desc") {
    return `Newest ${label} First ↓`
  } else {
    return `Oldest ${label} First ↑`
  }
}

/**
 * Sort logs by date with the given direction
 */
export function sortLogsByDate<T extends { created_at?: string; time_in?: string | null; date?: string }>(
  logs: T[], 
  direction: SortDirection = "desc"
): T[] {
  return [...logs].sort((a, b) => {
    // Extract date for comparison - prefer time_in, then created_at, then date
    const dateA = new Date(a.time_in || a.created_at || a.date || '').getTime()
    const dateB = new Date(b.time_in || b.created_at || b.date || '').getTime()
    
    return direction === "desc" ? dateB - dateA : dateA - dateB
  })
}

/**
 * Sort grouped logs by date key with the given direction
 */
export function sortGroupedLogsByDate<T>(
  groupedLogs: [string, T][], 
  direction: SortDirection = "desc"
): [string, T][] {
  return [...groupedLogs].sort(([keyA], [keyB]) => {
    // Extract date from key (handles formats like "internId-YYYY-MM-DD" or just "YYYY-MM-DD")
    const datePartA = keyA.includes("-") ? keyA.split("-").slice(-3).join("-") : keyA
    const datePartB = keyB.includes("-") ? keyB.split("-").slice(-3).join("-") : keyB
    
    const dateA = new Date(datePartA).getTime()
    const dateB = new Date(datePartB).getTime()
    
    return direction === "desc" ? dateB - dateA : dateA - dateB
  })
}

/**
 * Hook for managing sort direction state
 */
export function useSortDirection(initialDirection: SortDirection = "desc") {
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialDirection)
  
  const toggleSort = useCallback(() => {
    setSortDirection(prev => prev === "desc" ? "asc" : "desc")
  }, [])
  
  return {
    sortDirection,
    setSortDirection,
    toggleSort,
    sortButtonText: getSortButtonText(sortDirection)
  }
}
