/**
 * HRAdminDashboard (Admin Dashboard)
 *
 * This component provides a comprehensive dashboard for HR/Admin users to:
 * - View summary statistics of interns and their progress
 * - Filter and search interns and logs by department, status, and date
 * - Switch between overview and detailed logs (DTR-style) views
 * - View, edit, and manage intern time logs and profiles
 * - Real-time updates for active sessions and log changes
 *
 * Main Features:
 * - Summary cards for total interns, active, hours, and progress
 * - Overview table: intern details, status, shift/overtime, progress, actions
 * - Logs table: grouped by intern/date, DTR-style, edit/delete logs
 * - Filters: search, department, status, date
 * - Modals for intern profile and DTR view
 * - Centralized time/session processing and statistics
 *
 * Dependencies: UI components, hooks, and utilities from /components/ui and /lib
 */

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
import { calculateTimeStatistics, getLocalDateString } from "@/lib/time-utils"
import { formatLogDate, groupLogsByDate, TimeLogDisplay, useSortDirection } from "@/lib/ui-utils"
import { processTimeLogSessions, getTimeBadgeProps, createDurationBadges } from "@/lib/session-utils"

// --- Types ---
type TodayLog = {
  timeIn: string | null
  timeOut: string | null
  status: string
  label: string
  logType?: string | null
  overtimeStatus?: string | null
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

// --- Utility: Get unique departments from interns ---
function getDepartments(interns: InternRecord[]): string[] {
  const set = new Set<string>()
  interns.forEach((intern) => {
    if (intern.department) set.add(intern.department)
  })
  return Array.from(set)
}

/**
 * HRAdminDashboard: Main dashboard component for HR/Admins
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
  const { sortDirection, setSortDirection, toggleSort, sortButtonText } = useSortDirection("desc")
  const [showEditActions, setShowEditActions] = useState(false)
  const [interns, setInterns] = useState<InternRecord[]>([])
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isUpdatingTimeLog, setIsUpdatingTimeLog] = useState(false)

  // --- Live time updates for active sessions ---
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
        const internsWithLogHours = await Promise.all(internsData.map(async (intern) => {
          const internLogs = logsArray.filter(log => log.internId === intern.id)
          const stats = await calculateTimeStatistics(internLogs, intern.id, {
            includeEditRequests: true,
            requiredHours: intern.internshipDetails?.requiredHours || 0
          })
          return {
            ...intern,
            internshipDetails: {
              ...intern.internshipDetails,
              completedHours: stats.internshipProgress,
            },
          }
        }))
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
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  // --- Time log delete handler ---
  const handleTimeLogDelete = async (logId: number) => {
    setIsUpdatingTimeLog(true)
    try {
      const response = await fetch(`/api/admin/time-logs/${logId}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!response.ok) throw new Error("Failed to delete time log")
      const logsRes = await fetch("/api/time-logs")
      if (logsRes.ok) {
        const logsData = await logsRes.json()
        const logsArray: TimeLog[] = Array.isArray(logsData) ? logsData : logsData.logs
        setLogs(logsArray)
        const internsRes = await fetch("/api/interns")
        if (internsRes.ok) {
          const internsData: InternRecord[] = await internsRes.json()
          const internsWithLogHours = await Promise.all(internsData.map(async (intern) => {
            const internLogs = logsArray.filter((log: TimeLog) => log.internId === intern.id)
            const stats = await calculateTimeStatistics(internLogs, intern.id, {
              includeEditRequests: true,
              requiredHours: intern.internshipDetails?.requiredHours || 0
            })
            return {
              ...intern,
              internshipDetails: {
                ...intern.internshipDetails,
                completedHours: stats.internshipProgress,
              },
            }
          }))
          setInterns(internsWithLogHours)
        }
      }
    } catch {
      // Optionally add a toast notification here
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
      let matchesStatus = false
      if (statusFilter === "all") matchesStatus = true
      else if (statusFilter === "no_sessions") matchesStatus = !intern.todayLogs || intern.todayLogs.length === 0
      else if (statusFilter === "in") matchesStatus = intern.status === "in" && intern.todayLogs && intern.todayLogs.length > 0
      else if (statusFilter === "out") matchesStatus = intern.status === "out" && intern.todayLogs && intern.todayLogs.length > 0
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
      result = result.filter(log => {
        const logDate = log.timeIn 
          ? getLocalDateString(log.timeIn)
          : log.date
            ? getLocalDateString(log.date)
            : ""
        return logDate === todayLocal
      })
    } else if (viewMode === "logs" && selectedDate) {
      const selectedLocal = getLocalDateString(selectedDate.toISOString())
      result = result.filter(log => {
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
      setSortDirection("desc")
      lastViewMode.current = viewMode
    }
  }, [viewMode, setSortDirection])

  // --- Group logs for DTR-style display ---
  const groupedLogsForDTR = useMemo(() => {
    const dtrStyleLogs: TimeLogDisplay[] = filteredLogs.map(log => ({
      id: log.id,
      time_in: log.timeIn,
      time_out: log.timeOut,
      status: log.timeOut ? "completed" as const : "pending" as const,
      log_type: log.log_type,
      overtime_status: log.overtime_status,
      user_id: log.internId,
      internId: log.internId,
      hoursWorked: log.hoursWorked,
      duration: log.duration,
    }))
    const grouped = groupLogsByDate(dtrStyleLogs)
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
      const logsRes = await fetch("/api/time-logs")
      if (logsRes.ok) {
        const logsData = await logsRes.json()
        const logsArray: TimeLog[] = Array.isArray(logsData) ? logsData : logsData.logs
        setLogs(logsArray)
        const internsRes = await fetch("/api/interns")
        if (internsRes.ok) {
          const internsData: InternRecord[] = await internsRes.json()
          const internsWithLogHours = await Promise.all(internsData.map(async (intern) => {
            const internLogs = logsArray.filter((log: TimeLog) => log.internId === intern.id)
            const stats = await calculateTimeStatistics(internLogs, intern.id, {
              includeEditRequests: true,
              requiredHours: intern.internshipDetails?.requiredHours || 0
            })
            return {
              ...intern,
              internshipDetails: {
                ...intern.internshipDetails,
                completedHours: stats.internshipProgress,
              },
            }
          }))
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
                    <SelectItem value="no_sessions">No sessions</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {/* Date filter (only in logs mode) */}
              <Popover>
                <PopoverTrigger asChild>
                  <div className="relative" data-tooltip-id="date-filter-tooltip">
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
                    {viewMode === "overview" && (
                      <div className="absolute inset-0 cursor-help" title="Overview only displays today's sessions." />
                    )}
                  </div>
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
                      <TableHead>Regular Shift</TableHead>
                      <TableHead>Overtime</TableHead>
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
                          {/* Status badges for today's logs - Group continuous sessions */}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {intern.todayLogs?.length > 0 ? (
                                (() => {
                                  // Convert TodayLog to TimeLogDisplay format
                                  const timeLogDisplays: TimeLogDisplay[] = intern.todayLogs.map((log, idx) => ({
                                    id: idx, // Use index as ID since TodayLog doesn't have IDs
                                    time_in: log.timeIn,
                                    time_out: log.timeOut,
                                    status: log.timeOut ? 'completed' as const : 'pending' as const,
                                    user_id: intern.id,
                                    log_type: log.label?.includes('overtime') ? 'overtime' as const : 'regular' as const,
                                    created_at: log.timeIn || new Date().toISOString(),
                                    updated_at: log.timeOut || new Date().toISOString()
                                  }))
                                  
                                  // Process into sessions
                                  const { sessions } = processTimeLogSessions(timeLogDisplays, currentTime)
                                  
                                  // Group sessions by continuity for display (similar to DTR logic)
                                  const displaySessions = []
                                  for (let i = 0; i < sessions.length; i++) {
                                    const session = sessions[i]
                                    
                                    // For continuous sessions, only show one in/out pair
                                    let showTimeIn = true
                                    let showTimeOut = true
                                    
                                    if (session.isContinuousSession && i > 0) {
                                      const prevSession = sessions[i - 1]
                                      if (prevSession && prevSession.isContinuousSession) {
                                        showTimeIn = false // Skip showing duplicate time-in for continuous sessions
                                      }
                                    }
                                    
                                    if (session.isContinuousSession && i < sessions.length - 1) {
                                      const nextSession = sessions[i + 1]
                                      if (nextSession && nextSession.isContinuousSession) {
                                        showTimeOut = false // Skip showing intermediate time-outs for continuous sessions
                                      }
                                    }
                                    
                                    displaySessions.push(
                                      <span key={i} className="flex items-center gap-2">
                                        {session.timeIn && showTimeIn && (
                                          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                                            In: {new Date(session.timeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                          </Badge>
                                        )}
                                        {session.timeOut && showTimeOut && (
                                          <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                                            Out: {new Date(session.timeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                          </Badge>
                                        )}
                                        {session.isActive && (
                                          <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                                            In Progress
                                          </Badge>
                                        )}
                                      </span>
                                    )
                                  }
                                  
                                  return displaySessions.length > 0 ? displaySessions : (
                                    <span className="text-gray-500">No sessions</span>
                                  )
                                })()
                              ) : (
                                <span className="text-gray-500">No sessions</span>
                              )}
                            </div>
                          </TableCell>
                          {/* Today's Regular Shift duration */}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {(() => {
                                if (!intern.todayLogs || intern.todayLogs.length === 0) {
                                  return (
                                    <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">
                                      0h 00m
                                    </Badge>
                                  )
                                }
                                
                                // Convert TodayLog to TimeLogDisplay format
                                const timeLogDisplays: TimeLogDisplay[] = intern.todayLogs.map((log, idx) => ({
                                  id: idx,
                                  time_in: log.timeIn,
                                  time_out: log.timeOut,
                                  status: log.timeOut ? 'completed' as const : 'pending' as const,
                                  user_id: intern.id,
                                  log_type: (log.logType === 'overtime' || log.logType === 'extended_overtime') 
                                    ? log.logType as 'overtime' | 'extended_overtime'
                                    : 'regular' as const,
                                  overtime_status: (log.overtimeStatus === 'pending' || log.overtimeStatus === 'approved' || log.overtimeStatus === 'rejected')
                                    ? log.overtimeStatus as 'pending' | 'approved' | 'rejected'
                                    : undefined,
                                  created_at: log.timeIn || new Date().toISOString(),
                                  updated_at: log.timeOut || new Date().toISOString()
                                }))
                                
                                const { sessions } = processTimeLogSessions(timeLogDisplays, currentTime)
                                const durationBadges = createDurationBadges(sessions, currentTime, "regular")
                                
                                return durationBadges.map((badge, i) => (
                                  <Badge key={i} variant={badge.variant} className={badge.className}>
                                    {badge.text}
                                  </Badge>
                                ))
                              })()}
                            </div>
                          </TableCell>
                          {/* Today's Overtime duration */}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {(() => {
                                if (!intern.todayLogs || intern.todayLogs.length === 0) {
                                  return (
                                    <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">
                                      0h 00m
                                    </Badge>
                                  )
                                }
                                
                                // Convert TodayLog to TimeLogDisplay format
                                const timeLogDisplays: TimeLogDisplay[] = intern.todayLogs.map((log, idx) => ({
                                  id: idx,
                                  time_in: log.timeIn,
                                  time_out: log.timeOut,
                                  status: log.timeOut ? 'completed' as const : 'pending' as const,
                                  user_id: intern.id,
                                  log_type: (log.logType === 'overtime' || log.logType === 'extended_overtime') 
                                    ? log.logType as 'overtime' | 'extended_overtime'
                                    : 'regular' as const,
                                  overtime_status: (log.overtimeStatus === 'pending' || log.overtimeStatus === 'approved' || log.overtimeStatus === 'rejected')
                                    ? log.overtimeStatus as 'pending' | 'approved' | 'rejected'
                                    : undefined,
                                  created_at: log.timeIn || new Date().toISOString(),
                                  updated_at: log.timeOut || new Date().toISOString()
                                }))
                                
                                const { sessions } = processTimeLogSessions(timeLogDisplays, currentTime)
                                const durationBadges = createDurationBadges(sessions, currentTime, "overtime")
                                
                                return durationBadges.map((badge, i) => (
                                  <Badge key={i} variant={badge.variant} className={badge.className}>
                                    {badge.text}
                                  </Badge>
                                ))
                              })()}
                            </div>
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSort}
                  >
                    {sortButtonText}
                  </Button>
                  {/* Add toggle for edit actions column - following intern DTR pattern */}
                  {!showEditActions ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowEditActions(true)}
                      type="button"
                    >
                      Edit Logs
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowEditActions(false)}
                      type="button"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-50 whitespace-nowrap pr-16">Intern</TableHead>
                      <TableHead className="w-45 whitespace-nowrap pr-16">Date</TableHead>
                      <TableHead>Time In</TableHead>
                      <TableHead>Time Out</TableHead>
                      <TableHead>Regular Shift</TableHead>
                      <TableHead>Overtime</TableHead>
                      {showEditActions && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedLogsForDTR.map((group) => {
                      const { key, logs: logsForDate, datePart, internName, department } = group
                      
                      // Use centralized session processing with real-time updates
                      const { sessions } = processTimeLogSessions(logsForDate, currentTime)

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
                          <TableCell className="font-medium w-45 whitespace-nowrap pr-16">
                            <div className="flex flex-col items-start">
                              {(() => {
                                // Find the earliest timeIn and latest timeOut in the sessions for this date group
                                const validTimeIns = sessions.map(s => s.timeIn).filter((d): d is string => !!d)
                                const validTimeOuts = sessions.map(s => s.timeOut).filter((d): d is string => !!d)
                                let minTimeIn: Date | null = null
                                let maxTimeOut: Date | null = null
                                if (validTimeIns.length) {
                                  minTimeIn = new Date(validTimeIns.reduce((a, b) => (new Date(a) < new Date(b) ? a : b)))
                                }
                                if (validTimeOuts.length) {
                                  maxTimeOut = new Date(validTimeOuts.reduce((a, b) => (new Date(a) > new Date(b) ? a : b)))
                                }
                                // Format: MMM d, yyyy (e.g., Jun 19, 2025)
                                const formatDate = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                const formatDay = (date: Date) => date.toLocaleDateString("en-US", { weekday: "short" })
                                // If any session is active (in progress), use minTimeIn for day and date
                                const anyActive = sessions.some(s => s.isActive)
                                if (anyActive && minTimeIn) {
                                  // Always show day above date for active sessions
                                  return (
                                    <>
                                      <span className="text-xs text-gray-500">{formatDay(minTimeIn)}</span>
                                      <span>{formatDate(minTimeIn)}</span>
                                    </>
                                  )
                                } else if (minTimeIn && maxTimeOut) {
                                  const startDate = formatDate(minTimeIn)
                                  const endDate = formatDate(maxTimeOut)
                                  const startDay = formatDay(minTimeIn)
                                  const endDay = formatDay(maxTimeOut)
                                  if (startDate !== endDate) {
                                    // Spans two dates, show as range with days above
                                    return (
                                      <>
                                        <span className="text-xs text-gray-500">{startDay} – {endDay}</span>
                                        <span>{startDate} – {endDate}</span>
                                      </>
                                    )
                                  } else {
                                    // Single date, show day above
                                    return (
                                      <>
                                        <span className="text-xs text-gray-500">{startDay}</span>
                                        <span>{startDate}</span>
                                      </>
                                    )
                                  }
                                } else {
                                  // Fallback to original logic
                                  return (
                                    <span>{formatLogDate(datePart)}</span>
                                  )
                                }
                              })()}
                            </div>
                          </TableCell>
                          {/* Time In - Group continuous sessions */}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {(() => {
                                // Group sessions by continuity for display
                                const displaySessions = []
                                for (let i = 0; i < sessions.length; i++) {
                                  const session = sessions[i]
                                  if (!session.timeIn) continue
                                  
                                  // If this is a continuous session, only show the first time in
                                  if (session.isContinuousSession && i > 0) {
                                    const prevSession = sessions[i - 1]
                                    if (prevSession && prevSession.isContinuousSession) {
                                      continue // Skip showing duplicate time-in for continuous sessions
                                    }
                                  }
                                  
                                  const badgeProps = getTimeBadgeProps(
                                    session.timeIn,
                                    session.isContinuousSession ? "regular" : session.sessionType,
                                    "in",
                                    session.overtimeStatus,
                                    session.isContinuousSession
                                  )
                                  
                                  displaySessions.push(
                                    <Badge key={i} variant="outline" className={badgeProps.className}>
                                      {badgeProps.text}
                                    </Badge>
                                  )
                                }
                                return displaySessions
                              })()}
                            </div>
                          </TableCell>
                          {/* Time Out - Group continuous sessions */}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {(() => {
                                // Group sessions by continuity for display
                                const displaySessions = []
                                for (let i = 0; i < sessions.length; i++) {
                                  const session = sessions[i]
                                  
                                  // For continuous sessions, only show the last time out
                                  if (session.isContinuousSession && i < sessions.length - 1) {
                                    const nextSession = sessions[i + 1]
                                    if (nextSession && nextSession.isContinuousSession) {
                                      continue // Skip showing intermediate time-outs for continuous sessions
                                    }
                                  }
                                  
                                  if (session.timeOut) {
                                    const badgeProps = getTimeBadgeProps(
                                      session.timeOut,
                                      session.isContinuousSession ? "regular" : session.sessionType,
                                      "out",
                                      session.overtimeStatus,
                                      session.isContinuousSession
                                    )
                                    displaySessions.push(
                                      <Badge key={i} variant="outline" className={badgeProps.className}>
                                        {badgeProps.text}
                                      </Badge>
                                    )
                                  } else {
                                    const badgeProps = getTimeBadgeProps(null, session.sessionType, "active")
                                    displaySessions.push(
                                      <Badge key={i} variant="outline" className={badgeProps.className}>
                                        {badgeProps.text}
                                      </Badge>
                                    )
                                  }
                                }
                                return displaySessions
                              })()}
                            </div>
                          </TableCell>
                          {/* Regular Shift - Show per session with accurate real-time calculation */}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {(() => {
                                const durationBadges = createDurationBadges(sessions, currentTime, "regular")
                                return durationBadges.map((badge, i) => (
                                  <Badge key={i} variant={badge.variant} className={badge.className}>
                                    {badge.text}
                                  </Badge>
                                ))
                              })()}
                            </div>
                          </TableCell>
                          {/* Overtime - Show per session with accurate real-time calculation */}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {(() => {
                                const durationBadges = createDurationBadges(sessions, currentTime, "overtime")
                                return durationBadges.map((badge, i) => (
                                  <Badge key={i} variant={badge.variant} className={badge.className}>
                                    {badge.text}
                                  </Badge>
                                ))
                              })()}
                            </div>
                          </TableCell>
                          {/* Actions: Only one pencil per date, pass all logs for the date */}
                          {showEditActions && (
                            <TableCell className="text-right">
                              <div className="flex flex-col gap-1 items-end">
                                <EditTimeLogDialog
                                  key={key}
                                  logs={logsForDate}
                                  onDelete={handleTimeLogDelete}
                                  isLoading={isUpdatingTimeLog}
                                  isAdmin={true}
                                  isIntern={false}
                                />
                              </div>
                            </TableCell>
                          )}
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