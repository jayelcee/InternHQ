"use client"

import { useState, useEffect, useRef } from "react"
import { Clock, Calendar, Timer, GraduationCap, Building, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useAuth } from "@/contexts/auth-context"

interface TimeLog {
  id: number
  date: string
  time_in: string | null
  time_out: string | null
  break_duration: number
  notes?: string
  status: "pending" | "approved" | "rejected"
  hoursWorked: number
  duration: string | null
}

const REQUIRED_HOURS_PER_DAY = 9

// Helper: Get start (Monday) and end (Sunday) of current week
function getWeekRange(date = new Date()) {
  const day = date.getDay()
  const diffToMonday = (day === 0 ? -6 : 1) - day // Sunday (0) -> last Monday
  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMonday)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { monday, sunday }
}

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
  const [hasTimedOutToday, setHasTimedOutToday] = useState(false)
  const [stateReady, setStateReady] = useState(false)
  const restoredRef = useRef(false)

  // On mount, restore hasTimedOutToday and todayDuration from localStorage FIRST
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true

    const today = getTodayString()

    // Restore from localStorage first
    const storedTimeout = localStorage.getItem("hasTimedOutToday")
    let timeoutDate = today
    let timeoutValue = false
    if (storedTimeout) {
      const { date, value } = JSON.parse(storedTimeout)
      timeoutDate = date
      timeoutValue = value
    }

    const storedDuration = localStorage.getItem("todayDuration")
    let durationDate = today
    let durationValue = "0h 00m"
    if (storedDuration) {
      const { date, value } = JSON.parse(storedDuration)
      durationDate = date
      durationValue = value
    }

    if (timeoutDate !== today || durationDate !== today) {
      setHasTimedOutToday(false)
      setTodayDuration("0h 00m")
      localStorage.setItem("hasTimedOutToday", JSON.stringify({ date: today, value: false }))
      localStorage.setItem("todayDuration", JSON.stringify({ date: today, value: "0h 00m" }))
    } else {
      setHasTimedOutToday(timeoutValue)
      setTodayDuration(durationValue)
    }

    // --- Always fetch today's log from backend to ensure accuracy ---
    const fetchTodayLog = async () => {
      try {
        const res = await fetch("/api/time-logs")
        if (res.ok) {
          const data = await res.json()
          const logsArr = (Array.isArray(data) ? data : data.logs || [])
          const todayLog = logsArr.find((log: any) => log.date?.slice(0, 10) === today)
          if (todayLog) {
            // If log exists, update state from backend
            if (todayLog.time_in) {
              const inDate = new Date(todayLog.time_in)
              const outDate = todayLog.time_out ? new Date(todayLog.time_out) : new Date()
              const diffMs = outDate.getTime() - inDate.getTime() - (todayLog.break_duration || 0) * 60 * 1000
              const hours = Math.floor(diffMs / (1000 * 60 * 60))
              const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
              setTodayDuration(formatDuration(hours, minutes))
              localStorage.setItem("todayDuration", JSON.stringify({ date: today, value: formatDuration(hours, minutes) }))
            }
            if (todayLog.time_out) {
              setHasTimedOutToday(true)
              localStorage.setItem("hasTimedOutToday", JSON.stringify({ date: today, value: true }))
            }
          }
        }
      } catch (err) {
        // ignore
      }
      setStateReady(true)
    }
    fetchTodayLog()
  }, [])

  // Restore clock-in state and fetch logs when user changes (including after login)
  useEffect(() => {
    if (!user || !stateReady) return // <-- Only run when ready

    const restoreClockState = async () => {
      try {
        const res = await fetch("/api/time-logs")
        if (res.ok) {
          const data = await res.json()
          const logsArr = (Array.isArray(data) ? data : data.logs || [])
          const activeLog = logsArr
            .filter((log: any) => log.time_out === null)
            .sort((a: any, b: any) => new Date(b.time_in).getTime() - new Date(a.time_in).getTime())[0]
          console.log("[RESTORE CLOCK STATE] activeLog:", activeLog)
          if (activeLog) {
            setIsTimedIn(true)
            const inDate = new Date(activeLog.time_in)
            setTimeInTimestamp(inDate)
            // Only update today's duration if NOT timed out today
            if (!hasTimedOutToday) {
              const now = new Date()
              const diff = now.getTime() - inDate.getTime()
              const hours = Math.floor(diff / (1000 * 60 * 60))
              const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
              setTodayDuration(formatDuration(hours, minutes))
              localStorage.setItem(
                "clockInState",
                JSON.stringify({
                  isTimedIn: true,
                  timeInTimestamp: activeLog.time_in,
                })
              )
              console.log("[RESTORE CLOCK STATE] Set as timed in, todayDuration:", `${hours}h ${minutes}m`)
            }
            return
          }
        }
      } catch (e) {
        const stored = localStorage.getItem("clockInState")
        if (stored) {
          const { isTimedIn, timeInTimestamp } = JSON.parse(stored)
          setIsTimedIn(isTimedIn)
          setTimeInTimestamp(timeInTimestamp ? new Date(timeInTimestamp) : null)
          // Only update today's duration if NOT timed out today
          if (isTimedIn && timeInTimestamp && !hasTimedOutToday) {
            const now = new Date()
            const inDate = new Date(timeInTimestamp)
            const diff = now.getTime() - inDate.getTime()
            const hours = Math.floor(diff / (1000 * 60 * 60))
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
            setTodayDuration(formatDuration(hours, minutes))
            console.log("[RESTORE CLOCK STATE] (fallback) Set as timed in, todayDuration:", `${hours}h ${minutes}m`)
          }
        }
      }
      setIsTimedIn(false)
      setTimeInTimestamp(null)
      // Do NOT reset today's progress here!
      console.log("[RESTORE CLOCK STATE] Set as not timed in")
    }

    restoreClockState()
    fetchLogs()
    // Only run when user, hasTimedOutToday, or stateReady changes
  }, [user, hasTimedOutToday, stateReady])

  // Save clock-in state to localStorage
  useEffect(() => {
    localStorage.setItem(
      "clockInState",
      JSON.stringify({
        isTimedIn,
        timeInTimestamp,
      })
    )
  }, [isTimedIn, timeInTimestamp])

  // Real-time tick for durations
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/time-logs")
      if (!res.ok) throw new Error("Failed to fetch logs")
      const data = await res.json()
      // Sort logs by time_in descending (most recent first)
      const logsArr = (Array.isArray(data) ? data : data.logs || [])
        .map((log: any) => {
          let hoursWorked = 0
          let duration = null
          const now = new Date()

          if (log.time_in) {
            const inDate = new Date(log.time_in)
            const outDate = log.time_out ? new Date(log.time_out) : now
            const diffMs = outDate.getTime() - inDate.getTime() - (log.break_duration || 0) * 60 * 1000
            hoursWorked = diffMs > 0 ? Number(truncateTo2Decimals(diffMs / (1000 * 60 * 60))) : 0
            const hours = Math.floor(diffMs / (1000 * 60 * 60))
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
            duration = formatDuration(hours, minutes)
          }

          return { ...log, hoursWorked, duration }
        })
        .sort((a: any, b: any) => {
          // Sort by time_in descending, fallback to id
          const aTime = a.time_in ? new Date(a.time_in).getTime() : 0
          const bTime = b.time_in ? new Date(b.time_in).getTime() : 0
          return bTime - aTime
        })
      setAllLogs(logsArr)
    } catch (err: any) {
      setError(err.message || "Failed to load logs")
    } finally {
      setLoading(false)
    }
  }

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Calculate today's duration if timed in
  useEffect(() => {
    if (isTimedIn && timeInTimestamp) {
      const timer = setInterval(() => {
        const now = new Date()
        const diff = now.getTime() - timeInTimestamp.getTime()
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        setTodayDuration(formatDuration(hours, minutes))
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [isTimedIn, timeInTimestamp])

  // Helper to get today's date string (YYYY-MM-DD)
  const getTodayString = () => {
    const now = new Date()
    return now.toISOString().split("T")[0]
  }

  // Helper to get 6am timestamp for today or next day
  const getNext6am = () => {
    const now = new Date()
    const sixAM = new Date(now)
    sixAM.setHours(6, 0, 0, 0)
    if (now >= sixAM) {
      // If past 6am today, set to 6am tomorrow
      sixAM.setDate(sixAM.getDate() + 1)
    }
    return sixAM
  }

  // On mount, restore hasTimedOutToday and todayDuration from localStorage
  useEffect(() => {
    const today = getTodayString()

    // Restore hasTimedOutToday
    const storedTimeout = localStorage.getItem("hasTimedOutToday")
    let timeoutDate = today
    let timeoutValue = false
    if (storedTimeout) {
      const { date, value } = JSON.parse(storedTimeout)
      timeoutDate = date
      timeoutValue = value
    }
    console.log("[RESTORE] hasTimedOutToday from localStorage:", { timeoutDate, timeoutValue })

    // Restore todayDuration
    const storedDuration = localStorage.getItem("todayDuration")
    let durationDate = today
    let durationValue = "0h 00m"
    if (storedDuration) {
      const { date, value } = JSON.parse(storedDuration)
      durationDate = date
      durationValue = value
    }
    console.log("[RESTORE] todayDuration from localStorage:", { durationDate, durationValue })

    // --- KEY LOGIC: If the stored date is not today, reset state and localStorage ---
    if (timeoutDate !== today || durationDate !== today) {
      console.log("[RESTORE] Resetting state and localStorage for new day")
      setHasTimedOutToday(false)
      setTodayDuration("0h 00m")
      localStorage.setItem("hasTimedOutToday", JSON.stringify({ date: today, value: false }))
      localStorage.setItem("todayDuration", JSON.stringify({ date: today, value: "0h 00m" }))
    } else {
      setHasTimedOutToday(timeoutValue)
      setTodayDuration(durationValue)
      console.log("[RESTORE] Using persisted state for today")
    }
  }, [])

  // Save todayDuration to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("todayDuration", JSON.stringify({ date: getTodayString(), value: todayDuration }))
  }, [todayDuration])

  // At 6am, reset hasTimedOutToday and today's progress
  useEffect(() => {
    // Always schedule a reset at the next 6am
    const now = new Date()
    const next6am = getNext6am()
    const timeout = next6am.getTime() - now.getTime()

    const timer = setTimeout(() => {
      setHasTimedOutToday(false)
      setTodayDuration("0h 00m")
      localStorage.setItem("hasTimedOutToday", JSON.stringify({ date: getTodayString(), value: false }))
      localStorage.setItem("todayDuration", JSON.stringify({ date: getTodayString(), value: "0h 00m" }))
    }, timeout)

    return () => clearTimeout(timer)
  }, []) // <--- only run once on mount

  // Save hasTimedOutToday to localStorage
  useEffect(() => {
    localStorage.setItem("hasTimedOutToday", JSON.stringify({ date: getTodayString(), value: hasTimedOutToday }))
  }, [hasTimedOutToday])

  // Handle Time In
  const handleTimeIn = async () => {
    if (hasTimedOutToday) return
    const now = new Date()
    setIsTimedIn(true)
    setTimeInTimestamp(now)
    try {
      const res = await fetch("/api/time-logs/clock-in", {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to clock in")
      fetchLogs() // Refresh logs immediately
    } catch (error) {
      console.error("Error clocking in:", error)
    }
  }

  // Handle Time Out
  const handleTimeOut = async () => {
    if (timeInTimestamp) {
      const now = new Date()
      const diffMs = now.getTime() - timeInTimestamp.getTime()
      const hours = diffMs / (1000 * 60 * 60)
      if (hours < REQUIRED_HOURS_PER_DAY) {
        const confirm = window.confirm(
          `You have only worked ${hours.toFixed(2)} hours today. Cybersoft standard is ${REQUIRED_HOURS_PER_DAY} hours. Are you sure you want to time out?\n\nNote: You cannot time in again today after timing out.`
        )
        if (!confirm) return
      }
    }
    setIsTimedIn(false)
    setTimeInTimestamp(null)
    setHasTimedOutToday(true)
    // Do NOT reset today's progress here!
    try {
      const res = await fetch("/api/time-logs/clock-out", {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to clock out")
      fetchLogs() // Refresh logs immediately
    } catch (error) {
      console.error("Error clocking out:", error)
    }
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

  // Helper for MM-DD-YYYY format
  const formatLogDate = (dateString: string) => {
    const date = new Date(dateString)
    return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}-${date.getFullYear()}`
  }

  // Internship details from user object (no completedHours in schema)
  const internshipDetails = user?.internship ?? {
    school: { name: "N/A" },
    department: { name: "N/A" },
    supervisor: "N/A",
    required_hours: 0,
    start_date: "",
    end_date: "",
    status: "",
  }

  function getTruncatedDecimalHours(log: TimeLog) {
    if (!log.time_in || !log.time_out) return 0
    const inDate = new Date(log.time_in)
    const outDate = new Date(log.time_out)
    const diffMs = outDate.getTime() - inDate.getTime() - (log.break_duration || 0) * 60 * 1000
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    const decimal = hours + minutes / 60
    return Number(truncateTo2Decimals(decimal))
  }

  const completedHours = (() => {
    const total = allLogs
      .filter((log) => log.status === "approved" && log.time_in && log.time_out)
      .reduce((sum, log) => sum + getTruncatedDecimalHours(log), 0)
    return Number(truncateTo2Decimals(total))
  })()

  const progressPercentage =
    internshipDetails.required_hours > 0
      ? Math.min((completedHours / internshipDetails.required_hours) * 100, 100)
      : 0
  const remainingHours =
    completedHours >= internshipDetails.required_hours
      ? 0
      : internshipDetails.required_hours - completedHours
  // Calculate total days worked so far (approved logs with time_in)
  const totalDaysWorked = allLogs.filter(
    (log) => log.status === "approved" && log.time_in
  ).length

  // Render logs with real-time duration for active logs
  const getLogDuration = (log: TimeLog) => {
    if (log.time_in) {
      const inDate = new Date(log.time_in)
      const outDate = log.time_out ? new Date(log.time_out) : new Date()
      const diffMs = outDate.getTime() - inDate.getTime() - (log.break_duration || 0) * 60 * 1000
      const hours = Math.floor(diffMs / (1000 * 60 * 60))
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      return { duration: formatDuration(hours, minutes), hours, minutes }
    }
    return null
  }

  // Get current week range (Monday to Sunday)
  const { monday: weekStart, sunday: weekEnd } = getWeekRange()

  // Filter logs for current week (by log.date)
  const weeklyLogs = allLogs.filter((log) => {
    if (!log.date) return false
    const logDate = new Date(log.date)
    // log.date may be string "YYYY-MM-DD" or ISO string
    return logDate >= weekStart && logDate <= weekEnd
  })

  // Calculate weekly hours and days worked from weeklyLogs
  const weeklyHours = weeklyLogs
    .filter((log) => log.status === "approved" && log.time_in && log.time_out)
    .reduce((sum, log) => sum + getTruncatedDecimalHours(log), 0)

  // Calculate weekly days worked
  const weeklyDaysWorked = weeklyLogs.filter(
    (log) => log.status === "approved" && log.time_in
  ).length

  if (!user) {
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
                  {completedHours.toFixed(2)}h / {internshipDetails.required_hours}h
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{progressPercentage.toFixed(1)}%</div>
                {/* Only show remaining hours if greater than 0 */}
                {remainingHours > 0 && (
                  <p className="text-sm text-gray-600">{remainingHours}h remaining</p>
                )}
                <Badge variant="outline" className="mt-2">
                  {totalDaysWorked} days worked
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

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
                <p className="text-gray-600">{internshipDetails.school?.name ?? "N/A"}</p>
              </div>
              <div>
                <span className="font-medium">Assigned Department:</span>
                <p className="text-gray-600">{internshipDetails.department?.name ?? "N/A"}</p>
              </div>
              <div>
                <span className="font-medium">Duration:</span>
                <p className="text-gray-600">
                  {internshipDetails.start_date
                    ? new Date(internshipDetails.start_date).toLocaleDateString()
                    : "N/A"}{" "}
                  -{" "}
                  {internshipDetails.end_date
                    ? new Date(internshipDetails.end_date).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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
                    disabled={hasTimedOutToday}
                  >
                    <Timer className="mr-2 h-5 w-5" />
                    Time In
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
                    <Button onClick={handleTimeOut} size="lg" variant="destructive" className="w-full">
                      <Timer className="mr-2 h-5 w-5" />
                      Time Out
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Duration */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Today's Progress</CardTitle>
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

      {/* Weekly Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">This Week's Logs</CardTitle>
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
                  {weeklyLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">
                        {log.time_in ? (
                          <div className="flex flex-col items-start">
                            <span className="text-xs text-gray-500">
                              {new Date(log.time_in).toLocaleDateString("en-US", { weekday: "short" })}
                            </span>
                            <span>
                              {formatLogDate(log.time_in)}
                            </span>
                          </div>
                        ) : (
                          "--"
                        )}
                      </TableCell>
                      <TableCell>
                        {log.time_in ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            {log.time_in
                              ? new Date(log.time_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              : "--"}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.time_out ? (
                          <Badge variant="outline" className="bg-red-50 text-red-700">
                            {log.time_out
                              ? new Date(log.time_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              : "--"}
                          </Badge>
                        ) : log.time_in && log.status === "pending" ? (
                          <Badge variant="secondary">In Progress</Badge>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {getLogDuration(log) ? (
                          <span className="font-semibold">
                            {getLogDuration(log)!.duration}
                          </span>
                        ) : log.status === "pending" ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            In Progress
                          </Badge>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {log.time_in && log.time_out ? (
                          <span className="font-semibold text-blue-600">
                            {(() => {
                              const inDate = new Date(log.time_in)
                              const outDate = new Date(log.time_out)
                              const diffMs = outDate.getTime() - inDate.getTime() - (log.break_duration || 0) * 60 * 1000
                              const hours = Math.floor(diffMs / (1000 * 60 * 60))
                              const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                              const decimal = hours + minutes / 60
                              return `${truncateTo2Decimals(decimal)}h`
                            })()}
                          </span>
                        ) : log.time_in && !log.time_out ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">Active</Badge>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
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

function truncateTo2Decimals(val: number) {
  const [int, dec = ""] = val.toString().split(".")
  return dec.length > 0 ? `${int}.${dec.slice(0, 2).padEnd(2, "0")}` : `${int}.00`
}

function formatDuration(hours: number, minutes: number) {
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`
}
