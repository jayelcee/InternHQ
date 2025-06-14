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
}

const REQUIRED_HOURS_PER_DAY = 9

/**
 * Returns the start (Monday) and end (Sunday) of the current week.
 */
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

/**
 * Returns today's date as YYYY-MM-DD.
 */
function getTodayString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Sums durations for all logs today and adds current session if active.
 */
function getTodayTotalDuration(logs: TimeLog[], isTimedIn: boolean, timeInTimestamp: Date | null) {
  const today = getTodayString()
  let totalMs = 0

  logs.forEach((log) => {
    if (log.time_in && log.time_in.slice(0, 10) === today) {
      const inDate = new Date(log.time_in)
      const outDate = log.time_out ? new Date(log.time_out) : null
      if (outDate) {
        totalMs += outDate.getTime() - inDate.getTime()
      }
    }
  })

  // Add current active session if any
  if (isTimedIn && timeInTimestamp) {
    totalMs += new Date().getTime() - timeInTimestamp.getTime()
  }

  const hours = Math.floor(totalMs / (1000 * 60 * 60))
  const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60))
  return formatDuration(hours, minutes)
}

/**
 * Truncates a decimal number to 2 decimals as string.
 */
function truncateTo2Decimals(val: number) {
  const [int, dec = ""] = val.toString().split(".")
  return dec.length > 0 ? `${int}.${dec.slice(0, 2).padEnd(2, "0")}` : `${int}.00`
}

/**
 * Formats duration as "Xh YYm".
 */
function formatDuration(hours: number, minutes: number) {
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`
}

/**
 * Groups logs by date for weekly logs table.
 */
function groupLogsByDate(logs: TimeLog[]) {
  const map = new Map<string, TimeLog[]>()
  logs.forEach(log => {
    const dateKey = log.time_in ? log.time_in.slice(0, 10) : undefined
    if (!dateKey) return
    if (!map.has(dateKey)) map.set(dateKey, [])
    map.get(dateKey)!.push(log)
  })
  map.forEach(arr => arr.sort((a, b) =>
    new Date(a.time_in!).getTime() - new Date(b.time_in!).getTime()
  ))
  return Array.from(map.entries()).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
}

/**
 * Main Intern Dashboard Content component.
 */
export function InternDashboardContent() {
  const { user } = useAuth()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isTimedIn, setIsTimedIn] = useState(false)
  const [timeInTimestamp, setTimeInTimestamp] = useState<Date | null>(null)
  const [todayDuration, setTodayDuration] = useState("0h 00m")
  const [allLogs, setAllLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [stateReady, setStateReady] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const restoredRef = useRef(false)

  // Internship details from user context
  const internshipDetails = user?.internship

  /**
   * On mount, restore todayDuration from localStorage.
   */
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true

    const today = getTodayString()
    const storedDuration = localStorage.getItem("todayDuration")
    let durationDate = today
    let durationValue = "0h 00m"
    if (storedDuration) {
      const { date, value } = JSON.parse(storedDuration)
      durationDate = date
      durationValue = value
    }

    if (durationDate !== today) {
      setTodayDuration("0h 00m")
      localStorage.setItem("todayDuration", JSON.stringify({ date: today, value: "0h 00m" }))
    } else {
      setTodayDuration(durationValue)
    }

    setStateReady(true)
  }, [])

  /**
   * Restore clock-in state and fetch logs when user changes (including after login).
   */
  useEffect(() => {
    if (!user || !stateReady) return

    const restoreClockState = async () => {
      try {
        const res = await fetch("/api/time-logs")
        if (res.ok) {
          const data = await res.json()
          const logsArr = (Array.isArray(data) ? data : data.logs || [])
          setAllLogs(logsArr.map((log: Record<string, unknown>) => {
            let hoursWorked = 0
            let duration = null
            const now = new Date()

            if (log.time_in) {
              const inDate = new Date(log.time_in as string)
              const outDate = log.time_out ? new Date(log.time_out as string) : now
              const diffMs = outDate.getTime() - inDate.getTime()
              hoursWorked = diffMs > 0 ? Number(truncateTo2Decimals(diffMs / (1000 * 60 * 60))) : 0
              const hours = Math.floor(diffMs / (1000 * 60 * 60))
              const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
              duration = formatDuration(hours, minutes)
            }

            return { ...log, hoursWorked, duration }
          }))
          // Find the latest active log (no time_out) FOR TODAY ONLY
          const todayStr = getTodayString()
          const activeLog = logsArr
            .filter((log: Record<string, unknown>) => log.time_out === null && (log.time_in as string)?.slice(0, 10) === todayStr)
            .sort((a: Record<string, unknown>, b: Record<string, unknown>) => new Date(b.time_in as string).getTime() - new Date(a.time_in as string).getTime())[0]
          if (activeLog) {
            setIsTimedIn(true)
            const inDate = new Date(activeLog.time_in as string)
            setTimeInTimestamp(inDate)
            localStorage.setItem(
              "clockInState",
              JSON.stringify({
                isTimedIn: true,
                timeInTimestamp: activeLog.time_in,
              })
            )
          } else {
            setIsTimedIn(false)
            setTimeInTimestamp(null)
            localStorage.setItem(
              "clockInState",
              JSON.stringify({
                isTimedIn: false,
                timeInTimestamp: null,
              })
            )
          }
        }
      } catch {
        // Fallback to localStorage if fetch fails
        const stored = localStorage.getItem("clockInState")
        if (stored) {
          const { isTimedIn, timeInTimestamp } = JSON.parse(stored)
          setIsTimedIn(isTimedIn)
          setTimeInTimestamp(timeInTimestamp ? new Date(timeInTimestamp) : null)
        }
      }
    }

    restoreClockState()
  }, [user, stateReady])

  /**
   * Always fetch logs when user and stateReady change.
   */
  useEffect(() => {
    if (user && stateReady) {
      fetchLogs(true)
    }
  }, [user, stateReady])

  /**
   * Save clock-in state to localStorage.
   */
  useEffect(() => {
    localStorage.setItem(
      "clockInState",
      JSON.stringify({
        isTimedIn,
        timeInTimestamp,
      })
    )
  }, [isTimedIn, timeInTimestamp])

  /**
   * Real-time tick for durations.
   */
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  /**
   * Fetch logs after clock-in/out.
   */
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
          const now = new Date()
          if (log.time_in) {
            const inDate = new Date(log.time_in as string)
            const outDate = log.time_out ? new Date(log.time_out as string) : now
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

  /**
   * Update current time every second.
   */
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  /**
   * Calculate today's duration (sum all logs for today + current session).
   */
  useEffect(() => {
    setTodayDuration(getTodayTotalDuration(allLogs, isTimedIn, timeInTimestamp))
  }, [allLogs, isTimedIn, timeInTimestamp, tick])

  /**
   * Save todayDuration to localStorage whenever it changes.
   */
  useEffect(() => {
    localStorage.setItem("todayDuration", JSON.stringify({ date: getTodayString(), value: todayDuration }))
  }, [todayDuration])

  /**
   * Handle Time In action.
   */
  const handleTimeIn = async () => {
    if (actionLoading) return
    setActionLoading(true)
    const now = new Date()
    setIsTimedIn(true)
    setTimeInTimestamp(now)
    const today = getTodayString()
    try {
      const res = await fetch("/api/time-logs/clock-in", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today }),
      })
      if (!res.ok) throw new Error("Failed to clock in")
      await fetchLogs(false)
    } catch {
      setIsTimedIn(false)
      setTimeInTimestamp(null)
      setActionLoading(false)
      alert("Failed to clock in. Please try again.")
      return
    }
    setActionLoading(false)
  }

  /**
   * Handle Time Out action.
   */
  const handleTimeOut = async () => {
    if (actionLoading) return
    setActionLoading(true)
    const today = getTodayString()
    // Calculate total hours worked today (including current session)
    let totalMs = 0
    allLogs.forEach((log) => {
      if (log.time_in && log.time_in.slice(0, 10) === today) {
        const inDate = new Date(log.time_in)
        const outDate = log.time_out ? new Date(log.time_out) : null
        if (outDate) {
          totalMs += outDate.getTime() - inDate.getTime()
        }
      }
    })
    // Add current session if active
    if (isTimedIn && timeInTimestamp) {
      totalMs += new Date().getTime() - timeInTimestamp.getTime()
    }
    const totalHoursToday = totalMs / (1000 * 60 * 60)

    if (totalHoursToday < REQUIRED_HOURS_PER_DAY) {
      const confirm = window.confirm(
        `You have only worked ${totalHoursToday.toFixed(2)} hours today. Cybersoft standard is ${REQUIRED_HOURS_PER_DAY} hours. Are you sure you want to time out?`
      )
      if (!confirm) {
        setActionLoading(false)
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
        body: JSON.stringify({ date: today }),
      })
      if (!res.ok) throw new Error("Failed to clock out")
      await fetchLogs(false)
    } catch {
      // Revert state if failed
      setIsTimedIn(true)
      setTimeInTimestamp(timeInTimestamp)
      setActionLoading(false)
      alert("Failed to clock out. Please try again.")
      return
    }
    setActionLoading(false)
  }

  /**
   * Format a Date object as a readable string.
   */
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  /**
   * Format a Date object as a time string.
   */
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  /**
   * Format a date string as MM-DD-YYYY.
   */
  const formatLogDate = (dateString: string) => {
    const date = new Date(dateString)
    return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}-${date.getFullYear()}`
  }

  /**
   * Get truncated decimal hours for a log.
   */
  function getTruncatedDecimalHours(log: TimeLog) {
    if (!log.time_in || !log.time_out) return 0
    const inDate = new Date(log.time_in)
    const outDate = new Date(log.time_out)
    const diffMs = outDate.getTime() - inDate.getTime()
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    const decimal = hours + minutes / 60
    return Number(truncateTo2Decimals(decimal))
  }

  /**
   * Calculate total completed hours.
   */
  const completedHours = (() => {
    const total = allLogs
      .filter((log) => log.status === "completed" && log.time_in && log.time_out)
      .reduce((sum, log) => sum + getTruncatedDecimalHours(log), 0)
    return Number(truncateTo2Decimals(total))
  })()

  /**
   * Calculate progress percentage.
   */
  const progressPercentage =
    internshipDetails && typeof internshipDetails.required_hours === "number" && internshipDetails.required_hours > 0
      ? Math.min((completedHours / internshipDetails.required_hours) * 100, 100)
      : 0

  /**
   * Calculate remaining hours.
   */
  const remainingHours =
    internshipDetails?.required_hours && completedHours >= internshipDetails.required_hours
      ? 0
      : Number(truncateTo2Decimals((internshipDetails?.required_hours || 0) - completedHours))

  /**
   * Calculate total days worked so far.
   */
  const totalDaysWorked = (() => {
    const dates = new Set(
      allLogs
        .filter((log) => log.status === "completed" && log.time_in && log.time_out)
        .map((log) => log.time_in?.slice(0, 10))
        .filter(Boolean)
    )
    return dates.size
  })()

  /**
   * Render logs with real-time duration for active logs.
   */
  const getLogDuration = (log: TimeLog) => {
    if (log.time_in) {
      const inDate = new Date(log.time_in)
      const outDate = log.time_out ? new Date(log.time_out) : new Date()
      const diffMs = outDate.getTime() - inDate.getTime()
      const hours = Math.floor(diffMs / (1000 * 60 * 60))
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      return { duration: formatDuration(hours, minutes), hours, minutes }
    }
    return null
  }

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
    .reduce((sum, log) => sum + getTruncatedDecimalHours(log), 0)

  const weeklyDaysWorked = (() => {
    const dates = new Set(
      weeklyLogs
        .filter((log) => log.status === "completed" && log.time_in && log.time_out)
        .map((log) => log.time_in?.slice(0, 10))
        .filter(Boolean)
    )
    return dates.size
  })()

  /**
   * Midnight rollover effect: If clocked in at midnight, auto time out and time in for new day.
   */
  useEffect(() => {
    if (!isTimedIn || !timeInTimestamp) return

    // Set up a timer to fire at the next midnight
    const now = new Date()
    const nextMidnight = new Date(now)
    nextMidnight.setHours(24, 0, 0, 0)
    const msUntilMidnight = nextMidnight.getTime() - now.getTime()

    const timer = setTimeout(async () => {
      // Auto time out for the previous day at 23:59:59
      const prevDay = new Date(timeInTimestamp)
      prevDay.setHours(23, 59, 59, 999)
      const prevDayStr = timeInTimestamp.toISOString().slice(0, 10)

      try {
        await fetch("/api/time-logs/clock-out", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: prevDayStr, time: prevDay.toISOString() }),
        })
      } catch {
        // Optionally handle error (e.g., show notification)
      }

      // Auto time in for the new day at 00:00:00
      const newDay = new Date(nextMidnight)
      const newDayStr = newDay.toISOString().slice(0, 10)

      try {
        await fetch("/api/time-logs/clock-in", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: newDayStr, time: newDay.toISOString() }),
        })
        setTimeInTimestamp(newDay)
        setIsTimedIn(true)
        fetchLogs(false)
      } catch {
        setIsTimedIn(false)
        setTimeInTimestamp(null)
      }
    }, msUntilMidnight)

    return () => clearTimeout(timer)
  }, [isTimedIn, timeInTimestamp])

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
                  {isTimedIn ? "You're currently clocked in" : "Ready to start your shift?"}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                {!isTimedIn ? (
                  <Button
                    onClick={handleTimeIn}
                    size="lg"
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={actionLoading}
                  >
                    <Timer className="mr-2 h-5 w-5" />
                    {actionLoading ? "Processing..." : "Time In"}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="text-center">
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Clocked In at{" "}
                        {timeInTimestamp?.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Badge>
                    </div>
                    <Button onClick={handleTimeOut} size="lg" variant="destructive" className="w-full" disabled={actionLoading}>
                      <Timer className="mr-2 h-5 w-5" />
                      {actionLoading ? "Processing..." : "Time Out"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Today's Duration Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Today&apos;s Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{todayDuration}</div>
              <p className="text-sm text-gray-600 mt-1">Total worked today</p>
              {isTimedIn && (
                <Badge variant="outline" className="mt-2">
                  Currently active
                </Badge>
              )}
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
                              <Badge key={idx} variant="outline" className="bg-green-50 text-green-700">
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
                              <Badge key={idx} variant="outline" className="bg-red-50 text-red-700">
                                {new Date(log.time_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </Badge>
                            ) : log.time_in && log.status === "pending" ? (
                              <Badge key={idx} variant="outline" className="bg-yellow-50 text-yellow-700">
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
                          {logs.map((log, idx) =>
                            getLogDuration(log) ? (
                              <span key={idx} className="font-semibold">
                                {getLogDuration(log)!.duration}
                              </span>
                            ) : log.status === "pending" ? (
                              <Badge key={idx} variant="outline" className="bg-yellow-50 text-yellow-700">
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
                          {logs.map((log, idx) =>
                            log.time_in && log.time_out ? (
                              <span key={idx} className="font-semibold text-blue-600">
                                {(() => {
                                  const inDate = new Date(log.time_in)
                                  const outDate = new Date(log.time_out)
                                  const diffMs = outDate.getTime() - inDate.getTime()
                                  const hours = Math.floor(diffMs / (1000 * 60 * 60))
                                  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                                  const decimal = hours + minutes / 60
                                  return `${truncateTo2Decimals(decimal)}h`
                                })()}
                              </span>
                            ) : log.time_in && !log.time_out ? (
                              <span key={idx} className="font-semibold text-blue-600 text-right block">
                                <Badge variant="outline" className="bg-blue-50 text-blue-700">Active</Badge>
                              </span>
                            ) : (
                              <span key={idx} className="text-gray-400">--</span>
                            )
                          )}
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
