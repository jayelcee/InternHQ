/**
 * InternDashboardContent
 *
 * Main dashboard component for interns. Displays:
 * - Internship progress and statistics
 * - Current time and date
 * - Time tracking controls (clock in/out, overtime)
 * - Today's progress (hours, overtime, badges)
 * - Weekly logs and summary
 *
 * Handles state restoration, log fetching, and session management.
 */

"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
  truncateToMinute,
  DAILY_REQUIRED_HOURS,
  MAX_OVERTIME_HOURS
} from "@/lib/time-utils"
import { TimeLogDisplay } from "@/lib/ui-utils"

/**
 * Helper: Get today's date string in DB format
 */
function getTodayDateString(): string {
  return getCurrentDateString()
}

/**
 * Helper: Safely get local date string from timestamp
 */
function safeGetDateString(dateStr: string): string {
  try {
    return getLocalDateString(dateStr)
  } catch {
    return ""
  }
}

/**
 * Get total hours worked today (regular + overtime + extended overtime, including active sessions)
 */
function getTodayTotalHours(
  logs: TimeLogDisplay[],
  isTimedIn: boolean,
  timeInTimestamp: Date | null,
  isOvertimeIn: boolean,
  overtimeInTimestamp: Date | null,
  isExtendedOvertimeIn?: boolean,
  extendedOvertimeInTimestamp?: Date | null,
  freezeAt?: Date,
  currentTime?: Date
) {
  const today = getTodayDateString()
  let totalMs = 0

  // Completed regular logs
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

  // Completed overtime/extended overtime logs
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

  // Active regular session
  if (isTimedIn && timeInTimestamp) {
    const end = freezeAt ? freezeAt : (currentTime || new Date())
    const activeResult = calculateTimeWorked(timeInTimestamp, end)
    totalMs += activeResult.hoursWorked * 60 * 60 * 1000
  }

  // Active overtime session
  if (isOvertimeIn && overtimeInTimestamp) {
    const end = freezeAt ? freezeAt : (currentTime || new Date())
    const sessionDurationHours = (end.getTime() - overtimeInTimestamp.getTime()) / (1000 * 60 * 60)
    if (sessionDurationHours >= 0) {
      const activeResult = calculateTimeWorked(overtimeInTimestamp, end)
      totalMs += activeResult.hoursWorked * 60 * 60 * 1000
    }
  }

  // Active extended overtime session
  if (isExtendedOvertimeIn && extendedOvertimeInTimestamp) {
    const end = freezeAt ? freezeAt : (currentTime || new Date())
    const sessionDurationHours = (end.getTime() - extendedOvertimeInTimestamp.getTime()) / (1000 * 60 * 60)
    if (sessionDurationHours >= 0) {
      const activeResult = calculateTimeWorked(extendedOvertimeInTimestamp, end)
      totalMs += activeResult.hoursWorked * 60 * 60 * 1000
    }
  }

  return totalMs / (1000 * 60 * 60) // hours
}

/**
 * Get today's display total hours (regular hours up to required + approved overtime only)
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

  // Completed regular logs (up to required hours)
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

  // Active regular session (up to required hours)
  if (isTimedIn && timeInTimestamp) {
    const end = freezeAt ? freezeAt : (currentTime || new Date())
    const sessionMs = end.getTime() - timeInTimestamp.getTime()
    regularMs += sessionMs
  }

  // Cap regular hours at required
  const maxRegularMs = DAILY_REQUIRED_HOURS * 60 * 60 * 1000
  const cappedRegularMs = Math.min(regularMs, maxRegularMs)

  // Approved overtime/extended overtime logs
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
  const [freezeSessionAt] = useState<Date | null>(null)
  const [overtimeConfirmationFreezeAt, setOvertimeConfirmationFreezeAt] = useState<Date | null>(null)
  const [autoTimeoutTriggered, setAutoTimeoutTriggered] = useState(false)

  // Fetch logs from API and process
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

  // Handle clock-in
  const handleTimeIn = useCallback(async () => {
    if (actionLoading) return
    setActionLoading(true)
    setLoadingAction("timein")
    const now = new Date()
    const truncatedNow = new Date(truncateToMinute(now))
    setCurrentTime(new Date(Math.max(now.getTime(), truncatedNow.getTime())))
    const totalHoursToday = getTodayTotalHours(allLogs, false, null, false, null, undefined, now)
    const willBeOvertime = totalHoursToday >= DAILY_REQUIRED_HOURS
    if (willBeOvertime) {
      setIsOvertimeIn(true)
      setOvertimeInTimestamp(truncatedNow)
    } else {
      setIsTimedIn(true)
      setTimeInTimestamp(truncatedNow)
    }
    setAutoTimeoutTriggered(false)
    try {
      const res = await fetch("/api/time-logs/clock-in", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: getCurrentDateString(),
          time: truncateToMinute(truncatedNow)
        }),
      })
      if (!res.ok) throw new Error("Failed to clock in")
      await fetchLogs(false)
    } catch {
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

  // Handle clock-out
  const handleTimeOut = useCallback(async (cutoffTime?: Date, auto = false, freezeAt?: Date, discardOvertime = false, overtimeNote?: string) => {
    if (actionLoading) return
    setActionLoading(true)
    setLoadingAction("timeout")
    const today = getCurrentDateString()
    let timeoutTime = cutoffTime || freezeAt || new Date()
    timeoutTime = new Date(timeoutTime)
    timeoutTime.setSeconds(0, 0)
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
          time: timeoutTime ? truncateToMinute(timeoutTime) : undefined,
          discardOvertime,
          overtimeNote
        }),
      })
      if (!res.ok) throw new Error("Failed to clock out")
      await fetchLogs(false)
    } catch {
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

  const internshipDetails = user?.internship

  // Calculate today's progress
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

  // Calculate total session hours for today
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
  const requiredMinutes = Math.round(DAILY_REQUIRED_HOURS * 60)
  const workedMinutes = Math.floor(todaySessionTotalHours * 60)

  // Calculate total display hours for today
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

  // Update time statistics
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

  // Calculate total days worked
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
    const weeklyLogs = allLogs.filter((log) => {
      if (!log.time_in) return false
      const logDate = new Date(log.time_in)
      return logDate >= weekStart && logDate <= weekEnd
    })
    const weeklyHours = weeklyLogs
      .filter((log) => log.status === "completed" && log.time_in && log.time_out)
      .reduce((sum, log) => {
        if (!log.time_in || !log.time_out) return sum
        if ((log.log_type === "overtime" || log.log_type === "extended_overtime") && log.overtime_status !== "approved") {
          return sum
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

  // Restore clock-in state and fetch logs when user changes
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
          // Restore active regular session
          const activeLog = logsArr
            .filter((log: Record<string, unknown>) =>
              log.time_out === null &&
              log.time_in &&
              (log.log_type === "regular" || !log.log_type)
            )
            .sort((a: Record<string, unknown>, b: Record<string, unknown>) => new Date(b.time_in as string).getTime() - new Date(a.time_in as string).getTime())[0]
          if (activeLog) {
            const timeInDate = new Date(activeLog.time_in as string)
            const now = new Date()
            const sessionDurationHours = (now.getTime() - timeInDate.getTime()) / (1000 * 60 * 60)
            if (sessionDurationHours <= 48) {
              setIsTimedIn(true)
              setTimeInTimestamp(timeInDate)
            } else {
              setIsTimedIn(false)
              setTimeInTimestamp(null)
            }
          } else {
            setIsTimedIn(false)
            setTimeInTimestamp(null)
          }
          // Restore active overtime/extended overtime session
          const activeOvertimeLog = logsArr
            .filter((log: Record<string, unknown>) =>
              log.time_out === null &&
              log.time_in &&
              (log.log_type === "overtime" || log.log_type === "extended_overtime")
            )
            .sort((a: Record<string, unknown>, b: Record<string, unknown>) => new Date(b.time_in as string).getTime() - new Date(a.time_in as string).getTime())[0]
          if (activeOvertimeLog) {
            setIsOvertimeIn(true)
            setOvertimeInTimestamp(new Date(activeOvertimeLog.time_in as string))
            if (activeOvertimeLog.log_type === "extended_overtime") {
              setIsExtendedOvertimeIn(true)
              setExtendedOvertimeInTimestamp(new Date(activeOvertimeLog.time_in as string))
            } else {
              setIsExtendedOvertimeIn(false)
              setExtendedOvertimeInTimestamp(null)
            }
          } else {
            setIsOvertimeIn(false)
            setOvertimeInTimestamp(null)
            setIsExtendedOvertimeIn(false)
            setExtendedOvertimeInTimestamp(null)
          }
        }
      } catch {}
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

  // Persist auto timeout state to localStorage with date
  useEffect(() => {
    const today = getCurrentDateString()
    const stateWithDate = { triggered: autoTimeoutTriggered, date: today }
    localStorage.setItem("autoTimeoutTriggered", JSON.stringify(stateWithDate))
  }, [autoTimeoutTriggered])

  // Clear auto-timeout state if user is not actively working
  useEffect(() => {
    if (!stateReady) return
    if (!isTimedIn && !isOvertimeIn && !actionLoading && autoTimeoutTriggered) {
      setAutoTimeoutTriggered(false)
      const today = getCurrentDateString()
      const clearedState = { triggered: false, date: today }
      localStorage.setItem("autoTimeoutTriggered", JSON.stringify(clearedState))
    }
  }, [stateReady, isTimedIn, isOvertimeIn, actionLoading, autoTimeoutTriggered, overtimeInTimestamp])

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
                if (workedMinutes == requiredMinutes && !isOvertimeIn && !isTimedIn) {
                  badges.push(
                    <Badge key="completed" variant="default" className="bg-green-100 text-green-800 border-green-200">
                      ✅ Daily requirement completed
                    </Badge>
                  )
                }
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
                // Combined real-time pending overtime badge
                const todayStr = getTodayDateString()
                let combinedPendingMs = 0
                allLogs.forEach((log) => {
                  if (
                    log.time_in &&
                    safeGetDateString(log.time_in) === todayStr &&
                    (log.log_type === "overtime" || log.log_type === "extended_overtime") &&
                    log.time_out &&
                    (!log.overtime_status || log.overtime_status === "pending")
                  ) {
                    const result = calculateTimeWorked(log.time_in, log.time_out)
                    combinedPendingMs += result.hoursWorked * 60 * 60 * 1000
                  }
                })
                if (isOvertimeIn && overtimeInTimestamp) {
                  const end = overtimeConfirmationFreezeAt || currentTime
                  const ms = end.getTime() - overtimeInTimestamp.getTime()
                  if (ms > 0) combinedPendingMs += ms
                } else if (isExtendedOvertimeIn && extendedOvertimeInTimestamp) {
                  const end = overtimeConfirmationFreezeAt || currentTime
                  const ms = end.getTime() - extendedOvertimeInTimestamp.getTime()
                  if (ms > 0) combinedPendingMs += ms
                }
                if (
                  isTimedIn && timeInTimestamp &&
                  !isOvertimeIn && !isExtendedOvertimeIn
                ) {
                  const end = overtimeConfirmationFreezeAt || currentTime
                  const ms = end.getTime() - timeInTimestamp.getTime()
                  let totalMs = 0
                  allLogs.forEach((log) => {
                    if (
                      log.time_in &&
                      safeGetDateString(log.time_in) === todayStr &&
                      (log.log_type === "regular" || !log.log_type) &&
                      log.time_out
                    ) {
                      const result = calculateTimeWorked(log.time_in, log.time_out)
                      totalMs += result.hoursWorked * 60 * 60 * 1000
                    }
                  })
                  totalMs += ms
                  const requiredMs = DAILY_REQUIRED_HOURS * 60 * 60 * 1000
                  if (totalMs > requiredMs) {
                    const overtimeMs = totalMs - requiredMs
                    combinedPendingMs += overtimeMs
                  }
                }
                if (combinedPendingMs > 0) {
                  const mins = Math.floor(combinedPendingMs / (1000 * 60))
                  const h = Math.floor(mins / 60)
                  const m = mins % 60
                  badges.push(
                    <Badge key="pending-overtime-combined" variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                      ⏳ {formatDuration(h, m)} Pending Overtime
                    </Badge>
                  )
                }
                // Overtime status badges
                let approvedMs = 0, rejectedMs = 0
                allLogs.forEach((log) => {
                  if (
                    log.time_in &&
                    safeGetDateString(log.time_in) === todayStr &&
                    (log.log_type === "overtime" || log.log_type === "extended_overtime") &&
                    log.time_out
                  ) {
                    const result = calculateTimeWorked(log.time_in, log.time_out)
                    const ms = result.hoursWorked * 60 * 60 * 1000
                    if (log.overtime_status === "approved") approvedMs += ms
                    else if (log.overtime_status === "rejected") rejectedMs += ms
                  }
                })
                const statusBadges = [
                  {
                    key: "approved-overtime",
                    ms: approvedMs,
                    label: "Approved Overtime",
                    icon: "✔️",
                    className: "bg-purple-100 text-purple-800 border-purple-200"
                  },
                  {
                    key: "rejected-overtime",
                    ms: rejectedMs,
                    label: "Rejected Overtime",
                    icon: "❌",
                    className: "bg-gray-100 text-gray-800 border-gray-200"
                  }
                ]
                statusBadges.forEach(({ key, ms, label, icon, className }) => {
                  if (ms > 0) {
                    const mins = Math.floor(ms / (1000 * 60))
                    const h = Math.floor(mins / 60)
                    const m = mins % 60
                    badges.push(
                      <Badge key={key} variant="secondary" className={className}>
                        {icon} {formatDuration(h, m)} {label}
                      </Badge>
                    )
                  }
                })
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
