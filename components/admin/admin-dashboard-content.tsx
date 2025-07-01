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
import { DailyTimeRecord } from "@/components/intern/intern-dtr"
import { EditTimeLogDialog } from "@/components/edit-time-log-dialog"
import { calculateInternshipProgress, calculateTimeWorked, truncateTo2Decimals, getLocalDateString, getContinuousTime, filterLogsByInternId, DAILY_REQUIRED_HOURS } from "@/lib/time-utils"
import { formatLogDate, groupLogsByDate, TimeLogDisplay } from "@/lib/ui-utils"

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
  log_type?: "regular" | "overtime"
  overtime_status?: "pending" | "approved" | "rejected"
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
  const [isUpdatingTimeLog, setIsUpdatingTimeLog] = useState(false)

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

        // Map interns with their completed hours
        const internsWithLogHours = internsData.map((intern) => {
          const internLogs = logsArray.filter(
            (log) => log.internId === intern.id
          )
          // Use centralized calculation for consistent progress tracking
          const completedHours = calculateInternshipProgress(internLogs)
          return {
            ...intern,
            internshipDetails: {
              ...intern.internshipDetails,
              completedHours,
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

  // --- Time log update handler ---
  const handleTimeLogUpdate = async (logId: number, updates: { time_in?: string; time_out?: string }) => {
    setIsUpdatingTimeLog(true)
    try {
      const response = await fetch(`/api/admin/time-logs/${logId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error("Failed to update time log")
      }

      // Refresh the data
      const logsRes = await fetch("/api/time-logs")
      if (logsRes.ok) {
        const logsData = await logsRes.json()
        const logsArray: TimeLog[] = Array.isArray(logsData) ? logsData : logsData.logs
        setLogs(logsArray)
      }
    } catch (error) {
      console.error("Error updating time log:", error)
      // You could add a toast notification here
    } finally {
      setIsUpdatingTimeLog(false)
    }
  }

  // --- Time log delete handler ---
  const handleTimeLogDelete = async (logId: number) => {
    setIsUpdatingTimeLog(true)
    try {
      const response = await fetch(`/api/admin/time-logs/${logId}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error("Failed to delete time log")
      }

      // Refresh the data
      const logsRes = await fetch("/api/time-logs")
      if (logsRes.ok) {
        const logsData = await logsRes.json()
        const logsArray: TimeLog[] = Array.isArray(logsData) ? logsData : logsData.logs
        setLogs(logsArray)

        // Also refresh interns data to update completed hours
        const internsRes = await fetch("/api/interns")
        if (internsRes.ok) {
          const internsData: InternRecord[] = await internsRes.json()
          const internsWithLogHours = internsData.map((intern) => {
            const internLogs = logsArray.filter(
              (log: TimeLog) => log.internId === intern.id
            )
            const completedHours = calculateInternshipProgress(internLogs)
            return {
              ...intern,
              internshipDetails: {
                ...intern.internshipDetails,
                completedHours,
              },
            }
          })
          setInterns(internsWithLogHours)
        }
      }
    } catch (error) {
      console.error("Error deleting time log:", error)
      // You could add a toast notification here
    } finally {
      setIsUpdatingTimeLog(false)
    }
  }

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
      const todayLocal = getLocalDateString(new Date().toISOString())
      result = result.filter(
        log => {
          // Use timeIn as the primary source for date
          const logDate = log.timeIn 
            ? getLocalDateString(log.timeIn)
            : log.date
              ? getLocalDateString(log.date)
              : ""
          return logDate === todayLocal
        }
      )
    } else if (viewMode === "logs" && selectedDate) {
      const selectedLocal = getLocalDateString(selectedDate.toISOString())
      result = result.filter(log => {
        // Use timeIn as the primary source for date
        const logDate = log.timeIn
          ? getLocalDateString(log.timeIn)
          : log.date
            ? getLocalDateString(log.date)
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
   * Optimized grouping by intern and date for DTR-style display
   * Using the same groupLogsByDate function as DTR for consistency
   */
  const groupedLogsForDTR = useMemo(() => {
    // Convert TimeLog[] to TimeLogDisplay[] first
    const dtrStyleLogs: TimeLogDisplay[] = filteredLogs.map(log => ({
      id: log.id,
      time_in: log.timeIn,
      time_out: log.timeOut,
      status: "completed" as const,
      log_type: log.log_type,
      overtime_status: log.overtime_status,
      user_id: log.internId,
      internId: log.internId,
      hoursWorked: log.hoursWorked,
      duration: log.duration,
    }))

    // Use the same grouping logic as DTR
    const grouped = groupLogsByDate(dtrStyleLogs)
    
    // Add intern info to each group and sort by date
    const groupsWithInternInfo = grouped.map(([key, logs]) => {
      const datePart = key.split("-").slice(-3).join("-")
      const firstOriginalLog = filteredLogs.find(originalLog => 
        originalLog.internId === logs[0]?.user_id && 
        (originalLog.timeIn?.slice(0, 10) === datePart || originalLog.date?.slice(0, 10) === datePart)
      )
      return {
        key,
        logs,
        datePart,
        internName: firstOriginalLog?.internName || "Unknown",
        department: firstOriginalLog?.department || "Unknown"
      }
    })

    // Sort by date based on sortDirection
    groupsWithInternInfo.sort((a, b) => {
      const aTime = new Date(a.datePart).getTime()
      const bTime = new Date(b.datePart).getTime()
      return sortDirection === "desc" ? bTime - aTime : aTime - bTime
    })

    return groupsWithInternInfo
  }, [filteredLogs, sortDirection])

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
    const refreshData = async () => {
      // Refresh logs data after deletion/update
      const logsRes = await fetch("/api/time-logs")
      if (logsRes.ok) {
        const logsData = await logsRes.json()
        const logsArray: TimeLog[] = Array.isArray(logsData) ? logsData : logsData.logs
        setLogs(logsArray)

        // Also refresh interns data to update completed hours
        const internsRes = await fetch("/api/interns")
        if (internsRes.ok) {
          const internsData: InternRecord[] = await internsRes.json()
          const internsWithLogHours = internsData.map((intern) => {
            const internLogs = logsArray.filter(
              (log: TimeLog) => log.internId === intern.id
            )
            const completedHours = calculateInternshipProgress(internLogs)
            return {
              ...intern,
              internshipDetails: {
                ...intern.internshipDetails,
                completedHours,
              },
            }
          })
          setInterns(internsWithLogHours)
        }
      }
    }

    return (
      <div>
        <Button variant="outline" onClick={() => setSelectedDTRInternId(null)} className="mb-4">
          ← Back to Dashboard
        </Button>
        <DailyTimeRecord internId={String(selectedDTRInternId)} onRefresh={refreshData} />
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
                                const today = getLocalDateString(new Date().toISOString())
                                let totalHours = 0
                                if (intern.todayLogs && intern.todayLogs.length > 0) {
                                  intern.todayLogs.forEach(log => {
                                    if (log.timeIn && getLocalDateString(log.timeIn) === today) {
                                      const outTime = log.timeOut ? log.timeOut : currentTime.toISOString()
                                      const result = calculateTimeWorked(log.timeIn, outTime)
                                      totalHours += result.hoursWorked
                                    }
                                  })
                                }
                                // Convert total hours back to hours and minutes format
                                const hours = Math.floor(totalHours)
                                const minutes = Math.floor((totalHours % 1) * 60)
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
          // --- Logs Table (DTR Style) ---
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">All Intern Logs</CardTitle>
                  <p className="text-sm text-gray-600">
                    Showing {groupedLogsForDTR.length} of {groupedLogsForDTR.length} time records
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
                      <TableHead>Regular Shift</TableHead>
                      <TableHead>Overtime</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedLogsForDTR.map((group) => {
                      const { key, logs: logsForDate, datePart, internName, department } = group
                      
                      // Convert TimeLog[] to TimeLogDisplay[] for DTR processing
                      const dtrLogs: TimeLogDisplay[] = logsForDate

                      // Process logs exactly like DTR
                      const regularLogs = dtrLogs.filter(log => !log.log_type || log.log_type === "regular")
                      const overtimeLogs = dtrLogs.filter(log => log.log_type === "overtime" || log.log_type === "extended_overtime")
                      const allLogs = [...regularLogs, ...overtimeLogs].sort((a, b) => {
                        const aTime = a.time_in || a.time_out || ""
                        const bTime = b.time_in || b.time_out || ""
                        return new Date(aTime).getTime() - new Date(bTime).getTime()
                      })

                      // Group logs into continuous sessions (DTR logic)
                      const isContinuous = (log1: TimeLogDisplay, log2: TimeLogDisplay): boolean => {
                        if (!log1.time_out || !log2.time_in) return false
                        const gap = new Date(log2.time_in).getTime() - new Date(log1.time_out).getTime()
                        return gap <= 60 * 1000
                      }
                      const sessions: TimeLogDisplay[][] = []
                      let currentSession: TimeLogDisplay[] = []
                      for (const log of allLogs) {
                        if (currentSession.length === 0) {
                          currentSession = [log]
                        } else {
                          const lastLog = currentSession[currentSession.length - 1]
                          if (isContinuous(lastLog, log)) {
                            currentSession.push(log)
                          } else {
                            sessions.push(currentSession)
                            currentSession = [log]
                          }
                        }
                      }
                      if (currentSession.length > 0) sessions.push(currentSession)

                      // Calculate totals (DTR logic)
                      let totalRegularHours = 0
                      let totalOvertimeHours = 0
                      let overallOvertimeStatus = "none"
                      for (const session of sessions) {
                        for (const log of session) {
                          if (log.time_in && log.time_out) {
                            const result = calculateTimeWorked(log.time_in, log.time_out)
                            const logHours = result.hoursWorked
                            if (log.log_type === "overtime" || log.log_type === "extended_overtime") {
                              totalOvertimeHours += logHours
                              if (log.overtime_status === "approved" && overallOvertimeStatus !== "rejected") {
                                overallOvertimeStatus = "approved"
                              } else if ((!log.overtime_status || log.overtime_status === "pending") && overallOvertimeStatus === "none") {
                                overallOvertimeStatus = "pending"
                              } else if (log.overtime_status === "rejected") {
                                overallOvertimeStatus = "rejected"
                              }
                            } else {
                              totalRegularHours += logHours
                            }
                          }
                        }
                      }
                      if (totalRegularHours > DAILY_REQUIRED_HOURS) {
                        // Cap regular hours at DAILY_REQUIRED_HOURS, move excess to overtime
                        const excess = totalRegularHours - DAILY_REQUIRED_HOURS
                        totalRegularHours = DAILY_REQUIRED_HOURS
                        totalOvertimeHours += excess
                      }
                      // If any overtime log is rejected, set overtime to 0 and cap regular at DAILY_REQUIRED_HOURS
                      if (overallOvertimeStatus === "rejected") {
                        totalRegularHours = Math.min(totalRegularHours, DAILY_REQUIRED_HOURS)
                        totalOvertimeHours = 0
                      }

                      return (
                        <TableRow key={key}>
                          {/* Intern Name */}
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{internName}</div>
                              <Badge variant="outline" className="text-xs">
                                {department}
                              </Badge>
                            </div>
                          </TableCell>
                          {/* Date */}
                          <TableCell className="font-medium">
                            <div className="flex flex-col items-start">
                              <span className="text-xs text-gray-500">
                                {new Date(datePart).toLocaleDateString("en-US", { weekday: "short" })}
                              </span>
                              <span>{formatLogDate(datePart)}</span>
                            </div>
                          </TableCell>
                          {/* Time In - Show all session time ins like DTR */}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {sessions.map((session, i) => {
                                const sessionTimeIn = session[0]?.time_in
                                const isOvertimeSession = session.every(log => log.log_type === "overtime" || log.log_type === "extended_overtime")
                                const overtimeStatus = isOvertimeSession ? session[0]?.overtime_status : null
                                return sessionTimeIn ? (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className={
                                      isOvertimeSession
                                        ? overtimeStatus === "approved"
                                          ? "bg-purple-100 text-purple-700 border-purple-300"
                                          : overtimeStatus === "rejected"
                                            ? "bg-gray-100 text-gray-700 border-gray-300"
                                            : "bg-yellow-100 text-yellow-700 border-yellow-300"
                                        : "bg-green-100 text-green-700 border-green-300"
                                    }
                                  >
                                    {new Date(sessionTimeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </Badge>
                                ) : null
                              })}
                            </div>
                          </TableCell>
                          {/* Time Out - Show all session time outs like DTR */}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {sessions.map((session, i) => {
                                const isOvertimeSession = session.every(log => log.log_type === "overtime" || log.log_type === "extended_overtime")
                                const overtimeStatus = isOvertimeSession ? session[0]?.overtime_status : null
                                const lastLog = session[session.length - 1]
                                const sessionTimeOut = lastLog?.time_out || null
                                if (sessionTimeOut) {
                                  return (
                                    <Badge
                                      key={i}
                                      variant="outline"
                                      className={
                                        isOvertimeSession
                                          ? overtimeStatus === "approved"
                                            ? "bg-purple-100 text-purple-700 border-purple-300"
                                            : overtimeStatus === "rejected"
                                              ? "bg-gray-100 text-gray-700 border-gray-300"
                                              : "bg-yellow-100 text-yellow-700 border-yellow-300"
                                          : "bg-red-100 text-red-700 border-red-300"
                                      }
                                    >
                                      {new Date(sessionTimeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </Badge>
                                  )
                                } else {
                                  return (
                                    <Badge key={i} variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                                      In Progress
                                    </Badge>
                                  )
                                }
                              })}
                            </div>
                          </TableCell>
                          {/* Regular Shift - Show per session + total like DTR */}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {sessions.map((session, i) => {
                                const isOvertimeOnlySession = session.every(log => log.log_type === "overtime" || log.log_type === "extended_overtime")
                                if (isOvertimeOnlySession) {
                                  return (
                                    <Badge key={i} variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">
                                      0h 00m
                                    </Badge>
                                  )
                                } else {
                                  // Calculate regular hours for this session
                                  let sessionRegularHours = 0
                                  for (const log of session) {
                                    if (log.log_type === "regular" || !log.log_type) {
                                      if (log.time_in && log.time_out) {
                                        const result = calculateTimeWorked(log.time_in, log.time_out)
                                        sessionRegularHours += result.hoursWorked
                                      }
                                    }
                                  }
                                  const cappedHours = Math.min(sessionRegularHours, DAILY_REQUIRED_HOURS)
                                  const displayHours = Math.floor(cappedHours)
                                  const displayMinutes = Math.round((cappedHours % 1) * 60)
                                  return (
                                    <Badge
                                      key={i}
                                      variant="outline"
                                      className={cappedHours > 0 ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-gray-100 text-gray-700 border-gray-300"}
                                    >
                                      {`${displayHours}h ${displayMinutes.toString().padStart(2, '0')}m`}
                                    </Badge>
                                  )
                                }
                              })}
                              {sessions.length > 1 &&
                                sessions.some(session => !session.every(log => log.log_type === "overtime" || log.log_type === "extended_overtime")) &&
                                sessions.filter(session => session.some(log => log.log_type !== "overtime" && log.log_type !== "extended_overtime")).length > 1 && (
                                  <Badge
                                    variant="outline"
                                    className={
                                      totalRegularHours > 0
                                        ? "bg-blue-200 text-blue-800 border-blue-400 font-medium"
                                        : "bg-gray-100 text-gray-700 border-gray-300"
                                    }
                                  >
                                    {truncateTo2Decimals(totalRegularHours)}h
                                  </Badge>
                                )}
                            </div>
                          </TableCell>
                          {/* Overtime - Show per session like DTR */}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {sessions.map((session, i) => {
                                let sessionOvertimeHours = 0
                                let sessionOvertimeStatus = "none"
                                for (const log of session) {
                                  if (log.log_type === "overtime" || log.log_type === "extended_overtime") {
                                    if (log.time_in && log.time_out) {
                                      const result = calculateTimeWorked(log.time_in, log.time_out)
                                      sessionOvertimeHours += result.hoursWorked
                                    }
                                    if (log.overtime_status === "approved") {
                                      sessionOvertimeStatus = "approved"
                                    } else if (log.overtime_status === "rejected") {
                                      sessionOvertimeStatus = "rejected"
                                    } else if (sessionOvertimeStatus === "none") {
                                      sessionOvertimeStatus = "pending"
                                    }
                                  }
                                }
                                const displayHours = Math.floor(sessionOvertimeHours)
                                const displayMinutes = Math.round((sessionOvertimeHours % 1) * 60)
                                return (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className={
                                      displayHours === 0 && displayMinutes === 0
                                        ? "bg-gray-100 text-gray-700 border-gray-300"
                                        : sessionOvertimeStatus === "approved"
                                          ? "bg-purple-100 text-purple-700 border-purple-300"
                                          : sessionOvertimeStatus === "rejected"
                                            ? "bg-gray-100 text-gray-700 border-gray-300"
                                            : "bg-yellow-100 text-yellow-700 border-yellow-300"
                                    }
                                  >
                                    {`${displayHours}h ${displayMinutes.toString().padStart(2, '0')}m`}
                                  </Badge>
                                )
                              })}
                            </div>
                          </TableCell>
                          {/* Actions: Only one pencil per date, pass all logs for the date */}
                          <TableCell className="text-right">
                            <div className="flex flex-col gap-1 items-end">
                              <EditTimeLogDialog
                                key={key}
                                logs={dtrLogs}
                                onSave={handleTimeLogUpdate}
                                onDelete={handleTimeLogDelete}
                                isLoading={isUpdatingTimeLog}
                                isAdmin={true}
                                isIntern={false}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              {/* No logs found */}
              {groupedLogsForDTR.length === 0 && (
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