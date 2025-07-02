"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Clock, Calendar, GraduationCap, Building, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useAuth } from "@/contexts/auth-context"
import { TimeTracking } from "@/components/time-tracking"
import { ThisWeekLogs } from "@/components/this-week-logs"
import { 
  calculateTimeWorked, 
  truncateTo2Decimals, 
  getLocalDateString, 
  getCurrentDateString, 
  getWeekRange,
  formatDuration,
  calculateTimeStatistics,
  calculateTodayProgressAccurate,
  DAILY_REQUIRED_HOURS,
  MAX_OVERTIME_HOURS
} from "@/lib/time-utils"
import { 
  TimeLogDisplay
} from "@/lib/ui-utils"


// Helper function to get today's date in the same format as the database entries
function getTodayDateString(): string {
  // Use the current date in the local timezone
  return getCurrentDateString()
}

// Helper function to safely get date string from a timestamp, handling timezones
function safeGetDateString(dateStr: string): string {
  try {
    return getLocalDateString(dateStr)
  } catch (error) {
    console.warn(`Error parsing date: ${dateStr}`, error)
    return ""
  }
}

/* Legacy function - replaced by calculateTodayProgressAccurate
function getTodayTotalDuration(logs: TimeLogDisplay[], isTimedIn: boolean, timeInTimestamp: Date | null, freezeAt?: Date, currentTime?: Date) {
  const today = getTodayDateString()
  let totalMs = 0

  // Sum up completed logs for today
  logs.forEach((log) => {
    if (
      log.time_in &&
      safeGetDateString(log.time_in) === today &&
      (log.log_type === "regular" || !log.log_type) &&
      log.time_out
    ) {
      const result = calculateTimeWorked(log.time_in, log.time_out)
      totalMs += result.hoursWorked * 60 * 60 * 1000 // Convert back to ms for accumulation
    }
  })

  // Add current active session if any
  if (isTimedIn && timeInTimestamp) {
    const end = freezeAt ? freezeAt : (currentTime || new Date())
    
    // Safeguard: Prevent unrealistic session durations (more than 24 hours)
    const sessionDurationHours = (end.getTime() - timeInTimestamp.getTime()) / (1000 * 60 * 60)
    if (sessionDurationHours > 24) {
      console.warn(`Unrealistic session duration detected: ${sessionDurationHours.toFixed(2)}h. Capping at 24h.`)
      const cappedEnd = new Date(timeInTimestamp.getTime() + (24 * 60 * 60 * 1000))
      const activeResult = calculateTimeWorked(timeInTimestamp, cappedEnd)
      totalMs += activeResult.hoursWorked * 60 * 60 * 1000
    } else {
      const activeResult = calculateTimeWorked(timeInTimestamp, end)
      totalMs += activeResult.hoursWorked * 60 * 60 * 1000
    }
  }

  // Convert total back to duration format
  const totalMinutes = Math.floor(totalMs / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return formatDuration(hours, minutes)
}
*/

/* Legacy function - replaced by calculateTodayProgressAccurate
function getTodayOvertimeByStatus(logs: TimeLogDisplay[], isTimedIn: boolean, timeInTimestamp: Date | null, isOvertimeIn: boolean, overtimeInTimestamp: Date | null, currentTime?: Date) {
  const today = getTodayDateString()
  let approvedMs = 0
  let pendingMs = 0
  let rejectedMs = 0

  // Sum up overtime logs for today by status
  logs.forEach((log) => {
    if (
      log.time_in &&
      safeGetDateString(log.time_in) === today &&
      (log.log_type === "overtime" || log.log_type === "extended_overtime") &&
      log.time_out
    ) {
      const result = calculateTimeWorked(log.time_in, log.time_out)
      const hoursMs = result.hoursWorked * 60 * 60 * 1000

      if (log.overtime_status === "approved") {
        approvedMs += hoursMs
      } else if (log.overtime_status === "rejected") {
        rejectedMs += hoursMs
      } else {
        // Default to pending if no status or pending status
        pendingMs += hoursMs
      }
    }
  })

  // Add current active overtime session as pending if any
  if (isOvertimeIn && overtimeInTimestamp) {
    const end = currentTime || new Date()
    
    // Calculate total time worked today up until the overtime started
    let regularTotalUpToOvertimeMs = 0
    logs.forEach((log) => {
      if (
        log.time_in &&
        safeGetDateString(log.time_in) === today &&
        (log.log_type === "regular" || !log.log_type) &&
        log.time_out
      ) {
        const result = calculateTimeWorked(log.time_in, log.time_out)
        regularTotalUpToOvertimeMs += result.hoursWorked * 60 * 60 * 1000
      }
    })
    
    // Add active regular session up to when overtime started
    if (isTimedIn && timeInTimestamp) {
      const regularEnd = overtimeInTimestamp
      const activeResult = calculateTimeWorked(timeInTimestamp, regularEnd)
      regularTotalUpToOvertimeMs += activeResult.hoursWorked * 60 * 60 * 1000
    }
    
    // Calculate total time (regular + overtime) and determine how much is truly overtime
    const activeOvertimeResult = calculateTimeWorked(overtimeInTimestamp, end)
    const totalTimeMs = regularTotalUpToOvertimeMs + (activeOvertimeResult.hoursWorked * 60 * 60 * 1000)
    const requiredMs = DAILY_REQUIRED_HOURS * 60 * 60 * 1000
    
    // Only count time beyond required hours as overtime
    if (totalTimeMs > requiredMs) {
      const overtimeMs = totalTimeMs - requiredMs
      pendingMs += overtimeMs
    }
  } else {
    // No active overtime session - check if regular time exceeds required hours
    // Calculate total regular time worked today to check for excess
    let regularTotalMs = 0
    logs.forEach((log) => {
      if (
        log.time_in &&
        safeGetDateString(log.time_in) === today &&
        (log.log_type === "regular" || !log.log_type) &&
        log.time_out
      ) {
        const result = calculateTimeWorked(log.time_in, log.time_out)
        regularTotalMs += result.hoursWorked * 60 * 60 * 1000
      }
    })

    // Add current active regular session if any
    if (isTimedIn && timeInTimestamp) {
      const end = currentTime || new Date()
      
      // Safeguard: Prevent unrealistic session durations (more than 24 hours)
      const sessionDurationHours = (end.getTime() - timeInTimestamp.getTime()) / (1000 * 60 * 60)
      if (sessionDurationHours > 24) {
        console.warn(`Unrealistic active regular session duration detected: ${sessionDurationHours.toFixed(2)}h. Capping at 24h.`)
        const cappedEnd = new Date(timeInTimestamp.getTime() + (24 * 60 * 60 * 1000))
        const activeResult = calculateTimeWorked(timeInTimestamp, cappedEnd)
        regularTotalMs += activeResult.hoursWorked * 60 * 60 * 1000
      } else {
        const activeResult = calculateTimeWorked(timeInTimestamp, end)
        regularTotalMs += activeResult.hoursWorked * 60 * 60 * 1000
      }
    }

    // If regular time exceeds required hours, treat excess as pending overtime
    const requiredMs = DAILY_REQUIRED_HOURS * 60 * 60 * 1000
    if (regularTotalMs > requiredMs) {
      const excessMs = regularTotalMs - requiredMs
      pendingMs += excessMs
    }
  }

  return {
    approved: approvedMs / (1000 * 60 * 60),
    pending: pendingMs / (1000 * 60 * 60),
    rejected: rejectedMs / (1000 * 60 * 60),
    total: (approvedMs + pendingMs + rejectedMs) / (1000 * 60 * 60)
  }
}
*/





/**
 * Helper function to get total hours worked today as a number (regular + overtime)
 */
function getTodayTotalHours(logs: TimeLogDisplay[], isTimedIn: boolean, timeInTimestamp: Date | null, isOvertimeIn: boolean, overtimeInTimestamp: Date | null, isExtendedOvertimeIn?: boolean, extendedOvertimeInTimestamp?: Date | null, freezeAt?: Date, currentTime?: Date) {
  const today = getTodayDateString()
  let totalMs = 0

  // Sum up completed regular logs for today
  logs.forEach((log) => {
    if (
      log.time_in &&
      safeGetDateString(log.time_in) === today &&
      (log.log_type === "regular" || !log.log_type) &&
      log.time_out
    ) {
      const result = calculateTimeWorked(log.time_in, log.time_out)
      totalMs += result.hoursWorked * 60 * 60 * 1000
    }
  })

  // Sum up completed overtime and extended overtime logs for today
  logs.forEach((log) => {
    if (
      log.time_in &&
      safeGetDateString(log.time_in) === today &&
      (log.log_type === "overtime" || log.log_type === "extended_overtime") &&
      log.time_out
    ) {
      const result = calculateTimeWorked(log.time_in, log.time_out)
      totalMs += result.hoursWorked * 60 * 60 * 1000
    }
  })

  // Add current active regular session if any
  if (isTimedIn && timeInTimestamp) {
    const end = freezeAt ? freezeAt : (currentTime || new Date())
    const activeResult = calculateTimeWorked(timeInTimestamp, end)
    totalMs += activeResult.hoursWorked * 60 * 60 * 1000
  }

  // Add current active overtime session if any
  if (isOvertimeIn && overtimeInTimestamp) {
    const end = freezeAt ? freezeAt : (currentTime || new Date())
    const activeResult = calculateTimeWorked(overtimeInTimestamp, end)
    totalMs += activeResult.hoursWorked * 60 * 60 * 1000
  }

  // Add current active extended overtime session if any
  if (isExtendedOvertimeIn && extendedOvertimeInTimestamp) {
    const end = freezeAt ? freezeAt : (currentTime || new Date())
    const activeResult = calculateTimeWorked(extendedOvertimeInTimestamp, end)
    totalMs += activeResult.hoursWorked * 60 * 60 * 1000
  }

  return totalMs / (1000 * 60 * 60) // Convert to hours
}

/**
 * Calculates today's displayed total duration for main dashboard (regular hours + approved overtime only)
 * Includes active regular session up to daily required hours, and only approved overtime logs.
 */
function getTodayDisplayTotalHours(
  logs: TimeLogDisplay[],
  isTimedIn: boolean,
  timeInTimestamp: Date | null,
  freezeAt?: Date,
  currentTime?: Date
) {
  const today = getTodayDateString()
  let regularMs = 0

  // Sum up completed regular logs for today (up to required hours)
  logs.forEach((log) => {
    if (
      log.time_in &&
      safeGetDateString(log.time_in) === today &&
      (log.log_type === "regular" || !log.log_type) &&
      log.time_out
    ) {
      const result = calculateTimeWorked(log.time_in, log.time_out)
      regularMs += result.hoursWorked * 60 * 60 * 1000
    }
  })

  // Add current active regular session if any (up to required hours)
  if (isTimedIn && timeInTimestamp) {
    const end = freezeAt ? freezeAt : (currentTime || new Date())
    const sessionMs = end.getTime() - timeInTimestamp.getTime()
    regularMs += sessionMs
  }

  // Cap regular hours at required hours for display
  const maxRegularMs = DAILY_REQUIRED_HOURS * 60 * 60 * 1000
  const cappedRegularMs = Math.min(regularMs, maxRegularMs)

  // Add only APPROVED overtime and extended overtime logs for today
  let approvedOvertimeMs = 0
  logs.forEach((log) => {
    if (
      log.time_in &&
      safeGetDateString(log.time_in) === today &&
      (log.log_type === "overtime" || log.log_type === "extended_overtime") &&
      log.time_out &&
      log.overtime_status === "approved"
    ) {
      const result = calculateTimeWorked(log.time_in, log.time_out)
      approvedOvertimeMs += result.hoursWorked * 60 * 60 * 1000
    }
  })

  // Return total in hours (float)
  return (cappedRegularMs + approvedOvertimeMs) / (1000 * 60 * 60)
}

export function InternDashboardContent() {
  const { user } = useAuth()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isTimedIn, setIsTimedIn] = useState(false)
  const [timeInTimestamp, setTimeInTimestamp] = useState<Date | null>(null)
  const [allLogs, setAllLogs] = useState<TimeLogDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stateReady, setStateReady] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [loadingAction, setLoadingAction] = useState<null | "timein" | "timeout">(null)
  const [isOvertimeIn, setIsOvertimeIn] = useState(false)
  const [overtimeInTimestamp, setOvertimeInTimestamp] = useState<Date | null>(null)
  const [isExtendedOvertimeIn, setIsExtendedOvertimeIn] = useState(false)
  const [extendedOvertimeInTimestamp, setExtendedOvertimeInTimestamp] = useState<Date | null>(null)
  const [freezeSessionAt, setFreezeSessionAt] = useState<Date | null>(null)
  const [overtimeConfirmationFreezeAt, setOvertimeConfirmationFreezeAt] = useState<Date | null>(null)
  const [autoTimeoutTriggered, setAutoTimeoutTriggered] = useState(false)
  const prevTodayHours = useRef(0)

  // Fetch logs function - moved before handlers that use it
  const fetchLogs = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/time-logs")
      if (!res.ok) throw new Error("Failed to fetch logs")
      const data = await res.json()
      const logsArr = (Array.isArray(data) ? data : data.logs || [])
        .map((log: Record<string, unknown>) => {
          if (log.time_in && log.time_out) {
            const result = calculateTimeWorked(log.time_in as string, log.time_out as string)
            return { ...log, hoursWorked: result.hoursWorked, duration: result.duration }
          }
          return { ...log, hoursWorked: 0, duration: null }
        })
        .sort((a: TimeLogDisplay, b: TimeLogDisplay) => {
          const aTime = a.time_in ? new Date(a.time_in).getTime() : 0
          const bTime = b.time_in ? new Date(b.time_in).getTime() : 0
          return bTime - aTime
        })
      setAllLogs(logsArr)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs")
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  // Button handlers
  const handleTimeIn = useCallback(async () => {
    if (actionLoading) return
    setActionLoading(true)
    setLoadingAction("timein")
    const now = new Date()
    
    // Calculate total hours worked today to determine if this will be an overtime session
    const totalHoursToday = getTodayTotalHours(allLogs, false, null, false, null, undefined, now)
    const willBeOvertime = totalHoursToday >= DAILY_REQUIRED_HOURS
    
    if (willBeOvertime) {
      // Set overtime state
      setIsOvertimeIn(true)
      setOvertimeInTimestamp(now)
    } else {
      // Set regular state
      setIsTimedIn(true)
      setTimeInTimestamp(now)
    }
    setAutoTimeoutTriggered(false)
    
    try {
      const res = await fetch("/api/time-logs/clock-in", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: getCurrentDateString() }),
      })
      if (!res.ok) throw new Error("Failed to clock in")
      await fetchLogs(false)
    } catch {
      // Revert state on error
      if (willBeOvertime) {
        setIsOvertimeIn(false)
        setOvertimeInTimestamp(null)
      } else {
        setIsTimedIn(false)
        setTimeInTimestamp(null)
      }
      alert("Failed to clock in. Please try again.")
    } finally {
      setActionLoading(false)
      setLoadingAction(null)
    }
  }, [actionLoading, fetchLogs, allLogs])

  // Fix handleTimeOut missing dependency
  const handleTimeOut = useCallback(async (cutoffTime?: Date, auto = false, freezeAt?: Date, discardOvertime = false, overtimeNote?: string) => {
    if (actionLoading) return
    setActionLoading(true)
    setLoadingAction("timeout")
    const today = getCurrentDateString()
    
    // Use cutoffTime if provided (for forgotten timeout scenario)
    const timeoutTime = cutoffTime || freezeAt
    
    // Calculate total hours worked today (including current session)
    let totalMs = 0
    allLogs.forEach((log) => {
      if (
        log.time_in &&
        getLocalDateString(log.time_in) === today &&
        (log.log_type === "regular" || !log.log_type) &&
        log.time_out
      ) {
        const inDate = new Date(log.time_in)
        const outDate = new Date(log.time_out)
        totalMs += outDate.getTime() - inDate.getTime()
      }
    })
    
    // Add current session if active (regular, overtime, or extended overtime)
    if (isTimedIn && timeInTimestamp) {
      const end = timeoutTime ? timeoutTime : new Date()
      totalMs += end.getTime() - timeInTimestamp.getTime()
    } else if (isOvertimeIn && overtimeInTimestamp) {
      const end = timeoutTime ? timeoutTime : new Date()
      totalMs += end.getTime() - overtimeInTimestamp.getTime()
    } else if (isExtendedOvertimeIn && extendedOvertimeInTimestamp) {
      const end = timeoutTime ? timeoutTime : new Date()
      totalMs += end.getTime() - extendedOvertimeInTimestamp.getTime()
    }
    const totalHoursToday = totalMs / (1000 * 60 * 60)

    if (!auto && totalHoursToday < DAILY_REQUIRED_HOURS && !isOvertimeIn && !isExtendedOvertimeIn) {
      const confirm = window.confirm(
        `You have only worked ${totalHoursToday.toFixed(2)} hours today. Cybersoft standard is ${DAILY_REQUIRED_HOURS} hours. Are you sure you want to time out?`
      )
      if (!confirm) {
        setActionLoading(false)
        setLoadingAction(null)
        return
      }
    }

    // Clear the appropriate state based on which session is active
    if (isTimedIn) {
      setIsTimedIn(false)
      setTimeInTimestamp(null)
    }
    if (isOvertimeIn) {
      setIsOvertimeIn(false)
      setOvertimeInTimestamp(null)
    }
    if (isExtendedOvertimeIn) {
      setIsExtendedOvertimeIn(false)
      setExtendedOvertimeInTimestamp(null)
    }

    try {
      const res = await fetch("/api/time-logs/clock-out", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          date: today, 
          time: timeoutTime ? timeoutTime.toISOString() : undefined,
          discardOvertime,
          overtimeNote 
        }),
      })
      if (!res.ok) throw new Error("Failed to clock out")
      await fetchLogs(false)
    } catch {
      // Revert state if failed
      if (isTimedIn) {
        setIsTimedIn(true)
        setTimeInTimestamp(timeInTimestamp)
      }
      if (isOvertimeIn) {
        setIsOvertimeIn(true)
        setOvertimeInTimestamp(overtimeInTimestamp)
      }
      setActionLoading(false)
      setLoadingAction(null)
      alert("Failed to clock out. Please try again.")
      return
    }
    setActionLoading(false)
    setLoadingAction(null)
  }, [actionLoading, allLogs, isTimedIn, timeInTimestamp, isOvertimeIn, overtimeInTimestamp, isExtendedOvertimeIn, extendedOvertimeInTimestamp, fetchLogs])

  // Overtime confirmation freeze handlers
  const handleOvertimeConfirmationShow = useCallback((freezeAt: Date) => {
    setOvertimeConfirmationFreezeAt(freezeAt)
  }, [])

  const handleOvertimeConfirmationHide = useCallback(() => {
    setOvertimeConfirmationFreezeAt(null)
  }, [])

  // Internship details from user context
  const internshipDetails = user?.internship

  /* Legacy function - replaced by calculateTodayProgressAccurate
  const parseDurationToHours = (duration: string) => {
    const match = duration.match(/(\d+)h\s+(\d+)m/)
    if (!match) return 0
    return parseInt(match[1], 10) + parseInt(match[2], 10) / 60
  }
  */

  // Calculate today's progress with high accuracy
  const todayProgress = calculateTodayProgressAccurate(
    allLogs,
    user?.id,
    isTimedIn,
    timeInTimestamp,
    isOvertimeIn,
    overtimeInTimestamp,
    isExtendedOvertimeIn,
    extendedOvertimeInTimestamp,
    overtimeConfirmationFreezeAt || currentTime
  )

  // Calculate total session hours for today (including active sessions), for use in Today's Progress duration
  const todaySessionTotalHours = getTodayTotalHours(
    allLogs,
    isTimedIn,
    timeInTimestamp,
    isOvertimeIn,
    overtimeInTimestamp,
    isExtendedOvertimeIn,
    extendedOvertimeInTimestamp,
    overtimeConfirmationFreezeAt || freezeSessionAt || undefined,
    overtimeConfirmationFreezeAt || currentTime
  )
  // Calculate total session minutes for today (including active sessions), for use in Today's Progress duration
  const requiredMinutes = Math.round(DAILY_REQUIRED_HOURS * 60)
  const workedMinutes = Math.floor(todaySessionTotalHours * 60)
  const todaySessionDisplayHours = Math.floor(workedMinutes / 60)
  const todaySessionDisplayMins = workedMinutes % 60
  const todaySessionFormattedDuration = formatDuration(
    todaySessionDisplayHours,
    todaySessionDisplayMins
  )

  // Calculate total display hours for today (regular + approved overtime only)
  const todayDisplayTotalHours = getTodayDisplayTotalHours(
    allLogs,
    isTimedIn,
    timeInTimestamp,
    overtimeConfirmationFreezeAt || freezeSessionAt || undefined,
    overtimeConfirmationFreezeAt || currentTime
  )
  const todayDisplayWorkedMinutes = Math.floor(todayDisplayTotalHours * 60)
  const todayDisplayHours = Math.floor(todayDisplayWorkedMinutes / 60)
  const todayDisplayMins = todayDisplayWorkedMinutes % 60
  const todayDisplayFormattedDuration = formatDuration(
    todayDisplayHours,
    todayDisplayMins
  )

  // Legacy calculations for compatibility (can be removed later)
  // const todayDuration = getTodayTotalDuration(allLogs, isTimedIn, timeInTimestamp, overtimeConfirmationFreezeAt || freezeSessionAt || undefined, currentTime)
  // const todayHours = parseDurationToHours(todayDuration)
  // const overtimeByStatus = getTodayOvertimeByStatus(allLogs, isTimedIn, timeInTimestamp, isOvertimeIn, overtimeInTimestamp, overtimeConfirmationFreezeAt || currentTime)

  // --- Effects ---

  // Restore clock-in state and fetch logs when user changes (including after login)
  useEffect(() => {
    if (!user || stateReady) return

    const restoreClockState = async () => {
      try {
        const res = await fetch("/api/time-logs")
        if (res.ok) {
          const data = await res.json()
          const logsArr = (Array.isArray(data) ? data : data.logs || [])
          setAllLogs(logsArr.map((log: Record<string, unknown>) => {
            if (log.time_in && log.time_out) {
              const result = calculateTimeWorked(log.time_in as string, log.time_out as string)
              return { ...log, hoursWorked: result.hoursWorked, duration: result.duration }
            }
            return { ...log, hoursWorked: 0, duration: null }
          }))

          // Find the latest active regular log (no time_out) FOR TODAY ONLY
          const todayStr = getTodayDateString()
          const activeLog = logsArr
            .filter((log: Record<string, unknown>) =>
              log.time_out === null &&
              log.time_in &&
              safeGetDateString(log.time_in as string) === todayStr &&
              (log.log_type === "regular" || !log.log_type)
            )
            .sort((a: Record<string, unknown>, b: Record<string, unknown>) => new Date(b.time_in as string).getTime() - new Date(a.time_in as string).getTime())[0]
          if (activeLog) {
            const timeInDate = new Date(activeLog.time_in as string)
            const now = new Date()
            const sessionDurationHours = (now.getTime() - timeInDate.getTime()) / (1000 * 60 * 60)
            
            // Safeguard: If session duration is unrealistic (more than 24 hours), don't restore timed-in state
            if (sessionDurationHours > 24) {
              console.warn(`Unrealistic session duration detected during restoration: ${sessionDurationHours.toFixed(2)}h. Not restoring timed-in state.`)
              setIsTimedIn(false)
              setTimeInTimestamp(null)
            } else {
              setIsTimedIn(true)
              setTimeInTimestamp(timeInDate)
            }
          } else {
            setIsTimedIn(false)
            setTimeInTimestamp(null)
          }

          // Find the latest active overtime log (no time_out) FOR TODAY ONLY
          const activeOvertimeLog = logsArr
            .filter((log: Record<string, unknown>) =>
              log.time_out === null &&
              log.time_in &&
              safeGetDateString(log.time_in as string) === todayStr &&
              log.log_type === "overtime"
            )
            .sort((a: Record<string, unknown>, b: Record<string, unknown>) => new Date(b.time_in as string).getTime() - new Date(a.time_in as string).getTime())[0]
          if (activeOvertimeLog) {
            setIsOvertimeIn(true)
            setOvertimeInTimestamp(new Date(activeOvertimeLog.time_in as string))
          } else {
            setIsOvertimeIn(false)
            setOvertimeInTimestamp(null)
          }

          // Find the latest active extended overtime log (no time_out) FOR TODAY ONLY
          const activeExtendedOvertimeLog = logsArr
            .filter((log: Record<string, unknown>) =>
              log.time_out === null &&
              log.time_in &&
              safeGetDateString(log.time_in as string) === todayStr &&
              log.log_type === "extended_overtime"
            )
            .sort((a: Record<string, unknown>, b: Record<string, unknown>) => new Date(b.time_in as string).getTime() - new Date(a.time_in as string).getTime())[0]
          if (activeExtendedOvertimeLog) {
            setIsExtendedOvertimeIn(true)
            setExtendedOvertimeInTimestamp(new Date(activeExtendedOvertimeLog.time_in as string))
          } else {
            setIsExtendedOvertimeIn(false)
            setExtendedOvertimeInTimestamp(null)
          }
        }
      } catch {
        // fallback: do nothing
      }
      setStateReady(true)
    }

    restoreClockState()
  }, [user, stateReady])

  // Always fetch logs when user and stateReady change
  useEffect(() => {
    if (user && stateReady) {
      fetchLogs(true)
    }
  }, [user, stateReady, fetchLogs])

  // Update current time every second
  useEffect(() => {
    setCurrentTime(new Date())
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto timeout effect - DISABLED to allow unlimited extended overtime
  useEffect(() => {
    // Auto-timeout is now disabled to support extended overtime without limits
    // Users must manually confirm overtime to end sessions
    return
    
    const maxAllowedHours = DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS
    // Use the same calculation method as the restoration logic
    const totalHoursWithOvertime = getTodayTotalHours(allLogs, isTimedIn, timeInTimestamp, isOvertimeIn, overtimeInTimestamp, isExtendedOvertimeIn, extendedOvertimeInTimestamp, undefined, currentTime)
    const justReachedMaximum =
      prevTodayHours.current < maxAllowedHours &&
      totalHoursWithOvertime >= maxAllowedHours &&
      (isTimedIn || isOvertimeIn) &&
      !actionLoading &&
      !freezeSessionAt

    if (justReachedMaximum) {
      console.log(`Auto-timeout triggered: ${totalHoursWithOvertime.toFixed(2)}h >= ${maxAllowedHours}h max`)
      const now = new Date()
      setFreezeSessionAt(now)
      setIsTimedIn(false)
      setIsOvertimeIn(false)
      setAutoTimeoutTriggered(true)
      setActionLoading(true)
      handleTimeOut(undefined, true, now).finally(() => {
        setActionLoading(false)
        setFreezeSessionAt(null)
      })
    }

    if (!isTimedIn && !isOvertimeIn && !freezeSessionAt && totalHoursWithOvertime < maxAllowedHours) {
      setAutoTimeoutTriggered(false)
    }

    prevTodayHours.current = totalHoursWithOvertime
  }, [allLogs, isTimedIn, isOvertimeIn, timeInTimestamp, overtimeInTimestamp, isExtendedOvertimeIn, extendedOvertimeInTimestamp, actionLoading, freezeSessionAt, handleTimeOut, currentTime])

  // Persist auto timeout state to localStorage with date
  useEffect(() => {
    const today = getCurrentDateString()
    const stateWithDate = { triggered: autoTimeoutTriggered, date: today }
    localStorage.setItem("autoTimeoutTriggered", JSON.stringify(stateWithDate))
  }, [autoTimeoutTriggered])

  // Restore auto timeout state on mount - DISABLED for extended overtime support  
  useEffect(() => {
    // Auto-timeout restoration is disabled to support extended overtime without limits
    // The system no longer enforces maximum working hours per day
    return
    
    // Wait for both state and logs to be ready, and for session state to be restored
    if (!stateReady || !allLogs.length) return
    
    // Add a small delay to ensure session restoration is complete
    const timeoutId = setTimeout(() => {
      const stored = localStorage.getItem("autoTimeoutTriggered")
      
      // Only restore auto-timeout if it was previously triggered AND it's the same date AND user is actively working
      if (stored) {
        try {
          const storedData = JSON.parse(stored)
          const today = getCurrentDateString()
          
          // Check if the stored auto-timeout is for today and was triggered
          if (storedData.triggered === true && storedData.date === today) {
            // Only restore auto-timeout if user is currently actively working (timed in or overtime in)
            if (isTimedIn || isOvertimeIn) {
              // Use total working hours calculation that accounts for database splitting
              const totalHours = getTodayTotalHours(allLogs, isTimedIn, timeInTimestamp, isOvertimeIn, overtimeInTimestamp)
              const maxAllowedHours = DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS
              
              if (totalHours >= maxAllowedHours) {
                console.log(`Restoring auto-timeout: user worked ${totalHours.toFixed(2)}h (>= ${maxAllowedHours}h max)`)
                setAutoTimeoutTriggered(true)
              } else {
                // User is actively working but no longer at max hours, clear the auto-timeout state
                console.log(`Clearing auto-timeout: user worked ${totalHours.toFixed(2)}h (< ${maxAllowedHours}h max)`)
                setAutoTimeoutTriggered(false)
                const clearedState = { triggered: false, date: today }
                localStorage.setItem("autoTimeoutTriggered", JSON.stringify(clearedState))
              }
            } else {
              // User is not actively working, clear the auto-timeout state
              console.log(`Clearing auto-timeout: user not actively working (isTimedIn: ${isTimedIn}, isOvertimeIn: ${isOvertimeIn})`)
              setAutoTimeoutTriggered(false)
              const clearedState = { triggered: false, date: today }
              localStorage.setItem("autoTimeoutTriggered", JSON.stringify(clearedState))
            }
          } else if (storedData.date !== today) {
            // Different date, clear the auto-timeout state
            console.log(`Clearing auto-timeout: different date (stored: ${storedData.date}, today: ${today})`)
            setAutoTimeoutTriggered(false)
            const clearedState = { triggered: false, date: today }
            localStorage.setItem("autoTimeoutTriggered", JSON.stringify(clearedState))
          }
        } catch {
          // Handle legacy format or corrupted data - only restore if actively working
          if (stored === "true" && (isTimedIn || isOvertimeIn)) {
            const totalHours = getTodayTotalHours(allLogs, isTimedIn, timeInTimestamp, isOvertimeIn, overtimeInTimestamp)
            const maxAllowedHours = DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS
            
            if (totalHours >= maxAllowedHours) {
              setAutoTimeoutTriggered(true)
            }
          } else {
            // Clear auto-timeout if not actively working or legacy format
            setAutoTimeoutTriggered(false)
          }
          // Update to new format
          const today = getCurrentDateString()
          const newState = { triggered: autoTimeoutTriggered, date: today }
          localStorage.setItem("autoTimeoutTriggered", JSON.stringify(newState))
        }
      }
    }, 100) // Small delay to ensure session state is restored
    
    return () => clearTimeout(timeoutId)
  }, [stateReady, allLogs, isTimedIn, isOvertimeIn, timeInTimestamp, autoTimeoutTriggered, overtimeInTimestamp])

  // Legacy auto-timeout check effect - DISABLED for extended overtime support
  useEffect(() => {
    // This effect is disabled to support extended overtime without automatic timeouts
    // Users must manually confirm overtime completion
    return
    
    if (!stateReady || autoTimeoutTriggered) return
    
    // Only check for auto-timeout if user is actively working (timed in or overtime in)
    if (isTimedIn || isOvertimeIn) {
      const totalHours = getTodayTotalHours(allLogs, isTimedIn, timeInTimestamp, isOvertimeIn, overtimeInTimestamp, isExtendedOvertimeIn, extendedOvertimeInTimestamp, undefined, currentTime)
      const maxAllowedHours = DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS
      
      if (totalHours >= maxAllowedHours) {
        setAutoTimeoutTriggered(true)
      }
    }
  }, [stateReady, allLogs, isTimedIn, isOvertimeIn, timeInTimestamp, overtimeInTimestamp, isExtendedOvertimeIn, extendedOvertimeInTimestamp, currentTime, autoTimeoutTriggered])

  // Clear auto-timeout state if user is not actively working 
  useEffect(() => {
    if (!stateReady) return
    
    // If user is not actively working, clear auto-timeout (regardless of total hours worked)
    if (!isTimedIn && !isOvertimeIn && !actionLoading && autoTimeoutTriggered) {
      setAutoTimeoutTriggered(false)
      const today = getCurrentDateString()
      const clearedState = { triggered: false, date: today }
      localStorage.setItem("autoTimeoutTriggered", JSON.stringify(clearedState))
    }
  }, [stateReady, isTimedIn, isOvertimeIn, actionLoading, autoTimeoutTriggered, overtimeInTimestamp])

  // --- Button Handlers ---

  // Utility formatting functions
  const formatters = useMemo(() => ({
    date: (date: Date) => date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric", 
      month: "long",
      day: "numeric",
    }),
    time: (date: Date) => date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit", 
      second: "2-digit",
    }),
  }), [])

  // Statistics calculations using centralized function
  const [timeStats, setTimeStats] = useState({
    internshipProgress: 0,
    totalHours: 0,
    regularHours: 0,
    overtimeHours: { approved: 0, pending: 0, rejected: 0, total: 0 },
    activeHours: 0,
    progressPercentage: 0,
    remainingHours: 0,
    isCompleted: false
  })

  // Update time statistics when logs or internship details change
  useEffect(() => {
    const updateStats = async () => {
      if (!allLogs.length || !internshipDetails) return
      
      const stats = await calculateTimeStatistics(allLogs, user?.id, {
        includeEditRequests: true,
        includeActive: true,
        currentTime: new Date(),
        requiredHours: internshipDetails.required_hours || 0
      })
      
      setTimeStats(stats)
    }
    
    updateStats()
  }, [allLogs, internshipDetails, user?.id])

  const completedHours = timeStats.internshipProgress
  const progressPercentage = timeStats.progressPercentage
  const remainingHours = timeStats.remainingHours

  const totalDaysWorked = useMemo(() => {
    const dates = new Set(
      allLogs
        .filter((log) => log.status === "completed" && log.time_in && log.time_out)
        .map((log) => log.time_in ? getLocalDateString(log.time_in) : undefined)
        .filter(Boolean)
    )
    return dates.size
  }, [allLogs])

  // Weekly calculations
  const { weeklyLogs, weeklyHours, weeklyDaysWorked } = useMemo(() => {
    const { monday: weekStart, sunday: weekEnd } = getWeekRange()
    
    // Filter logs for current week
    const weeklyLogs = allLogs.filter((log) => {
      if (!log.time_in) return false
      const logDate = new Date(log.time_in)
      return logDate >= weekStart && logDate <= weekEnd
    })

    // Calculate weekly hours - only include overtime when approved by admin
    const weeklyHours = weeklyLogs
      .filter((log) => log.status === "completed" && log.time_in && log.time_out)
      .reduce((sum, log) => {
        if (!log.time_in || !log.time_out) return sum
        
        // For overtime logs, only include if approved by admin
        if ((log.log_type === "overtime" || log.log_type === "extended_overtime") && log.overtime_status !== "approved") {
          return sum // Skip unapproved overtime
        }
        
        const result = calculateTimeWorked(log.time_in, log.time_out)
        return sum + result.hoursWorked
      }, 0)

    const weeklyDaysWorked = (() => {
      const dates = new Set(
        weeklyLogs
          .filter((log) => log.status === "completed" && log.time_in && log.time_out)
          .map((log) => log.time_in ? getLocalDateString(log.time_in) : undefined)
          .filter(Boolean)
      )
      return dates.size
    })()

    return { weeklyLogs, weeklyHours, weeklyDaysWorked }
  }, [allLogs])

  // --- Render ---
  if (!user || !internshipDetails) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="text-gray-500">Loading your dashboard...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Internship Progress Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Progress Card */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Internship Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Completed</span>
                <span className="font-medium">
                  {completedHours.toFixed(2)}h / {(internshipDetails?.required_hours ?? 0)}h
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{progressPercentage.toFixed(1)}%</div>
                {remainingHours > 0 && (
                  <p className="text-sm text-gray-600">
                    {truncateTo2Decimals(remainingHours)}h remaining
                  </p>
                )}
                <Badge variant="outline" className="mt-2">
                  {totalDaysWorked} days worked
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Internship Details Card */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building className="h-5 w-5" />
              Internship Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">University:</span>
                <p className="text-gray-600">{internshipDetails?.school?.name ?? "N/A"}</p>
              </div>
              <div>
                <span className="font-medium">Assigned Department:</span>
                <p className="text-gray-600">{internshipDetails?.department?.name ?? "N/A"}</p>
              </div>
              <div>
                <span className="font-medium">Duration:</span>
                <p className="text-gray-600">
                  {internshipDetails?.start_date
                    ? new Date(internshipDetails.start_date).toLocaleDateString()
                    : "N/A"}{" "}
                  -{" "}
                  {internshipDetails?.end_date
                    ? new Date(internshipDetails.end_date).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Weekly Progress Card */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{truncateTo2Decimals(weeklyHours)}h</div>
              <p className="text-sm text-gray-600 mt-1">Total this week</p>
              <Badge variant="outline" className="mt-2">
                {weeklyDaysWorked} days worked
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Time and Date */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center space-y-2 text-center">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              {formatters.date(currentTime)}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-600" />
              <span className="text-3xl font-mono font-bold text-gray-900">{formatters.time(currentTime)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time Tracking and Today's Progress Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Time Tracking Card */}
        <Card>
          <CardContent className="p-6">
            <TimeTracking
              isTimedIn={isTimedIn}
              timeInTimestamp={timeInTimestamp}
              actionLoading={actionLoading}
              loadingAction={loadingAction}
              freezeSessionAt={freezeSessionAt}
              autoTimeoutTriggered={autoTimeoutTriggered}
              handleTimeIn={handleTimeIn}
              handleTimeOut={handleTimeOut}
              onOvertimeConfirmationShow={handleOvertimeConfirmationShow}
              onOvertimeConfirmationHide={handleOvertimeConfirmationHide}
              isOvertimeSession={isOvertimeIn}
              isOvertimeIn={isOvertimeIn}
              overtimeInTimestamp={overtimeInTimestamp}
              isExtendedOvertimeIn={isExtendedOvertimeIn}
              extendedOvertimeInTimestamp={extendedOvertimeInTimestamp}
              todayTotalHours={todayProgress.regularHours + todayProgress.approvedOvertimeHours + todayProgress.pendingOvertimeHours}
              hasReachedDailyRequirement={todayProgress.regularHours >= DAILY_REQUIRED_HOURS}
              hasReachedOvertimeLimit={(todayProgress.regularHours + todayProgress.approvedOvertimeHours) >= (DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS)}
            />
          </CardContent>
        </Card>
        {/* Today's Progress Card */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Today&apos;s Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{todayDisplayFormattedDuration}</div>
              <p className="text-sm text-gray-600 mt-1">
                {todayDisplayWorkedMinutes > requiredMinutes ?
                  "Regular Hours + Approved Overtime" :
                  "Total Time Worked Today"
                }
              </p>
              {/* Session-based Overtime/Completion/Remaining Badges */}
              {(() => {
                const badges = []
                // Show completed badge if requirement met
                if (workedMinutes >= requiredMinutes && !isOvertimeIn && !isTimedIn) {
                  badges.push(
                    <Badge key="completed" variant="default" className="bg-green-100 text-green-800 border-green-200">
                      ✅ Daily requirement completed
                    </Badge>
                  )
                }
                // Show remaining badge if not yet met
                const remainingMinutes = Math.max(0, requiredMinutes - workedMinutes)
                const displayHours = Math.floor(remainingMinutes / 60)
                const displayMins = remainingMinutes % 60
                if (remainingMinutes > 0) {
                  badges.push(
                    <Badge key="remaining" variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                      ⏰ {formatDuration(displayHours, displayMins)} to Complete
                    </Badge>
                  )
                }
                // Show calculated overtime badge if session overtime
                if (workedMinutes > requiredMinutes) {
                  const overtimeMinutes = workedMinutes - requiredMinutes
                  const overtimeHours = Math.floor(overtimeMinutes / 60)
                  const overtimeMins = overtimeMinutes % 60
                  badges.push(
                    <Badge key="session-overtime" variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                      🔄 {formatDuration(overtimeHours, overtimeMins)} Session Overtime
                    </Badge>
                  )
                }
                return badges.length > 0 ? (
                  <div className="mt-3 flex flex-wrap justify-center gap-1">
                    {badges}
                  </div>
                ) : null
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Logs Table */}
      <ThisWeekLogs
        weeklyLogs={weeklyLogs}
        loading={loading}
        error={error}
        currentTime={currentTime}
        isTimedIn={isTimedIn}
        isOvertimeIn={isOvertimeIn}
        timeInTimestamp={timeInTimestamp}
        overtimeInTimestamp={overtimeInTimestamp}
        freezeAt={overtimeConfirmationFreezeAt}
      />
    </div>
  )
}
