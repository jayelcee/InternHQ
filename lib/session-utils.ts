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
import { calculateTimeWorked, DAILY_REQUIRED_HOURS, truncateTo2Decimals, calculateAccurateSessionDuration, calculateRawSessionDuration, formatAccurateHours } from "@/lib/time-utils"

export interface ProcessedSession {
  logs: TimeLogDisplay[]
  timeIn: string | null
  timeOut: string | null
  isActive: boolean
  isOvertimeSession: boolean
  isContinuousSession: boolean // New: indicates mixed regular/overtime logs
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
  
  // Determine if this is a continuous session (contains both regular and overtime logs)
  const hasRegularLogs = logs.some(log => !log.log_type || log.log_type === "regular")
  const hasOvertimeLogs = logs.some(log => log.log_type === "overtime" || log.log_type === "extended_overtime")
  const isContinuousSession = hasRegularLogs && hasOvertimeLogs
  
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
    isContinuousSession,
    overtimeStatus,
    regularHours,
    overtimeHours,
    sessionType
  }
}

/**
 * Calculates total hours across all sessions with real-time overflow handling
 * For active sessions, excess regular hours are immediately shown as overtime
 */
function calculateSessionTotals(sessions: ProcessedSession[]): SessionTotals {
  let totalRegularHours = 0
  let totalOvertimeHours = 0
  let overallOvertimeStatus: "none" | "pending" | "approved" | "rejected" = "none"

  // Sum up all hours with real-time overflow for active sessions
  for (const session of sessions) {
    let sessionRegularHours = session.regularHours
    let sessionOvertimeHours = session.overtimeHours

    // For active sessions or completed sessions, apply real-time overflow
    if (session.isActive || session.regularHours + session.overtimeHours > 0) {
      const currentTotalRegular = totalRegularHours + sessionRegularHours
      
      // If adding this session's regular hours exceeds the daily limit
      if (currentTotalRegular > DAILY_REQUIRED_HOURS) {
        const availableRegularHours = Math.max(0, DAILY_REQUIRED_HOURS - totalRegularHours)
        const excessRegularHours = sessionRegularHours - availableRegularHours
        
        sessionRegularHours = availableRegularHours
        sessionOvertimeHours += excessRegularHours
        
        // Set overtime status to pending if we have excess and no explicit overtime status
        if (excessRegularHours > 0 && session.overtimeStatus === "none") {
          session.overtimeStatus = "pending"
        }
      }
    }

    totalRegularHours += sessionRegularHours
    totalOvertimeHours += sessionOvertimeHours

    // Aggregate overtime status
    if (session.overtimeStatus === "rejected") {
      overallOvertimeStatus = "rejected"
    } else if (session.overtimeStatus === "approved" && overallOvertimeStatus !== "rejected") {
      overallOvertimeStatus = "approved"
    } else if (session.overtimeStatus === "pending" && overallOvertimeStatus === "none") {
      overallOvertimeStatus = "pending"
    }
  }

  // Final safety cap on regular hours
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
 * For continuous sessions (mixed regular/overtime), uses regular colors
 * For separate overtime sessions, uses overtime status colors
 */
export function getTimeBadgeProps(
  time: string | null,
  logType: "regular" | "overtime" | "extended_overtime" = "regular",
  variant: "in" | "out" | "active" = "in",
  overtimeStatus?: "pending" | "approved" | "rejected" | "none",
  isContinuousSession?: boolean
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

  // For continuous sessions (mixed regular/overtime), always use regular colors
  if (isContinuousSession) {
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

  // For separate overtime sessions, use overtime status colors
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
  type: "regular" | "overtime" | "extended_overtime" = "regular",
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

  if (type === "overtime" || type === "extended_overtime") {
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
export function getTotalBadgeProps(hours: number, type: "regular" | "overtime" | "extended_overtime" = "regular"): BadgeProps {
  const text = `${truncateTo2Decimals(hours)}h`
  
  if (hours === 0) {
    return {
      className: "bg-gray-100 text-gray-700 border-gray-300",
      text,
      variant: "outline"
    }
  }

  if (type === "overtime" || type === "extended_overtime") {
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

/**
 * Calculates adjusted hours for a session considering real-time overflow
 * This is used for display purposes to show proper regular/overtime split
 */
export function getAdjustedSessionHours(
  session: ProcessedSession,
  previousRegularHours: number
): { adjustedRegularHours: number; adjustedOvertimeHours: number } {
  const availableRegularHours = Math.max(0, DAILY_REQUIRED_HOURS - previousRegularHours)
  
  if (session.regularHours <= availableRegularHours) {
    // No overflow needed
    return {
      adjustedRegularHours: session.regularHours,
      adjustedOvertimeHours: session.overtimeHours
    }
  } else {
    // Apply overflow
    const excessRegularHours = session.regularHours - availableRegularHours
    return {
      adjustedRegularHours: availableRegularHours,
      adjustedOvertimeHours: session.overtimeHours + excessRegularHours
    }
  }
}

/**
 * Processes logs for continuous editing - combines continuous logs into single editable sessions
 * Used by edit dialogs and admin panels to handle continuous sessions as single units
 */
export function processLogsForContinuousEditing(
  logs: TimeLogDisplay[]
): Array<{
  id: string
  logs: TimeLogDisplay[]
  earliestTimeIn: string | null
  latestTimeOut: string | null
  isContinuousSession: boolean
  sessionType: "regular" | "overtime" | "extended_overtime" | "mixed"
}> {
  if (logs.length === 0) return []

  // Sort logs chronologically
  const sortedLogs = [...logs].sort((a, b) => {
    const aTime = a.time_in || ""
    const bTime = b.time_in || ""
    return new Date(aTime).getTime() - new Date(bTime).getTime()
  })

  const sessions: Array<{
    id: string
    logs: TimeLogDisplay[]
    earliestTimeIn: string | null
    latestTimeOut: string | null
    isContinuousSession: boolean
    sessionType: "regular" | "overtime" | "extended_overtime" | "mixed"
  }> = []

  let currentSessionLogs: TimeLogDisplay[] = []

  // Check if two logs are continuous (same 1-minute tolerance as session processing)
  const isContinuous = (log1: TimeLogDisplay, log2: TimeLogDisplay): boolean => {
    if (!log1.time_out || !log2.time_in) return false
    const gap = new Date(log2.time_in).getTime() - new Date(log1.time_out).getTime()
    return gap <= 60 * 1000 // 1 minute tolerance
  }

  for (const log of sortedLogs) {
    if (currentSessionLogs.length === 0) {
      currentSessionLogs = [log]
    } else {
      const lastLog = currentSessionLogs[currentSessionLogs.length - 1]
      if (isContinuous(lastLog, log)) {
        currentSessionLogs.push(log)
      } else {
        // Create session from current logs
        sessions.push(createEditableSession(currentSessionLogs))
        currentSessionLogs = [log]
      }
    }
  }

  if (currentSessionLogs.length > 0) {
    sessions.push(createEditableSession(currentSessionLogs))
  }

  return sessions
}

/**
 * Creates an editable session from a group of continuous logs
 */
function createEditableSession(logs: TimeLogDisplay[]): {
  id: string
  logs: TimeLogDisplay[]
  earliestTimeIn: string | null
  latestTimeOut: string | null
  isContinuousSession: boolean
  sessionType: "regular" | "overtime" | "extended_overtime" | "mixed"
} {
  const earliestTimeIn = logs[0]?.time_in || null
  const latestTimeOut = logs[logs.length - 1]?.time_out || null
  const isContinuousSession = logs.length > 1

  // Determine session type
  const logTypes = new Set(logs.map(log => log.log_type || "regular"))
  let sessionType: "regular" | "overtime" | "extended_overtime" | "mixed"
  
  if (logTypes.size === 1) {
    const singleType = Array.from(logTypes)[0] as "regular" | "overtime" | "extended_overtime"
    sessionType = singleType
  } else {
    sessionType = "mixed"
  }

  // Create unique ID for this session
  const id = logs.map(l => l.id).join("-")

  return {
    id,
    logs,
    earliestTimeIn,
    latestTimeOut,
    isContinuousSession,
    sessionType
  }
}

/**
 * Groups edit requests by continuous sessions for admin processing
 * Used to handle approve/reject/revert operations on continuous sessions as single units
 */
export function groupEditRequestsByContinuousSessions(
  requests: Array<{
    id: number
    logId: number
    originalTimeIn: string | null
    originalTimeOut: string | null
    requestedTimeIn: string | null
    requestedTimeOut: string | null
    status: "pending" | "approved" | "rejected"
    internName: string
    [key: string]: unknown
  }>
): Array<{
  sessionId: string
  requests: typeof requests
  originalTimeIn: string | null
  originalTimeOut: string | null
  requestedTimeIn: string | null
  requestedTimeOut: string | null
  status: "pending" | "approved" | "rejected"
  internName: string
  allRequestIds: number[]
}> {
  if (requests.length === 0) return []

  // Sort by original time in
  const sortedRequests = [...requests].sort((a, b) => {
    const aTime = a.originalTimeIn || a.requestedTimeIn || ""
    const bTime = b.originalTimeIn || b.requestedTimeIn || ""
    return new Date(aTime).getTime() - new Date(bTime).getTime()
  })

  const sessions: Array<{
    sessionId: string
    requests: typeof requests
    originalTimeIn: string | null
    originalTimeOut: string | null
    requestedTimeIn: string | null
    requestedTimeOut: string | null
    status: "pending" | "approved" | "rejected"
    internName: string
    allRequestIds: number[]
  }> = []

  let currentSessionRequests: typeof requests = []

  // Check if two edit requests are for continuous logs
  const isContinuous = (req1: typeof requests[0], req2: typeof requests[0]): boolean => {
    if (!req1.originalTimeOut || !req2.originalTimeIn) return false
    const gap = new Date(req2.originalTimeIn).getTime() - new Date(req1.originalTimeOut).getTime()
    return gap <= 60 * 1000 // 1 minute tolerance
  }

  for (const request of sortedRequests) {
    if (currentSessionRequests.length === 0) {
      currentSessionRequests = [request]
    } else {
      const lastRequest = currentSessionRequests[currentSessionRequests.length - 1]
      if (isContinuous(lastRequest, request)) {
        currentSessionRequests.push(request)
      } else {
        // Create session from current requests
        sessions.push(createEditRequestSession(currentSessionRequests))
        currentSessionRequests = [request]
      }
    }
  }

  if (currentSessionRequests.length > 0) {
    sessions.push(createEditRequestSession(currentSessionRequests))
  }

  return sessions
}

/**
 * Creates an edit request session from a group of continuous requests
 */
function createEditRequestSession(requests: Array<{
  id: number
  logId: number
  originalTimeIn: string | null
  originalTimeOut: string | null
  requestedTimeIn: string | null
  requestedTimeOut: string | null
  status: "pending" | "approved" | "rejected"
  internName: string
  [key: string]: unknown
}>): {
  sessionId: string
  requests: typeof requests
  originalTimeIn: string | null
  originalTimeOut: string | null
  requestedTimeIn: string | null
  requestedTimeOut: string | null
  status: "pending" | "approved" | "rejected"
  internName: string
  allRequestIds: number[]
} {
  // Find the actual earliest and latest times, not just array positions
  const originalTimeIn = requests
    .filter(req => req.originalTimeIn)
    .reduce((earliest, curr) => 
      new Date(curr.originalTimeIn!) < new Date(earliest.originalTimeIn!) ? curr : earliest
    )?.originalTimeIn || null
    
  const originalTimeOut = requests
    .filter(req => req.originalTimeOut)
    .reduce((latest, curr) => 
      new Date(curr.originalTimeOut!) > new Date(latest.originalTimeOut!) ? curr : latest
    )?.originalTimeOut || null
    
  const requestedTimeIn = requests
    .filter(req => req.requestedTimeIn)
    .reduce((earliest, curr) => 
      new Date(curr.requestedTimeIn!) < new Date(earliest.requestedTimeIn!) ? curr : earliest
    )?.requestedTimeIn || null
    
  const requestedTimeOut = requests
    .filter(req => req.requestedTimeOut)
    .reduce((latest, curr) => 
      new Date(curr.requestedTimeOut!) > new Date(latest.requestedTimeOut!) ? curr : latest
    )?.requestedTimeOut || null
  
  // Session status is based on the first request's status (all should be the same for continuous sessions)
  const status = requests[0]?.status || "pending"
  const internName = requests[0]?.internName || ""
  const allRequestIds = requests.map(r => r.id)
  const sessionId = allRequestIds.join("-")

  return {
    sessionId,
    requests,
    originalTimeIn,
    originalTimeOut,
    requestedTimeIn,
    requestedTimeOut,
    status,
    internName,
    allRequestIds
  }
}

/**
 * Creates real-time duration badges for regular and overtime hours
 * Matches the styling used in DTR components
 */
export function createDurationBadges(
  sessions: ProcessedSession[],
  currentTime: Date = new Date(),
  type: "regular" | "overtime" = "regular"
): Array<{ className: string; text: string; variant: "outline" }> {
  let previousRegularHours = 0
  
  return sessions.map((session) => {
    if (type === "regular") {
      const accurateCalc = calculateAccurateSessionDuration(
        session.logs,
        currentTime,
        previousRegularHours
      )
      
      const displayText = formatAccurateHours(accurateCalc.regularHours)
      const className = accurateCalc.regularHours > 0 ? 
        "bg-blue-100 text-blue-700 border-blue-300" : 
        "bg-gray-100 text-gray-700 border-gray-300"
      
      previousRegularHours += accurateCalc.regularHours
      
      return {
        className,
        text: displayText,
        variant: "outline" as const
      }
    } else {
      // Overtime badges
      const rawCalc = calculateRawSessionDuration(
        session.logs,
        currentTime,
        previousRegularHours
      )
      
      const displayText = formatAccurateHours(rawCalc.overtimeHours)
      let className = "bg-gray-100 text-gray-700 border-gray-300"
      
      if (rawCalc.overtimeHours > 0) {
        if (rawCalc.overtimeStatus === "approved") {
          className = "bg-purple-100 text-purple-700 border-purple-300"
        } else if (rawCalc.overtimeStatus === "rejected") {
          className = "bg-gray-100 text-gray-700 border-gray-300"
        } else {
          className = "bg-yellow-100 text-yellow-700 border-yellow-300"
        }
      }
      
      previousRegularHours += rawCalc.regularHours
      
      return {
        className,
        text: displayText,
        variant: "outline" as const
      }
    }
  })
}
