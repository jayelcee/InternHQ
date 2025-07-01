/**
 * Centralized session processing utilities for time log management
 * 
 * This module provides consistent session grouping, overtime calculations,
 * and display logic used across DTR, weekly logs, and admin dashboard.
 * 
 * Key functions:
 * - processTimeLogSessions: Main session processing logic
 * - calculateSessionTotals: Overtime and regular hour calculations
 * - getSessionBadgeProps: Consistent badge styling
 * - groupLogsByContinuousSessions: Session grouping algorithm
 */

import { TimeLogDisplay } from "@/lib/ui-utils"
import { calculateTimeWorked, DAILY_REQUIRED_HOURS, truncateTo2Decimals } from "@/lib/time-utils"

export interface ProcessedSession {
  logs: TimeLogDisplay[]
  timeIn: string | null
  timeOut: string | null
  isActive: boolean
  isOvertimeSession: boolean
  overtimeStatus: "none" | "pending" | "approved" | "rejected"
  regularHours: number
  overtimeHours: number
  sessionType: "regular" | "overtime" | "extended_overtime"
}

export interface SessionTotals {
  totalRegularHours: number
  totalOvertimeHours: number
  overallOvertimeStatus: "none" | "pending" | "approved" | "rejected"
  hasExcessRegularHours: boolean
}

export interface BadgeProps {
  className: string
  text: string
  variant: "outline" | "default"
}

/**
 * Main session processing function that handles all the complex logic
 * for grouping logs into continuous sessions and calculating totals
 */
export function processTimeLogSessions(
  logs: TimeLogDisplay[],
  currentTime: Date = new Date(),
  freezeAt?: Date | null
): {
  sessions: ProcessedSession[]
  totals: SessionTotals
} {
  const endTime = freezeAt || currentTime

  // Separate regular and overtime logs
  const regularLogs = logs.filter(log => !log.log_type || log.log_type === "regular")
  const overtimeLogs = logs.filter(log => log.log_type === "overtime" || log.log_type === "extended_overtime")
  
  // Sort all logs chronologically
  const allLogs = [...regularLogs, ...overtimeLogs].sort((a, b) => {
    const aTime = a.time_in || a.time_out || ""
    const bTime = b.time_in || b.time_out || ""
    return new Date(aTime).getTime() - new Date(bTime).getTime()
  })

  // Group logs into continuous sessions
  const sessions = groupLogsByContinuousSessions(allLogs, endTime)
  
  // Calculate session totals
  const totals = calculateSessionTotals(sessions)

  return { sessions, totals }
}

/**
 * Groups logs into continuous sessions with 1-minute tolerance
 */
function groupLogsByContinuousSessions(
  logs: TimeLogDisplay[],
  endTime: Date
): ProcessedSession[] {
  const sessions: ProcessedSession[] = []
  let currentSessionLogs: TimeLogDisplay[] = []

  const isContinuous = (log1: TimeLogDisplay, log2: TimeLogDisplay): boolean => {
    if (!log1.time_out || !log2.time_in) return false
    const gap = new Date(log2.time_in).getTime() - new Date(log1.time_out).getTime()
    return gap <= 60 * 1000 // 1 minute tolerance
  }

  for (const log of logs) {
    if (currentSessionLogs.length === 0) {
      currentSessionLogs = [log]
    } else {
      const lastLog = currentSessionLogs[currentSessionLogs.length - 1]
      if (isContinuous(lastLog, log)) {
        currentSessionLogs.push(log)
      } else {
        sessions.push(createProcessedSession(currentSessionLogs, endTime))
        currentSessionLogs = [log]
      }
    }
  }

  if (currentSessionLogs.length > 0) {
    sessions.push(createProcessedSession(currentSessionLogs, endTime))
  }

  return sessions
}

/**
 * Creates a ProcessedSession from a group of logs
 */
function createProcessedSession(logs: TimeLogDisplay[], endTime: Date): ProcessedSession {
  const firstLog = logs[0]
  const lastLog = logs[logs.length - 1]
  
  const timeIn = firstLog?.time_in
  const timeOut = lastLog?.time_out
  const isActive = !timeOut && !!timeIn
  
  // Determine if this is an overtime session
  const isOvertimeSession = logs.every(log => log.log_type === "overtime" || log.log_type === "extended_overtime")
  
  // Determine overtime status
  let overtimeStatus: "none" | "pending" | "approved" | "rejected" = "none"
  if (isOvertimeSession || logs.some(log => log.log_type === "overtime" || log.log_type === "extended_overtime")) {
    const overtimeLogs = logs.filter(log => log.log_type === "overtime" || log.log_type === "extended_overtime")
    if (overtimeLogs.some(log => log.overtime_status === "rejected")) {
      overtimeStatus = "rejected"
    } else if (overtimeLogs.some(log => log.overtime_status === "approved")) {
      overtimeStatus = "approved"
    } else if (overtimeLogs.some(log => !log.overtime_status || log.overtime_status === "pending")) {
      overtimeStatus = "pending"
    }
  }

  // Calculate hours for this session
  let regularHours = 0
  let overtimeHours = 0

  for (const log of logs) {
    if (log.time_in) {
      const endTimeStr = log.time_out || endTime.toISOString()
      const result = calculateTimeWorked(log.time_in, endTimeStr)
      const logHours = result.hoursWorked

      if (log.log_type === "overtime" || log.log_type === "extended_overtime") {
        overtimeHours += logHours
      } else {
        regularHours += logHours
      }
    }
  }

  // Determine session type
  const sessionType = logs.some(log => log.log_type === "extended_overtime") 
    ? "extended_overtime" 
    : logs.some(log => log.log_type === "overtime")
      ? "overtime"
      : "regular"

  return {
    logs,
    timeIn,
    timeOut,
    isActive,
    isOvertimeSession,
    overtimeStatus,
    regularHours,
    overtimeHours,
    sessionType
  }
}

/**
 * Calculates total hours across all sessions with overflow handling
 */
function calculateSessionTotals(sessions: ProcessedSession[]): SessionTotals {
  let totalRegularHours = 0
  let totalOvertimeHours = 0
  let overallOvertimeStatus: "none" | "pending" | "approved" | "rejected" = "none"

  // Sum up all hours
  for (const session of sessions) {
    totalRegularHours += session.regularHours
    totalOvertimeHours += session.overtimeHours

    // Aggregate overtime status
    if (session.overtimeStatus === "rejected") {
      overallOvertimeStatus = "rejected"
    } else if (session.overtimeStatus === "approved" && overallOvertimeStatus !== "rejected") {
      overallOvertimeStatus = "approved"
    } else if (session.overtimeStatus === "pending" && overallOvertimeStatus === "none") {
      overallOvertimeStatus = "pending"
    }
  }

  // Handle overflow from regular to overtime
  const hasExcessRegularHours = totalRegularHours > DAILY_REQUIRED_HOURS
  if (hasExcessRegularHours) {
    const excess = totalRegularHours - DAILY_REQUIRED_HOURS
    totalRegularHours = DAILY_REQUIRED_HOURS
    totalOvertimeHours += excess
    if (overallOvertimeStatus === "none") {
      overallOvertimeStatus = "pending"
    }
  }

  // Handle rejected overtime
  if (overallOvertimeStatus === "rejected") {
    totalRegularHours = Math.min(totalRegularHours, DAILY_REQUIRED_HOURS)
    totalOvertimeHours = 0
  }

  return {
    totalRegularHours,
    totalOvertimeHours,
    overallOvertimeStatus,
    hasExcessRegularHours
  }
}

/**
 * Gets consistent badge properties for time display
 */
export function getTimeBadgeProps(
  time: string | null,
  logType: "regular" | "overtime" | "extended_overtime" = "regular",
  variant: "in" | "out" | "active" = "in",
  overtimeStatus?: "pending" | "approved" | "rejected" | "none"
): BadgeProps {
  if (!time && variant !== "active") {
    return {
      className: "bg-gray-100 text-gray-700 border-gray-300",
      text: "--",
      variant: "outline"
    }
  }

  if (variant === "active") {
    return {
      className: "bg-yellow-100 text-yellow-700 border-yellow-300",
      text: "In Progress",
      variant: "outline"
    }
  }

  // Overtime badge styling
  if (logType === "overtime" || logType === "extended_overtime") {
    if (overtimeStatus === "approved") {
      return {
        className: "bg-purple-100 text-purple-700 border-purple-300",
        text: new Date(time!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        variant: "outline"
      }
    } else if (overtimeStatus === "rejected") {
      return {
        className: "bg-gray-100 text-gray-700 border-gray-300",
        text: new Date(time!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        variant: "outline"
      }
    } else {
      return {
        className: "bg-yellow-100 text-yellow-700 border-yellow-300",
        text: new Date(time!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        variant: "outline"
      }
    }
  }

  // Regular time badge styling
  const regularClasses = {
    in: "bg-green-100 text-green-700 border-green-300",
    out: "bg-red-100 text-red-700 border-red-300",
    active: "bg-yellow-100 text-yellow-700 border-yellow-300"
  }

  return {
    className: regularClasses[variant],
    text: new Date(time!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    variant: "outline"
  }
}

/**
 * Gets badge properties for duration display
 */
export function getDurationBadgeProps(
  hours: number,
  type: "regular" | "overtime" = "regular",
  overtimeStatus?: "pending" | "approved" | "rejected" | "none"
): BadgeProps {
  const displayHours = Math.floor(hours)
  const displayMinutes = Math.round((hours % 1) * 60)
  const text = `${displayHours}h ${displayMinutes.toString().padStart(2, '0')}m`

  if (hours === 0) {
    return {
      className: "bg-gray-100 text-gray-700 border-gray-300",
      text,
      variant: "outline"
    }
  }

  if (type === "overtime") {
    if (overtimeStatus === "approved") {
      return {
        className: "bg-purple-100 text-purple-700 border-purple-300",
        text,
        variant: "outline"
      }
    } else if (overtimeStatus === "rejected") {
      return {
        className: "bg-gray-100 text-gray-700 border-gray-300",
        text,
        variant: "outline"
      }
    } else {
      return {
        className: "bg-yellow-100 text-yellow-700 border-yellow-300",
        text,
        variant: "outline"
      }
    }
  }

  // Regular hours
  return {
    className: "bg-blue-100 text-blue-700 border-blue-300",
    text,
    variant: "outline"
  }
}

/**
 * Gets total badge properties for summary display
 */
export function getTotalBadgeProps(hours: number, type: "regular" | "overtime" = "regular"): BadgeProps {
  const text = `${truncateTo2Decimals(hours)}h`
  
  if (hours === 0) {
    return {
      className: "bg-gray-100 text-gray-700 border-gray-300",
      text,
      variant: "outline"
    }
  }

  if (type === "overtime") {
    return {
      className: "bg-purple-200 text-purple-800 border-purple-400 font-medium",
      text,
      variant: "outline"
    }
  }

  return {
    className: "bg-blue-200 text-blue-800 border-blue-400 font-medium",
    text,
    variant: "outline"
  }
}
