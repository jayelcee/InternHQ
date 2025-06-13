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
  time_in: string | null
  time_out: string | null
  notes?: string
  status: "pending" | "completed"
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

// Helper to get today's date string (YYYY-MM-DD)
function getTodayString() {
  const now = new Date();
  // Get local date in YYYY-MM-DD
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper to sum durations for all logs today
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

export function InternDashboardContent() {
  const { user } = useAuth()
  // Log user object on every render
  console.log("[Dashboard] user:", user);

  // Add this guard:
  if (!user || !user.internship) {
    console.log("[Dashboard] Waiting for full user with internship...");
    return (
      <div className="flex justify-center items-center h-64">
        <span className="text-gray-500">Loading your dashboard...</span>
      </div>
    )
  }

  const [currentTime, setCurrentTime] = useState(new Date())
  const [isTimedIn, setIsTimedIn] = useState(false)
  const [timeInTimestamp, setTimeInTimestamp] = useState<Date | null>(null)
  const [todayDuration, setTodayDuration] = useState("0h 00m")
  const [allLogs, setAllLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [stateReady, setStateReady] = useState(false)
  const [actionLoading, setActionLoading] = useState(false);
  const restoredRef = useRef(false)

  // On mount, restore todayDuration from localStorage FIRST
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true

    const today = getTodayString()
    console.log("[useEffect] Mount: today =", today);

    // Restore todayDuration from localStorage
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

  // Restore clock-in state and fetch logs when user changes (including after login)
  useEffect(() => {
    console.log("[useEffect] user or stateReady changed:", { user, stateReady });
    if (!user || !stateReady) return // <-- Only run when ready

    const restoreClockState = async () => {
      try {
        const res = await fetch("/api/time-logs")
        console.log("[restoreClockState] /api/time-logs status:", res.status);
        if (res.ok) {
          const data = await res.json()
          console.log("[restoreClockState] logs data:", data);
          const logsArr = (Array.isArray(data) ? data : data.logs || [])
          setAllLogs(logsArr.map((log: any) => {
            let hoursWorked = 0
            let duration = null
            const now = new Date()

            if (log.time_in) {
              const inDate = new Date(log.time_in)
              const outDate = log.time_out ? new Date(log.time_out) : now
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
            .filter((log: any) => log.time_out === null && log.time_in?.slice(0, 10) === todayStr)
            .sort((a: any, b: any) => new Date(b.time_in).getTime() - new Date(a.time_in).getTime())[0]
          if (activeLog) {
            setIsTimedIn(true)
            const inDate = new Date(activeLog.time_in)
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
      } catch (e) {
        console.error("[restoreClockState] error:", e);
        const stored = localStorage.getItem("clockInState")
        if (stored) {
          const { isTimedIn, timeInTimestamp } = JSON.parse(stored)
          setIsTimedIn(isTimedIn)
          setTimeInTimestamp(timeInTimestamp ? new Date(timeInTimestamp) : null)
        }
      }
    }

    restoreClockState()
    // fetchLogs() is not needed here, handled above
  }, [user, stateReady])

  // Always fetch logs when user and stateReady change (ensures logs show even after time out/refresh)
  useEffect(() => {
    console.log("[useEffect] fetchLogs trigger: user/stateReady", { user, stateReady });
    if (user && stateReady) {
      fetchLogs(true);
    }
  }, [user, stateReady])

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

  // Fetch logs after clock-in/out
  const fetchLogs = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/time-logs");
      if (!res.ok) throw new Error("Failed to fetch logs");
      const data = await res.json();
      const logsArr = (Array.isArray(data) ? data : data.logs || [])
        .map((log: any) => {
          let hoursWorked = 0;
          let duration = null;
          const now = new Date();
          if (log.time_in) {
            const inDate = new Date(log.time_in);
            const outDate = log.time_out ? new Date(log.time_out) : now;
            const diffMs = outDate.getTime() - inDate.getTime();
            hoursWorked = diffMs > 0 ? Number(truncateTo2Decimals(diffMs / (1000 * 60 * 60))) : 0;
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            duration = formatDuration(hours, minutes);
          }
          return { ...log, hoursWorked, duration };
        })
        .sort((a: any, b: any) => {
          const aTime = a.time_in ? new Date(a.time_in).getTime() : 0;
          const bTime = b.time_in ? new Date(b.time_in).getTime() : 0;
          return bTime - aTime;
        });
      console.log("[fetchLogs] All logs received:", logsArr.map((l: TimeLog) => ({ date: l.time_in?.slice(0, 10), time_in: l.time_in, time_out: l.time_out, status: l.status })));
      const today = getTodayString();
      const todayLogs = logsArr.filter((log: TimeLog) => log.time_in?.slice(0, 10) === today);
      console.log("[fetchLogs] Logs for today:", todayLogs);
      setAllLogs(logsArr);
    } catch (err: any) {
      setError(err.message || "Failed to load logs");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Calculate today's duration (sum all logs for today + current session)
  useEffect(() => {
    setTodayDuration(getTodayTotalDuration(allLogs, isTimedIn, timeInTimestamp))
  }, [allLogs.length, isTimedIn, timeInTimestamp, tick])

  // Save todayDuration to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("todayDuration", JSON.stringify({ date: getTodayString(), value: todayDuration }))
  }, [todayDuration])

  // Handle Time In
  const handleTimeIn = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    const now = new Date();
    setIsTimedIn(true);
    setTimeInTimestamp(now);
    const today = getTodayString();
    console.log("[TimeIn] Local date being sent to backend:", today);
    try {
      const res = await fetch("/api/time-logs/clock-in", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today }),
      });
      console.log("[TimeIn] API response:", res.status);
      if (!res.ok) throw new Error("Failed to clock in");
      await fetchLogs(false);
    } catch (error) {
      setIsTimedIn(false);
      setTimeInTimestamp(null);
      setActionLoading(false);
      console.error("[TimeIn] Error clocking in:", error);
      alert("Failed to clock in. Please try again.");
      return;
    }
    setActionLoading(false);
  };

  // Handle Time Out
  const handleTimeOut = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    const today = getTodayString();
    console.log("[TimeOut] Local date being sent to backend:", today);
    // Calculate total hours worked today (including current session)
    let totalMs = 0;
    allLogs.forEach((log) => {
      if (log.time_in && log.time_in.slice(0, 10) === today) {
        const inDate = new Date(log.time_in);
        const outDate = log.time_out ? new Date(log.time_out) : null;
        if (outDate) {
          totalMs += outDate.getTime() - inDate.getTime();
        }
      }
    });
    // Add current session if active
    if (isTimedIn && timeInTimestamp) {
      totalMs += new Date().getTime() - timeInTimestamp.getTime();
    }
    const totalHoursToday = totalMs / (1000 * 60 * 60);

    console.log("[TimeOut] totalHoursToday:", totalHoursToday);

    if (totalHoursToday < REQUIRED_HOURS_PER_DAY) {
      const confirm = window.confirm(
        `You have only worked ${totalHoursToday.toFixed(2)} hours today. Cybersoft standard is ${REQUIRED_HOURS_PER_DAY} hours. Are you sure you want to time out?`
      );
      if (!confirm) {
        setActionLoading(false);
        console.log("[TimeOut] User cancelled time out due to insufficient hours");
        return;
      }
    }

    setIsTimedIn(false);
    setTimeInTimestamp(null);
    console.log("[TimeOut] Optimistically set isTimedIn=false, timeInTimestamp=null");

    try {
      const res = await fetch("/api/time-logs/clock-out", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today }),
      });
      console.log("[TimeOut] API response:", res.status);
      if (!res.ok) throw new Error("Failed to clock out");
      await fetchLogs(false);
    } catch (error) {
      // Revert state if failed
      setIsTimedIn(true);
      setTimeInTimestamp(timeInTimestamp);
      setActionLoading(false);
      console.error("[TimeOut] Error clocking out:", error);
      alert("Failed to clock out. Please try again.");
      return;
    }
    setActionLoading(false);
    console.log("[TimeOut] actionLoading set to false (end)");
  };

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

  // Internship details from user object (no completedHours in schema)
  const internshipDetails = user.internship
  console.log("[Dashboard] internshipDetails:", internshipDetails);

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

  const completedHours = (() => {
    const total = allLogs
      .filter((log) => log.status === "completed" && log.time_in && log.time_out)
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
      : Number(truncateTo2Decimals(internshipDetails.required_hours - completedHours))
  // Calculate total days worked so far (count unique dates with completed logs)
  const totalDaysWorked = (() => {
    const dates = new Set(
      allLogs
        .filter((log) => log.status === "completed" && log.time_in && log.time_out)
        .map((log) => log.time_in?.slice(0, 10))
        .filter(Boolean)
    )
    return dates.size
  })()

  // Render logs with real-time duration for active logs
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

  // Filter logs for current week (by log.date)
  const weeklyLogs = allLogs.filter((log) => {
    if (!log.time_in) return false
    const logDate = new Date(log.time_in)
    // log.date may be string "YYYY-MM-DD" or ISO string
    return logDate >= weekStart && logDate <= weekEnd
  })

  // Calculate weekly hours and days worked from weeklyLogs
  const weeklyHours = weeklyLogs
    .filter((log) => log.status === "completed" && log.time_in && log.time_out)
    .reduce((sum, log) => sum + getTruncatedDecimalHours(log), 0)

  // Calculate weekly days worked (count unique dates with completed logs)
  const weeklyDaysWorked = (() => {
    const dates = new Set(
      weeklyLogs
        .filter((log) => log.status === "completed" && log.time_in && log.time_out)
        .map((log) => log.time_in?.slice(0, 10))
        .filter(Boolean)
    )
    return dates.size
  })()

  if (!user) {
    console.log("[Dashboard] No user, loading...");
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

function truncateTo2Decimals(val: number) {
  const [int, dec = ""] = val.toString().split(".")
  return dec.length > 0 ? `${int}.${dec.slice(0, 2).padEnd(2, "0")}` : `${int}.00`
}

function formatDuration(hours: number, minutes: number) {
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`
}

function groupLogsByDate(logs: TimeLog[]) {
  const map = new Map<string, TimeLog[]>()
  logs.forEach(log => {
    const dateKey = log.time_in ? log.time_in.slice(0, 10) : undefined
    if (!dateKey) return
    if (!map.has(dateKey)) map.set(dateKey, [])
    map.get(dateKey)!.push(log)
  })
  // Sort logs within each date by time_in
  map.forEach(arr => arr.sort((a, b) =>
    new Date(a.time_in!).getTime() - new Date(b.time_in!).getTime()
  ))
  // Return as array of [date, logs[]], sorted by date descending
  return Array.from(map.entries()).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
}
