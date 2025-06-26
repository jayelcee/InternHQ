/**
 * Common UI component utilities and patterns for consistent behavior
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
  log_type?: "regular" | "overtime"
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
    
    if (!dateKey) return
    
    const key = `${internId}-${dateKey}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(log)
  })
  
  // Sort logs within each group by time_in
  map.forEach(arr => arr.sort((a, b) => {
    const aTime = a.time_in || a.time_out || ""
    const bTime = b.time_in || b.time_out || ""
    return new Date(aTime).getTime() - new Date(bTime).getTime()
  }))
  
  // Return sorted by date ascending
  return Array.from(map.entries()).sort((a, b) => {
    const aDate = a[0].split("-").slice(-3).join("-")
    const bDate = b[0].split("-").slice(-3).join("-")
    return new Date(aDate).getTime() - new Date(bDate).getTime()
  })
}

/**
 * Formats a date string for consistent display
 */
export function formatLogDate(dateStr: string): string {
  const date = new Date(dateStr)
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
  logType: "regular" | "overtime" = "regular",
  variant: "in" | "out" | "active" = "in"
) {
  let classes = ""
  
  if (logType === "overtime") {
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
