"use client"

import { useState, useEffect, useRef } from "react"
import { Clock, Calendar, Timer, GraduationCap, Building, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useAuth } from "@/contexts/auth-context"

/**
 * TimeLog interface for a single time log entry.
 */
interface TimeLog {
  id: number
  time_in: string | null
  time_out: string | null
  notes?: string
  status: "pending" | "completed"
  hoursWorked: number
  duration: string | null
  log_type?: "regular" | "overtime"
}

const REQUIRED_HOURS_PER_DAY = 9

function getWeekRange(date = new Date()) {
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

function getTodayString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function truncateTo2Decimals(val: number) {
  const [int, dec = ""] = val.toString().split(".")
  return dec.length > 0 ? `${int}.${dec.slice(0, 2).padEnd(2, "0")}` : `${int}.00`
}

function formatDuration(hours: number, minutes: number) {
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`
}

function getLocalDateString(dateStr: string) {
  const d = new Date(dateStr)
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0")
}

// Update groupLogsByDate to use local date
function groupLogsByDate(logs: TimeLog[]) {
  const map = new Map<string, TimeLog[]>()
  logs.forEach(log => {
    const dateKey = log.time_in ? getLocalDateString(log.time_in) : undefined
    if (!dateKey) return
    if (!map.has(dateKey)) map.set(dateKey, [])
    map.get(dateKey)!.push(log)
  })
  map.forEach(arr => arr.sort((a, b) =>
    new Date(a.time_in!).getTime() - new Date(b.time_in!).getTime()
  ))
  return Array.from(map.entries()).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
}

// Accurate duration and hours calculation
function getLogDuration(log: TimeLog) {
  if (log.time_in && log.time_out) {
    const inDate = new Date(log.time_in)
    const outDate = new Date(log.time_out)
    const diffMs = outDate.getTime() - inDate.getTime()
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    const decimal = diffMs / (1000 * 60 * 60)
    return {
      duration: formatDuration(hours, minutes),
      decimal: truncateTo2Decimals(decimal),
    }
  }
  return null
}

// --- Accurate today's duration (for regular logs only) ---
function getTodayTotalDuration(logs: TimeLog[], isTimedIn: boolean, timeInTimestamp: Date | null, freezeAt?: Date) {
  const today = getLocalDateString(new Date().toISOString())
  let totalMs = 0

  logs.forEach((log) => {
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

  // Add current active session if any (for regular only)
  if (isTimedIn && timeInTimestamp) {
    const end = freezeAt ? freezeAt : new Date()
    totalMs += end.getTime() - timeInTimestamp.getTime()
  }

  const hours = Math.floor(totalMs / (1000 * 60 * 60))
  const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60))
  return formatDuration(hours, minutes)
}

export function InternDashboardContent() {
  const { user } = useAuth()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isTimedIn, setIsTimedIn] = useState(false)
  const [timeInTimestamp, setTimeInTimestamp] = useState<Date | null>(null)
  const [allLogs, setAllLogs] = useState<TimeLog[]>([])
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

  // Internship details from user context
  const internshipDetails = user?.internship

  // --- Duration Calculation ---
  function parseDurationToHours(duration: string) {
    const match = duration.match(/(\d+)h\s+(\d+)m/)
    if (!match) return 0
    const hours = parseInt(match[1], 10)
    const minutes = parseInt(match[2], 10)
    return hours + minutes / 60
  }

  // Calculate today's duration, freeze at auto timeout if needed
  const todayDuration = getTodayTotalDuration(allLogs, isTimedIn, timeInTimestamp, freezeSessionAt || undefined)
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
            let hoursWorked = 0
            let duration = null
            if (log.time_in && log.time_out) {
              const inDate = new Date(log.time_in as string)
              const outDate = new Date(log.time_out as string)
              const diffMs = outDate.getTime() - inDate.getTime()
              hoursWorked = diffMs > 0 ? Number(truncateTo2Decimals(diffMs / (1000 * 60 * 60))) : 0
              const hours = Math.floor(diffMs / (1000 * 60 * 60))
              const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
              duration = formatDuration(hours, minutes)
            }
            return { ...log, hoursWorked, duration }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, stateReady])

  // Always fetch logs when user and stateReady change
  useEffect(() => {
    if (user && stateReady) {
      fetchLogs(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, stateReady])

  // Real-time tick for durations (only if not frozen)
  useEffect(() => {
    if (freezeSessionAt) return
    const interval = setInterval(() => {}, 1000)
    return () => clearInterval(interval)
  }, [freezeSessionAt])

  // Fetch logs after clock-in/out
  const fetchLogs = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/time-logs")
      if (!res.ok) throw new Error("Failed to fetch logs")
      const data = await res.json()
      const logsArr = (Array.isArray(data) ? data : data.logs || [])
        .map((log: Record<string, unknown>) => {
          let hoursWorked = 0
          let duration = null
          if (log.time_in && log.time_out) {
            const inDate = new Date(log.time_in as string)
            const outDate = new Date(log.time_out as string)
            const diffMs = outDate.getTime() - inDate.getTime()
            hoursWorked = diffMs > 0 ? Number(truncateTo2Decimals(diffMs / (1000 * 60 * 60))) : 0
            const hours = Math.floor(diffMs / (1000 * 60 * 60))
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
            duration = formatDuration(hours, minutes)
          }
          return { ...log, hoursWorked, duration }
        })
        .sort((a: TimeLog, b: TimeLog) => {
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
  }

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // --- AUTO TIME OUT REGULAR WHEN REACHING REQUIRED HOURS (only at the exact moment) ---
  useEffect(() => {
    const justReachedRequired =
      prevTodayHours.current < REQUIRED_HOURS_PER_DAY &&
      todayHours >= REQUIRED_HOURS_PER_DAY &&
      isTimedIn &&
      !actionLoading &&
      !freezeSessionAt

    if (justReachedRequired) {
      // Freeze session at this exact moment
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

    // Reset autoTimeoutTriggered if user clocks in again (new day, etc.)
    if (!isTimedIn && !freezeSessionAt && todayHours < REQUIRED_HOURS_PER_DAY) {
      setAutoTimeoutTriggered(false)
    }

    prevTodayHours.current = todayHours
  }, [todayHours, isTimedIn, actionLoading, freezeSessionAt])

  // 1. Persist autoTimeoutTriggered to localStorage
  useEffect(() => {
    localStorage.setItem("autoTimeoutTriggered", JSON.stringify(autoTimeoutTriggered))
  }, [autoTimeoutTriggered])

  // 2. Restore autoTimeoutTriggered from localStorage on mount (and after logs are loaded)
  useEffect(() => {
    if (!stateReady) return
    const stored = localStorage.getItem("autoTimeoutTriggered")
    // Only restore if logs show todayHours >= REQUIRED_HOURS_PER_DAY
    const todayDuration = getTodayTotalDuration(allLogs, false, null)
    const match = todayDuration.match(/(\d+)h\s+(\d+)m/)
    let todayHours = 0
    if (match) {
      todayHours = parseInt(match[1], 10) + parseInt(match[2], 10) / 60
    }
    if (stored === "true" && todayHours >= REQUIRED_HOURS_PER_DAY) {
      setAutoTimeoutTriggered(true)
    }
  }, [stateReady, allLogs])

  // 3. In your restoreClockState (after fetching logs), check if todayHours >= REQUIRED_HOURS_PER_DAY
  useEffect(() => {
    if (!stateReady) return
    // Only run after logs are loaded
    const todayDuration = getTodayTotalDuration(allLogs, false, null)
    const todayHours = (() => {
      const match = todayDuration.match(/(\d+)h\s+(\d+)m/)
      if (!match) return 0
      const hours = parseInt(match[1], 10)
      const minutes = parseInt(match[2], 10)
      return hours + minutes / 60
    })()
    if (todayHours >= REQUIRED_HOURS_PER_DAY) {
      setAutoTimeoutTriggered(true)
    }
  }, [stateReady, allLogs])

  // --- Button Handlers ---

  const handleTimeIn = async () => {
    if (actionLoading) return
    setActionLoading(true)
    setLoadingAction("timein")
    const now = new Date()
    setIsTimedIn(true)
    setTimeInTimestamp(now)
    setAutoTimeoutTriggered(false) // <-- Reset here ONLY
    try {
      const res = await fetch("/api/time-logs/clock-in", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: getTodayString() }),
      })
      if (!res.ok) throw new Error("Failed to clock in")
      await fetchLogs(false)
    } catch {
      setIsTimedIn(false)
      setTimeInTimestamp(null)
      setActionLoading(false)
      setLoadingAction(null)
      alert("Failed to clock in. Please try again.")
      return
    }
    setActionLoading(false)
    setLoadingAction(null)
  }

  // Accepts an optional auto flag and freezeAt to skip confirm dialog and use exact time
  const handleTimeOut = async (auto = false, freezeAt?: Date) => {
    if (actionLoading) return
    setActionLoading(true)
    setLoadingAction("timeout")
    const today = getTodayString()
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
  }

  const handleOvertimeIn = async () => {
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
        body: JSON.stringify({ date: getTodayString(), logType: "overtime" }),
      })
      if (!res.ok) throw new Error("Failed to clock in for overtime")
      await fetchLogs(false)
    } catch {
      setIsOvertimeIn(false)
      setOvertimeInTimestamp(null)
      setActionLoading(false)
      setLoadingAction(null)
      alert("Failed to clock in for overtime. Please try again.")
      return
    }
    setActionLoading(false)
    setLoadingAction(null)
  }

  const handleOvertimeOut = async () => {
    if (actionLoading) return
    setActionLoading(true)
    setLoadingAction("overtimeout")
    try {
      const res = await fetch("/api/time-logs/clock-out", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: getTodayString(), logType: "overtime" }),
      })
      if (!res.ok) throw new Error("Failed to clock out for overtime")
      await fetchLogs(false)
    } catch {
      setIsOvertimeIn(true)
      setOvertimeInTimestamp(overtimeInTimestamp)
      setActionLoading(false)
      setLoadingAction(null)
      alert("Failed to clock out for overtime. Please try again.")
      return
    }
    setIsOvertimeIn(false)
    setOvertimeInTimestamp(null)
    setActionLoading(false)
    setLoadingAction(null)
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const formatLogDate = (dateString: string) => {
    const date = new Date(dateString)
    return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}-${date.getFullYear()}`
  }

  // Calculate completed hours (sum of all completed logs)
  const completedHours = (() => {
    const total = allLogs
      .filter((log) => log.status === "completed" && log.time_in && log.time_out)
      .reduce((sum, log) => {
        const dur = getLogDuration(log)
        return sum + (dur ? Number(dur.decimal) : 0)
      }, 0)
    return Number(truncateTo2Decimals(total))
  })()

  const progressPercentage =
    internshipDetails && typeof internshipDetails.required_hours === "number" && internshipDetails.required_hours > 0
      ? Math.min((completedHours / internshipDetails.required_hours) * 100, 100)
      : 0

  const remainingHours =
    internshipDetails?.required_hours && completedHours >= internshipDetails.required_hours
      ? 0
      : Number(truncateTo2Decimals((internshipDetails?.required_hours || 0) - completedHours))

  const totalDaysWorked = (() => {
    const dates = new Set(
      allLogs
        .filter((log) => log.status === "completed" && log.time_in && log.time_out)
        .map((log) => log.time_in ? getLocalDateString(log.time_in) : undefined)
        .filter(Boolean)
    )
    return dates.size
  })()

  // Get current week range (Monday to Sunday)
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
              {formatDate(currentTime)}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-600" />
              <span className="text-3xl font-mono font-bold text-gray-900">{formatTime(currentTime)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time In/Out Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Time Tracking Card */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">Time Tracking</h3>
                <p className="text-sm text-gray-600">
                  {autoTimeoutTriggered
                    ? "You're done for the day."
                    : isTimedIn
                      ? "You're currently clocked in."
                      : "Ready to start your shift?"}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                {/* Always show badge depending on state */}
                <div className="text-center">
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {autoTimeoutTriggered
                      ? "Regular Hours Met"
                      : isTimedIn
                        ? timeInTimestamp
                          ? `Clocked in at ${timeInTimestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                          : "Clocked in"
                        : "Log Regular Shift"}
                  </Badge>
                </div>
                {!isTimedIn ? (
                  <Button
                    onClick={handleTimeIn}
                    size="lg"
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={actionLoading || freezeSessionAt !== null || autoTimeoutTriggered}
                  >
                    <Timer className="mr-2 h-5 w-5" />
                    {loadingAction === "timein" ? "Processing..." : "Time In"}
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleTimeOut()}
                    size="lg"
                    variant="destructive"
                    className="w-full"
                    disabled={actionLoading}
                  >
                    <Timer className="mr-2 h-5 w-5" />
                    {loadingAction === "timeout" ? "Processing..." : "Time Out"}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Overtime Time In/Out Card */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">Overtime Tracking</h3>
                <p className="text-sm text-gray-600">
                  {isOvertimeIn ? "You're currently in an overtime session." : "Log extra hours beyond your regular shift."}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                {/* Always show badge depending on state */}
                <div className="text-center">
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                    {autoTimeoutTriggered
                      ? isOvertimeIn
                        ? overtimeInTimestamp
                          ? `Overtime started at ${overtimeInTimestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                          : "Overtime started"
                        : "Render Overtime"
                      : "Render Regular Hours First"}
                  </Badge>
                </div>
                {!isOvertimeIn ? (
                  <Button
                    onClick={handleOvertimeIn}
                    size="lg"
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    disabled={actionLoading || freezeSessionAt !== null || !autoTimeoutTriggered}
                  >
                    <Timer className="mr-2 h-5 w-5" />
                    {loadingAction === "overtimein" ? "Processing..." : "Overtime In"}
                  </Button>
                ) : (
                  <Button
                    onClick={handleOvertimeOut}
                    size="lg"
                    variant="destructive"
                    className="w-full"
                    disabled={actionLoading}
                  >
                    <Timer className="mr-2 h-5 w-5" />
                    {loadingAction === "overtimeout" ? "Processing..." : "Overtime Out"}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">This Week&apos;s Logs</CardTitle>
          <p className="text-sm text-gray-600">Your daily time records for the current week</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center text-gray-500 py-8">Loading logs...</div>
          ) : error ? (
            <div className="text-center text-red-500 py-8">{error}</div>
          ) : weeklyLogs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No logs found yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time In</TableHead>
                    <TableHead>Time Out</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupLogsByDate(weeklyLogs).map(([date, logs]) => (
                    <TableRow key={date}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col items-start">
                          <span className="text-xs text-gray-500">
                            {new Date(date).toLocaleDateString("en-US", { weekday: "short" })}
                          </span>
                          <span>{formatLogDate(date)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {logs.map((log, idx) =>
                            log.time_in ? (
                              <Badge
                                key={idx}
                                variant="outline"
                                className={
                                  log.log_type === "overtime"
                                    ? "bg-purple-50 text-purple-700"
                                    : "bg-green-50 text-green-700"
                                }
                              >
                                {new Date(log.time_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </Badge>
                            ) : (
                              <span key={idx} className="text-gray-400">--</span>
                            )
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {logs.map((log, idx) =>
                            log.time_out ? (
                              <Badge
                                key={idx}
                                variant="outline"
                                className={
                                  log.log_type === "overtime"
                                    ? "bg-purple-50 text-purple-700"
                                    : "bg-red-50 text-red-700"
                                }
                              >
                                {new Date(log.time_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </Badge>
                            ) : log.time_in && log.status === "pending" ? (
                              <Badge
                                key={idx}
                                variant="outline"
                                className={
                                  log.log_type === "overtime"
                                    ? "bg-purple-50 text-purple-700"
                                    : "bg-yellow-50 text-yellow-700"
                                }
                              >
                                In Progress
                              </Badge>
                            ) : (
                              <span key={idx} className="text-gray-400">--</span>
                            )
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <div className="flex flex-col gap-1">
                          {logs.map((log, idx) => {
                            const dur = getLogDuration(log)
                            if (dur) {
                              return (
                                <span key={idx} className="font-semibold">
                                  {dur.duration}
                                </span>
                              )
                            } else if (log.time_in && !log.time_out) {
                              // Show real-time duration for active logs
                              const inDate = new Date(log.time_in)
                              const now = new Date()
                              const diffMs = now.getTime() - inDate.getTime()
                              const hours = Math.floor(diffMs / (1000 * 60 * 60))
                              const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                              return (
                                <span key={idx} className="font-semibold text-yellow-700">
                                  {formatDuration(hours, minutes)}
                                </span>
                              )
                            } else if (log.status === "pending") {
                              return (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className={
                                    log.log_type === "overtime"
                                      ? "bg-purple-50 text-purple-700"
                                      : "bg-yellow-50 text-yellow-700"
                                  }
                                >
                                  In Progress
                                </Badge>
                              )
                            } else {
                              return <span key={idx} className="text-gray-400">--</span>
                            }
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <div className="flex flex-col gap-1">
                          {logs.map((log, idx) => {
                            const dur = getLogDuration(log)
                            return dur ? (
                              <span
                                key={idx}
                                className={
                                  "font-semibold " +
                                  (log.log_type === "overtime" ? "text-purple-700" : "text-blue-600")
                                }
                              >
                                {dur.decimal}h
                              </span>
                            ) : log.time_in && !log.time_out ? (
                              <span key={idx} className="font-semibold text-right block">
                                <Badge
                                  variant="outline"
                                  className={
                                    log.log_type === "overtime"
                                      ? "bg-purple-50 text-purple-700"
                                      : "bg-blue-50 text-blue-700"
                                  }
                                >
                                  Active
                                </Badge>
                              </span>
                            ) : (
                              <span key={idx} className="text-gray-400">--</span>
                            )
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
