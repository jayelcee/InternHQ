"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Clock, Calendar, GraduationCap, Building, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useAuth } from "@/contexts/auth-context"
import { RegularTimeTracking } from "@/components/regular-time-tracking"
import { OvertimeTracking } from "@/components/overtime-tracking"
import { ThisWeekLogs } from "@/components/this-week-logs"
import { 
  calculateTimeWorked, 
  truncateTo2Decimals, 
  getLocalDateString, 
  getCurrentDateString, 
  getWeekRange,
  formatDuration,
  calculateInternshipProgress
} from "@/lib/time-utils"
import { 
  TimeLogDisplay
} from "@/lib/ui-utils"

const REQUIRED_HOURS_PER_DAY = 9

/**
 * Calculates duration and hours for a time log entry using centralized calculation
 */
function getLogDuration(log: TimeLogDisplay) {
  if (log.time_in && log.time_out) {
    const result = calculateTimeWorked(log.time_in, log.time_out)
    return {
      duration: result.duration,
      decimal: result.decimal
    }
  }
  return null
}

/**
 * Calculates today's total duration for regular logs only
 */
function getTodayTotalDuration(logs: TimeLogDisplay[], isTimedIn: boolean, timeInTimestamp: Date | null, freezeAt?: Date, currentTime?: Date) {
  const today = getLocalDateString(new Date().toISOString())
  let totalMs = 0

  // Sum up completed logs for today
  logs.forEach((log) => {
    if (
      log.time_in &&
      getLocalDateString(log.time_in) === today &&
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
    const activeResult = calculateTimeWorked(timeInTimestamp, end)
    totalMs += activeResult.hoursWorked * 60 * 60 * 1000
  }

  // Convert total back to duration format
  const totalMinutes = Math.floor(totalMs / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return formatDuration(hours, minutes)
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
  const [loadingAction, setLoadingAction] = useState<null | "timein" | "timeout" | "overtimein" | "overtimeout">(null)
  const [isOvertimeIn, setIsOvertimeIn] = useState(false)
  const [overtimeInTimestamp, setOvertimeInTimestamp] = useState<Date | null>(null)
  const [freezeSessionAt, setFreezeSessionAt] = useState<Date | null>(null)
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
    setIsTimedIn(true)
    setTimeInTimestamp(now)
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
      setIsTimedIn(false)
      setTimeInTimestamp(null)
      alert("Failed to clock in. Please try again.")
    } finally {
      setActionLoading(false)
      setLoadingAction(null)
    }
  }, [actionLoading, fetchLogs])

  // Fix handleTimeOut missing dependency
  const handleTimeOut = useCallback(async (auto = false, freezeAt?: Date) => {
    if (actionLoading) return
    setActionLoading(true)
    setLoadingAction("timeout")
    const today = getCurrentDateString()
    
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
    
    // Add current session if active
    if (isTimedIn && timeInTimestamp) {
      const end = freezeAt ? freezeAt : new Date()
      totalMs += end.getTime() - timeInTimestamp.getTime()
    }
    const totalHoursToday = totalMs / (1000 * 60 * 60)

    if (!auto && totalHoursToday < REQUIRED_HOURS_PER_DAY) {
      const confirm = window.confirm(
        `You have only worked ${totalHoursToday.toFixed(2)} hours today. Cybersoft standard is ${REQUIRED_HOURS_PER_DAY} hours. Are you sure you want to time out?`
      )
      if (!confirm) {
        setActionLoading(false)
        setLoadingAction(null)
        return
      }
    }

    setIsTimedIn(false)
    setTimeInTimestamp(null)

    try {
      const res = await fetch("/api/time-logs/clock-out", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, time: freezeAt ? freezeAt.toISOString() : undefined }),
      })
      if (!res.ok) throw new Error("Failed to clock out")
      await fetchLogs(false)
    } catch {
      // Revert state if failed
      setIsTimedIn(true)
      setTimeInTimestamp(timeInTimestamp)
      setActionLoading(false)
      setLoadingAction(null)
      alert("Failed to clock out. Please try again.")
      return
    }
    setActionLoading(false)
    setLoadingAction(null)
  }, [actionLoading, allLogs, isTimedIn, timeInTimestamp, fetchLogs])

  // Internship details from user context
  const internshipDetails = user?.internship

  /**
   * Parse duration string to hours for calculations
   */
  const parseDurationToHours = (duration: string) => {
    const match = duration.match(/(\d+)h\s+(\d+)m/)
    if (!match) return 0
    return parseInt(match[1], 10) + parseInt(match[2], 10) / 60
  }

  // Calculate today's duration, freeze at auto timeout if needed
  const todayDuration = getTodayTotalDuration(allLogs, isTimedIn, timeInTimestamp, freezeSessionAt || undefined, currentTime)
  const todayHours = parseDurationToHours(todayDuration)

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
          const todayStr = getLocalDateString(new Date().toISOString())
          const activeLog = logsArr
            .filter((log: Record<string, unknown>) =>
              log.time_out === null &&
              log.time_in &&
              getLocalDateString(log.time_in as string) === todayStr &&
              (log.log_type === "regular" || !log.log_type)
            )
            .sort((a: Record<string, unknown>, b: Record<string, unknown>) => new Date(b.time_in as string).getTime() - new Date(a.time_in as string).getTime())[0]
          if (activeLog) {
            setIsTimedIn(true)
            setTimeInTimestamp(new Date(activeLog.time_in as string))
          } else {
            setIsTimedIn(false)
            setTimeInTimestamp(null)
          }

          // Find the latest active overtime log (no time_out) FOR TODAY ONLY
          const activeOvertimeLog = logsArr
            .filter((log: Record<string, unknown>) =>
              log.time_out === null &&
              log.time_in &&
              getLocalDateString(log.time_in as string) === todayStr &&
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

  // Auto timeout effect - triggers when reaching required hours
  useEffect(() => {
    const justReachedRequired =
      prevTodayHours.current < REQUIRED_HOURS_PER_DAY &&
      todayHours >= REQUIRED_HOURS_PER_DAY &&
      isTimedIn &&
      !actionLoading &&
      !freezeSessionAt

    if (justReachedRequired) {
      const now = new Date()
      setFreezeSessionAt(now)
      setIsTimedIn(false)
      setAutoTimeoutTriggered(true)
      setActionLoading(true)
      handleTimeOut(true, now).finally(() => {
        setActionLoading(false)
        setFreezeSessionAt(null)
      })
    }

    if (!isTimedIn && !freezeSessionAt && todayHours < REQUIRED_HOURS_PER_DAY) {
      setAutoTimeoutTriggered(false)
    }

    prevTodayHours.current = todayHours
  }, [todayHours, isTimedIn, actionLoading, freezeSessionAt, handleTimeOut])

  // Persist auto timeout state to localStorage
  useEffect(() => {
    localStorage.setItem("autoTimeoutTriggered", JSON.stringify(autoTimeoutTriggered))
  }, [autoTimeoutTriggered])

  // Restore auto timeout state on mount
  useEffect(() => {
    if (!stateReady) return
    const stored = localStorage.getItem("autoTimeoutTriggered")
    const todayDuration = getTodayTotalDuration(allLogs, false, null)
    const todayHours = parseDurationToHours(todayDuration)
    
    if (stored === "true" && todayHours >= REQUIRED_HOURS_PER_DAY) {
      setAutoTimeoutTriggered(true)
    }
  }, [stateReady, allLogs])

  // Set auto timeout if already reached required hours
  useEffect(() => {
    if (!stateReady) return
    const todayDuration = getTodayTotalDuration(allLogs, false, null)
    const todayHours = parseDurationToHours(todayDuration)
    
    if (todayHours >= REQUIRED_HOURS_PER_DAY) {
      setAutoTimeoutTriggered(true)
    }
  }, [stateReady, allLogs])

  // --- Button Handlers ---

  const handleOvertimeIn = useCallback(async () => {
    if (actionLoading) return
    setActionLoading(true)
    setLoadingAction("overtimein")
    const now = new Date()
    setIsOvertimeIn(true)
    setOvertimeInTimestamp(now)
    
    try {
      const res = await fetch("/api/time-logs/clock-in", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: getCurrentDateString(), logType: "overtime" }),
      })
      if (!res.ok) throw new Error("Failed to clock in for overtime")
      await fetchLogs(false)
    } catch {
      setIsOvertimeIn(false)
      setOvertimeInTimestamp(null)
      alert("Failed to clock in for overtime. Please try again.")
    } finally {
      setActionLoading(false)
      setLoadingAction(null)
    }
  }, [actionLoading, fetchLogs])

  const handleOvertimeOut = useCallback(async () => {
    if (actionLoading) return
    setActionLoading(true)
    setLoadingAction("overtimeout")
    
    // Update state immediately for responsive UI
    setIsOvertimeIn(false)
    setOvertimeInTimestamp(null)
    
    try {
      const res = await fetch("/api/time-logs/clock-out", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: getCurrentDateString(), logType: "overtime" }),
      })
      if (!res.ok) throw new Error("Failed to clock out for overtime")
      await fetchLogs(false)
    } catch {
      // Revert state if failed
      setIsOvertimeIn(true)
      setOvertimeInTimestamp(overtimeInTimestamp)
      alert("Failed to clock out for overtime. Please try again.")
    } finally {
      setActionLoading(false)
      setLoadingAction(null)
    }
  }, [actionLoading, fetchLogs, overtimeInTimestamp])

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

  // Statistics calculations
  const completedHours = useMemo(() => {
    // Use centralized calculation for consistent progress tracking
    return calculateInternshipProgress(allLogs)
  }, [allLogs])

  const progressPercentage = useMemo(() => 
    internshipDetails?.required_hours && internshipDetails.required_hours > 0
      ? Math.min((completedHours / internshipDetails.required_hours) * 100, 100)
      : 0
  , [completedHours, internshipDetails])

  const remainingHours = useMemo(() =>
    internshipDetails?.required_hours && completedHours >= internshipDetails.required_hours
      ? 0
      : Number(truncateTo2Decimals((internshipDetails?.required_hours || 0) - completedHours))
  , [completedHours, internshipDetails])

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

    // Calculate weekly hours and days worked
    const weeklyHours = weeklyLogs
      .filter((log) => log.status === "completed" && log.time_in && log.time_out)
      .reduce((sum, log) => {
        const dur = getLogDuration(log)
        return sum + (dur ? Number(dur.decimal) : 0)
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
              <div className="text-2xl font-bold text-green-600">{weeklyHours.toFixed(2)}h</div>
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

      {/* Time In/Out Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Time Tracking Card */}
        <Card>
          <CardContent className="p-6">
            <RegularTimeTracking
              isTimedIn={isTimedIn}
              timeInTimestamp={timeInTimestamp}
              actionLoading={actionLoading}
              loadingAction={loadingAction}
              freezeSessionAt={freezeSessionAt}
              autoTimeoutTriggered={autoTimeoutTriggered}
              handleTimeIn={handleTimeIn}
              handleTimeOut={handleTimeOut}
            />
          </CardContent>
        </Card>
        {/* Overtime Time In/Out Card */}
        <Card>
          <CardContent className="p-6">
            <OvertimeTracking
              isOvertimeIn={isOvertimeIn}
              overtimeInTimestamp={overtimeInTimestamp}
              actionLoading={actionLoading}
              loadingAction={loadingAction}
              freezeSessionAt={freezeSessionAt}
              autoTimeoutTriggered={autoTimeoutTriggered}
              handleOvertimeIn={handleOvertimeIn}
              handleOvertimeOut={handleOvertimeOut}
            />
          </CardContent>
        </Card>
      </div>

      {/* Weekly Logs Table */}
      <ThisWeekLogs
        weeklyLogs={weeklyLogs}
        loading={loading}
        error={error}
        currentTime={currentTime}
      />
    </div>
  )
}
