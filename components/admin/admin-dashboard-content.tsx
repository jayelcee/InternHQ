"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { Search, Clock, Users, TrendingUp, Calendar, FileText, UserCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { format } from "date-fns"
import { InternProfile } from "@/components/intern/intern-profile"
import { DailyTimeRecord } from "@/components/intern/daily-time-record"

/**
 * Types for intern logs and intern records
 */
type TodayLog = {
  timeIn: string | null
  timeOut: string | null
  status: string
  label: string
}

type InternRecord = {
  id: number
  first_name: string
  last_name: string
  email: string
  department: string
  school: string
  todayHours: string
  status: "in" | "out"
  timeIn: string | null
  timeOut: string | null
  lastActivity: string
  internshipDetails: {
    requiredHours: number
    completedHours: number
    startDate: string
    endDate: string
  }
  todayLogs: TodayLog[]
}

type TimeLog = {
  id: number
  internId: number
  internName: string
  date: string
  timeIn: string | null
  timeOut: string | null
  duration: string | null
  hoursWorked: number
  department: string
  school: string
}

/**
 * Utility: Get today's date as YYYY-MM-DD string
 */
function getTodayString() {
  const now = new Date()
  return now.toISOString().split("T")[0]
}

/**
 * Utility: Format duration as "Xh YYm"
 */
function formatDurationHM(hours: number, minutes: number) {
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`
}

/**
 * Utility: Format log date as MM-DD-YYYY
 */
function formatLogDate(dateString: string) {
  if (!dateString) return ""
  const date = new Date(dateString)
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}-${date.getFullYear()}`
}

/**
 * Utility: Get unique departments from interns
 */
function getDepartments(interns: InternRecord[]): string[] {
  const set = new Set<string>()
  interns.forEach((intern) => {
    if (intern.department) set.add(intern.department)
  })
  return Array.from(set)
}

/**
 * HRAdminDashboard
 * Main dashboard component for HR/Admins to view and manage interns and logs.
 */
export function HRAdminDashboard() {
  // --- State ---
  const [searchTerm, setSearchTerm] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedInternId, setSelectedInternId] = useState<number | null>(null)
  const [selectedDTRInternId, setSelectedDTRInternId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<"overview" | "logs">("overview")
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc")

  const [interns, setInterns] = useState<InternRecord[]>([])
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  // --- Live time updates for "active" sessions ---
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // --- Fetch interns and logs data ---
  useEffect(() => {
    let isFirstLoad = true

    const fetchData = async () => {
      if (isFirstLoad) setLoading(true)
      setError(null)
      try {
        const internsRes = await fetch("/api/interns")
        if (!internsRes.ok) throw new Error("Failed to fetch interns")
        const internsData: InternRecord[] = await internsRes.json()

        const logsRes = await fetch("/api/time-logs")
        if (!logsRes.ok) throw new Error("Failed to fetch time logs")
        const logsData = await logsRes.json()
        const logsArray: TimeLog[] = Array.isArray(logsData) ? logsData : logsData.logs

        // Calculate completedHours from logs for each intern
        function truncateTo2Decimals(val: number) {
          const [int, dec = ""] = val.toString().split(".")
          return dec.length > 0 ? `${int}.${dec.slice(0, 2).padEnd(2, "0")}` : `${int}.00`
        }

        function getTruncatedDecimalHours(log: TimeLog) {
          if (!log.timeIn || !log.timeOut) return 0
          const inDate = new Date(log.timeIn)
          const outDate = new Date(log.timeOut)
          const diffMs = outDate.getTime() - inDate.getTime()
          const hours = Math.floor(diffMs / (1000 * 60 * 60))
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
          const decimal = hours + minutes / 60
          return Number(truncateTo2Decimals(decimal))
        }

        // Map interns with their completed hours
        const internsWithLogHours = internsData.map((intern) => {
          const internLogs = logsArray.filter(
            (log) => log.internId === intern.id
          )
          const completedHours = internLogs
            .filter((log) => log.timeIn && log.timeOut)
            .reduce((sum, log) => sum + getTruncatedDecimalHours(log), 0)
          return {
            ...intern,
            internshipDetails: {
              ...intern.internshipDetails,
              completedHours: Number(completedHours.toFixed(2)),
            },
          }
        })

        setInterns(internsWithLogHours)
        setLogs(logsArray)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data")
        setLogs([])
      } finally {
        if (isFirstLoad) setLoading(false)
        isFirstLoad = false
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  // --- Dashboard summary statistics ---
  const stats = useMemo(() => {
    if (!interns.length) return { totalInterns: 0, activeInterns: 0, totalRequiredHours: 0, totalCompletedHours: 0, avgProgress: "0.0" }
    const totalInterns = interns.length
    const activeInterns = interns.filter((intern) => intern.status === "in").length
    const totalRequiredHours = interns.reduce((acc, intern) => acc + intern.internshipDetails.requiredHours, 0)
    const totalCompletedHours = interns.reduce((acc, intern) => acc + intern.internshipDetails.completedHours, 0)
    const avgProgress = totalRequiredHours > 0 ? (totalCompletedHours / totalRequiredHours) * 100 : 0
    return {
      totalInterns,
      activeInterns,
      totalRequiredHours,
      totalCompletedHours,
      avgProgress: avgProgress.toFixed(1),
    }
  }, [interns])

  // --- Departments for filter ---
  const departments = useMemo(() => getDepartments(interns), [interns])

  // --- Filtered interns for overview table ---
  const filteredInterns = useMemo(() => {
    return interns.filter((intern) => {
      const fullName = `${intern.first_name} ${intern.last_name}`
      const matchesSearch =
        fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        intern.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        intern.school.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesDepartment = departmentFilter === "all" || intern.department === departmentFilter
      const matchesStatus = statusFilter === "all" || intern.status === statusFilter
      return matchesSearch && matchesDepartment && matchesStatus
    })
  }, [interns, searchTerm, departmentFilter, statusFilter])

  // --- Filtered logs for logs table ---
  const filteredLogs = useMemo(() => {
    function getLocalDateString(date: Date | string) {
      const d = typeof date === "string" ? new Date(date) : date
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, "0")
      const day = String(d.getDate()).padStart(2, "0")
      return `${year}-${month}-${day}`
    }

    const filterBySearchAndDept = (log: TimeLog) => {
      const matchesSearch =
        (log.internName ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.department ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.school ?? "").toLowerCase().includes(searchTerm.toLowerCase())
      const matchesDepartment = departmentFilter === "all" || log.department === departmentFilter
      return matchesSearch && matchesDepartment
    }

    let result = logs.filter(filterBySearchAndDept)

    if (viewMode === "overview") {
      const todayLocal = getLocalDateString(new Date())
      result = result.filter(
        log => {
          const logDate =
            log.date
              ? getLocalDateString(log.date)
              : log.timeIn
                ? getLocalDateString(log.timeIn)
                : ""
          return logDate === todayLocal
        }
      )
    } else if (viewMode === "logs" && selectedDate) {
      const selectedLocal = getLocalDateString(selectedDate)
      result = result.filter(log => {
        const logDate =
          log.date
            ? getLocalDateString(log.date)
            : log.timeIn
              ? getLocalDateString(log.timeIn)
              : ""
        return logDate === selectedLocal
      })
    }
    return result
  }, [logs, selectedDate, viewMode, searchTerm, departmentFilter])

  // --- Only auto-set sortDirection on viewMode change ---
  const lastViewMode = useRef(viewMode)
  useEffect(() => {
    if (lastViewMode.current !== viewMode) {
      if (viewMode === "logs") setSortDirection("asc")
      if (viewMode === "overview") setSortDirection("desc")
      lastViewMode.current = viewMode
    }
  }, [viewMode])

  /**
   * Group logs by intern and date for compact display in logs table
   */
  function groupLogsByInternAndDate(logs: TimeLog[]) {
    const grouped: Record<string, { logs: TimeLog[]; date: string }> = {}
    logs.forEach((log) => {
      const dateKey = (log.date || log.timeIn || "").slice(0, 10)
      const key = `${log.internId}-${dateKey}`
      if (!grouped[key]) grouped[key] = { logs: [], date: dateKey }
      grouped[key].logs.push(log)
    })
    return grouped
  }

  // --- Grouped logs for logs table ---
  const groupedLogs = useMemo(() => groupLogsByInternAndDate(filteredLogs), [filteredLogs])
  const groupedLogsArray = useMemo(() => {
    // Get entries as [key, { logs, date }]
    const entries = Object.entries(groupedLogs)
    // Sort by date property
    entries.sort((a, b) => {
      const aTime = new Date(a[1].date).getTime()
      const bTime = new Date(b[1].date).getTime()
      return sortDirection === "desc" ? bTime - aTime : aTime - bTime
    })
    // Return only the logs arrays
    return entries.map(([, group]) => group.logs)
  }, [groupedLogs, sortDirection])

  // --- Intern Profile Modal ---
  function handleViewInternDetails(internId: number) {
    setSelectedInternId(internId)
  }

  if (selectedInternId) {
    return (
      <InternProfile
        internId={String(selectedInternId)}
        onBack={() => setSelectedInternId(null)}
        editable={true}
      />
    )
  }

  // --- Daily Time Record Modal ---
  if (selectedDTRInternId) {
    return (
      <div>
        <Button variant="outline" onClick={() => setSelectedDTRInternId(null)} className="mb-4">
          ← Back to Dashboard
        </Button>
        <DailyTimeRecord internId={String(selectedDTRInternId)} />
      </div>
    )
  }

  // --- Main Dashboard Layout ---
  return (
    loading ? (
      <div className="p-8 text-center text-gray-500">Loading dashboard...</div>
    ) : error ? (
      <div className="p-8 text-center text-red-500">{error}</div>
    ) : (
      <div className="space-y-6">
        {/* --- View Mode Switch --- */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
          <div className="flex gap-2">
            <Button variant={viewMode === "overview" ? "default" : "outline"} onClick={() => setViewMode("overview")}>
              Overview
            </Button>
            <Button variant={viewMode === "logs" ? "default" : "outline"} onClick={() => setViewMode("logs")}>
              All Logs
            </Button>
          </div>
        </div>

        {/* --- Summary Cards --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Interns Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Interns</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalInterns}</div>
              <p className="text-xs text-muted-foreground">Active internships</p>
            </CardContent>
          </Card>

          {/* Currently Active Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Currently Active</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.activeInterns}</div>
              <p className="text-xs text-muted-foreground">Clocked in now</p>
            </CardContent>
          </Card>

          {/* Total Hours Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCompletedHours.toFixed(2)}h</div>
              <p className="text-xs text-muted-foreground">of {Math.round(stats.totalRequiredHours)}h</p>
            </CardContent>
          </Card>

          {/* Average Progress Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Progress</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgProgress}%</div>
              <p className="text-xs text-muted-foreground">Across all interns</p>
            </CardContent>
          </Card>
        </div>

        {/* --- Filters & Search Card --- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters & Search</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search input */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by name, email, or school..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Department filter */}
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept: string) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status filter (only in overview) */}
              {viewMode === "overview" && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="in">Clocked In</SelectItem>
                    <SelectItem value="out">Clocked Out</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {/* Date filter (only in logs mode) */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full sm:w-48"
                    disabled={viewMode === "overview"}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {viewMode === "overview"
                      ? format(new Date(), "MMM dd, yyyy")
                      : selectedDate
                        ? format(selectedDate, "MMM dd, yyyy")
                        : "All Dates"}
                  </Button>
                </PopoverTrigger>
                {viewMode !== "overview" && (
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate ?? undefined}
                      onSelect={(date) => setSelectedDate(date ?? null)}
                      initialFocus
                    />
                    <div className="p-2">
                      <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => setSelectedDate(null)}
                      >
                        All Dates
                      </Button>
                    </div>
                  </PopoverContent>
                )}
              </Popover>
            </div>
          </CardContent>
        </Card>

        {/* --- Overview Table --- */}
        {viewMode === "overview" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Intern Overview</CardTitle>
              <p className="text-sm text-gray-600">
                Showing {filteredInterns.length} of {interns.length} interns
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Intern Details</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Today&apos;s Duration</TableHead>
                      <TableHead>Internship Progress</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInterns.map((intern) => {
                      const progressPercentage =
                        (intern.internshipDetails.completedHours / intern.internshipDetails.requiredHours) * 100
                      return (
                        <TableRow key={intern.id}>
                          {/* Intern Details */}
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{intern.first_name} {intern.last_name}</div>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {intern.department}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {intern.school}
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                          {/* Status badges for today's logs */}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {intern.todayLogs?.length > 0 ? (
                                intern.todayLogs.map((log: TodayLog, idx: number) => (
                                  <span key={idx} className="flex items-center gap-2">
                                    {log.timeIn && (
                                      <Badge variant="outline" className="bg-green-50 text-green-700">
                                        In: {new Date(log.timeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                      </Badge>
                                    )}
                                    {log.timeOut && (
                                      <Badge variant="outline" className="bg-red-50 text-red-700">
                                        Out: {new Date(log.timeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                      </Badge>
                                    )}
                                    {!log.timeIn && !log.timeOut && (
                                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                                        Pending
                                      </Badge>
                                    )}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-500">No sessions</span>
                              )}
                            </div>
                          </TableCell>
                          {/* Today's total duration */}
                          <TableCell>
                            <span className="font-mono font-semibold">
                              {(() => {
                                const today = new Date().toISOString().slice(0, 10)
                                let totalMs = 0
                                if (intern.todayLogs && intern.todayLogs.length > 0) {
                                  intern.todayLogs.forEach(log => {
                                    if (log.timeIn && log.timeIn.slice(0, 10) === today) {
                                      const inDate = new Date(log.timeIn)
                                      const outDate = log.timeOut ? new Date(log.timeOut) : currentTime
                                      totalMs += outDate.getTime() - inDate.getTime()
                                    }
                                  })
                                }
                                const hours = Math.floor(totalMs / (1000 * 60 * 60))
                                const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60))
                                return `${hours}h ${minutes.toString().padStart(2, "0")}m`
                              })()}
                            </span>
                          </TableCell>
                          {/* Internship progress bar */}
                          <TableCell>
                            <div className="space-y-2 min-w-48">
                              <div className="flex justify-between text-sm">
                                <span className="font-medium">
                                  {intern.internshipDetails.completedHours < intern.internshipDetails.requiredHours
                                    ? "Ongoing"
                                    : "Completed"}
                                </span>
                                <span>
                                  {intern.internshipDetails.completedHours.toFixed(2)}h / {intern.internshipDetails.requiredHours}h
                                </span>
                              </div>
                              <Progress value={progressPercentage} className="h-2" />
                            </div>
                          </TableCell>
                          {/* Actions: View Profile / DTR */}
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end w-full">
                              <Button
                                size="icon"
                                variant="outline"
                                title="View Profile"
                                onClick={() => handleViewInternDetails(intern.id)}
                              >
                                <UserCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                title="View DTR"
                                onClick={() => setSelectedDTRInternId(intern.id)}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              {/* No interns found */}
              {filteredInterns.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No interns found matching your criteria.</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          // --- Logs Table ---
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">All Intern Logs</CardTitle>
                  <p className="text-sm text-gray-600">
                    Showing {groupedLogsArray.length} of {groupedLogsArray.length} time records
                  </p>
                </div>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))
                    }
                  >
                    Sort by Date&nbsp;
                    {sortDirection === "desc" ? "↓" : "↑"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Intern</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time In</TableHead>
                      <TableHead>Time Out</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Department</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedLogsArray.map((logsForDay) => {
                      const log = logsForDay[0]
                      const sortedLogs = [...logsForDay].sort((a, b) => {
                        if (!a.timeIn) return 1
                        if (!b.timeIn) return -1
                        return new Date(a.timeIn).getTime() - new Date(b.timeIn).getTime()
                      })
                      return (
                        <TableRow key={`${log.internId}-${(log.date || log.timeIn || "").slice(0, 10)}`}>
                          {/* Intern Name */}
                          <TableCell>
                            <div className="font-medium">{log.internName}</div>
                          </TableCell>
                          {/* Date */}
                          <TableCell className="font-medium">
                            {formatLogDate(
                              (log.date as string) ||
                              (log.timeIn as string) ||
                              ""
                            )}
                          </TableCell>
                          {/* Time In */}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {sortedLogs.map((l, idx) =>
                                l.timeIn ? (
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className="bg-green-50 text-green-700"
                                  >
                                    {new Date(l.timeIn).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </Badge>
                                ) : (
                                  <span key={idx} className="text-gray-400">--</span>
                                )
                              )}
                            </div>
                          </TableCell>
                          {/* Time Out */}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {sortedLogs.map((l, idx) =>
                                l.timeOut ? (
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className="bg-red-50 text-red-700"
                                  >
                                    {new Date(l.timeOut).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </Badge>
                                ) : l.timeIn ? (
                                  <div key={idx} className="flex justify-start">
                                    <Badge
                                      variant="outline"
                                      className="bg-yellow-50 text-yellow-700"
                                    >
                                      In Progress
                                    </Badge>
                                  </div>
                                ) : (
                                  <span key={idx} className="text-gray-400">--</span>
                                )
                              )}
                            </div>
                          </TableCell>
                          {/* Duration */}
                          <TableCell className="font-mono">
                            <div className="flex flex-col gap-1">
                              {sortedLogs.map((l, idx) =>
                                l.timeIn && l.timeOut ? (
                                  <span key={idx} className="font-semibold">
                                    {(() => {
                                      const inDate = new Date(l.timeIn)
                                      const outDate = new Date(l.timeOut)
                                      const diffMs = outDate.getTime() - inDate.getTime()
                                      const hours = Math.floor(diffMs / (1000 * 60 * 60))
                                      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                                      return `${hours}h ${minutes.toString().padStart(2, "0")}m`
                                    })()}
                                  </span>
                                ) : l.timeIn && !l.timeOut ? (
                                  <span key={idx} className="font-semibold">
                                    {(() => {
                                      const inDate = new Date(l.timeIn)
                                      const now = new Date()
                                      const diffMs = now.getTime() - inDate.getTime()
                                      const hours = Math.floor(diffMs / (1000 * 60 * 60))
                                      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                                      return `${hours}h ${minutes.toString().padStart(2, "0")}m`
                                    })()}
                                  </span>
                                ) : (
                                  <span key={idx} className="text-gray-400">--</span>
                                )
                              )}
                            </div>
                          </TableCell>
                          {/* Decimal Hours */}
                          <TableCell className="text-right font-mono">
                            <div className="flex flex-col gap-1">
                              {sortedLogs.map((l, idx) =>
                                l.timeIn && l.timeOut ? (
                                  <span key={idx} className="font-semibold text-blue-600">
                                    {(() => {
                                      const inDate = new Date(l.timeIn)
                                      const outDate = new Date(l.timeOut)
                                      const diffMs = outDate.getTime() - inDate.getTime()
                                      const hours = Math.floor(diffMs / (1000 * 60 * 60))
                                      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                                      const decimal = hours + minutes / 60
                                      return `${decimal.toFixed(2)}h`
                                    })()}
                                  </span>
                                ) : l.timeIn && !l.timeOut ? (
                                  <div key={idx} className="flex justify-end">
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                      Active
                                    </Badge>
                                  </div>
                                ) : (
                                  <span key={idx} className="text-gray-400">--</span>
                                )
                              )}
                            </div>
                          </TableCell>
                          {/* Department */}
                          <TableCell className="text-right">
                            <Badge variant="outline">{log.department}</Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              {/* No logs found */}
              {groupedLogsArray.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No logs found matching your criteria.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    )
  );
}