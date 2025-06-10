"use client"

import { useState, useMemo, useEffect } from "react"
import { Search, Download, Clock, Users, TrendingUp, Calendar, FileText, UserCircle } from "lucide-react"
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
import { cn } from "@/lib/utils"
import { AdminInternProfile } from "./admin-intern-profile"

interface InternRecord {
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
}

interface TimeLog {
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

function getTodayString() {
  const now = new Date()
  return now.toISOString().split("T")[0]
}

function getTodayLog(logs: TimeLog[], internId: number) {
  const today = getTodayString()
  return logs.find(
    (log) =>
      log.internId === internId &&
      log.date &&
      log.date.slice(0, 10) === today
  )
}

function getRealTimeHours(log: TimeLog | undefined) {
  if (!log || !log.timeIn) return 0
  const inDate = new Date(log.timeIn)
  const outDate = log.timeOut ? new Date(log.timeOut) : new Date()
  const diffMs = outDate.getTime() - inDate.getTime()
  const hours = diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0
  return Number(hours.toFixed(2))
}

// Add this helper to format duration as "Xh YYm"
function formatDurationHM(hours: number, minutes: number) {
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`
}

export function HRAdminDashboard() {
  const [searchTerm, setSearchTerm] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedInternId, setSelectedInternId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<"overview" | "logs">("overview")

  // Real data state
  const [interns, setInterns] = useState<InternRecord[]>([])
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        // Fetch interns
        const internsRes = await fetch("/api/interns")
        if (!internsRes.ok) {
          const errorText = await internsRes.text()
          throw new Error("Failed to fetch interns: " + errorText)
        }
        const internsData = await internsRes.json()
        console.log("Fetched interns:", internsData) // <-- LOG
        setInterns(internsData)

        // Fetch logs
        const logsRes = await fetch("/api/time-logs")
        if (!logsRes.ok) {
          const errorText = await logsRes.text()
          setLogs([])
          throw new Error("Failed to fetch time logs: " + errorText)
        }
        const logsData = await logsRes.json()
        console.log("Fetched logs (raw):", logsData)
        const logsArray = Array.isArray(logsData) ? logsData : logsData.logs
        const normalizedLogs = Array.isArray(logsArray)
          ? logsArray.map(log => ({
              ...log,
              timeIn: log.timeIn || log.time_in,
              timeOut: log.timeOut || log.time_out,
            }))
          : []
        setLogs(normalizedLogs)
      } catch (err: any) {
        setError(err.message || "Failed to load dashboard data")
        console.error("Dashboard fetch error:", err) // <-- LOG
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Calculate summary statistics
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

  // Filter interns based on search and filters
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

  // Filter logs based on search and filters
  const filteredLogs = useMemo(() => {
    // Helper: get local date string as 'YYYY-MM-DD'
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

    if (viewMode === "overview") {
      const todayLocal = getLocalDateString(new Date())
      return logs.filter(
        log => log.date && getLocalDateString(log.date) === todayLocal
      )
    }

    let result = logs.filter(filterBySearchAndDept)
    if (viewMode === "logs" && selectedDate) {
      const selectedLocal = getLocalDateString(selectedDate)
      result = result.filter(log => log.date && getLocalDateString(log.date) === selectedLocal)
    }
    return result
  }, [logs, selectedDate, viewMode, searchTerm, departmentFilter])

  const handleExportAllPDF = () => {
    alert("Exporting all intern records as PDF...")
  }

  const handleGenerateIndividualReport = (internId: number, internName: string) => {
    alert(`Generating individual report for ${internName}...`)
  }

  const handleViewInternDetails = (internId: number) => {
    setSelectedInternId(internId)
  }

  const formatLogDate = (dateString: string) => {
    const date = new Date(dateString)
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const dayNum = String(date.getDate()).padStart(2, "0")
    const year = date.getFullYear()
    return (
      <div className="flex items-center">
        <span className="font-mono tabular-nums">{`${month}-${dayNum}-${year}`}</span>
      </div>
    )
  }

  const departments = Array.from(new Set(interns.map((intern) => intern.department)))

  // If an intern is selected, show their profile
  if (selectedInternId) {
    return <AdminInternProfile internId={String(selectedInternId)} onBack={() => setSelectedInternId(null)} />
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading dashboard...</div>
  }
  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>
  }

  if (viewMode === "logs") {
    console.log("All Logs tab - logs:", logs)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Intern Management</h1>
          <p className="text-gray-600">Monitor intern progress and view all time records</p>
        </div>
        <div className="flex gap-2">
          <Button variant={viewMode === "overview" ? "default" : "outline"} onClick={() => setViewMode("overview")}>
            Overview
          </Button>
          <Button variant={viewMode === "logs" ? "default" : "outline"} onClick={() => setViewMode("logs")}>
            All Logs
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCompletedHours.toFixed(2)}h</div>
            <p className="text-xs text-muted-foreground">of {stats.totalRequiredHours.toFixed(2)}h required</p>
          </CardContent>
        </Card>

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

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
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

            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-48"
                  disabled={viewMode === "overview"}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {viewMode === "overview"
                    ? format(new Date(), "MMM dd, yyyy") // Always show today in overview
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

      {/* Content based on view mode */}
      {viewMode === "overview" ? (
        /* Interns Overview Table */
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
                    <TableHead>Today's Duration</TableHead>
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
                        <TableCell>
                          {intern.status === "in" && intern.timeIn ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              Clocked in at {new Date(intern.timeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </Badge>
                          ) : intern.status === "out" && intern.timeOut ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700">
                              Clocked out at {new Date(intern.timeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">--</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono font-semibold">
                            {(() => {
                              const todayLog = logs.find(
                                (log) =>
                                  log.internId === intern.id &&
                                  log.date &&
                                  log.date.slice(0, 10) === getTodayString()
                              )
                              if (todayLog && todayLog.timeIn && todayLog.timeOut) {
                                const inDate = new Date(todayLog.timeIn)
                                const outDate = new Date(todayLog.timeOut)
                                const diffMs = outDate.getTime() - inDate.getTime()
                                const hours = Math.floor(diffMs / (1000 * 60 * 60))
                                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                                return formatDurationHM(hours, minutes)
                              }
                              if (todayLog && todayLog.timeIn && !todayLog.timeOut) {
                                const inDate = new Date(todayLog.timeIn)
                                const outDate = new Date()
                                const diffMs = outDate.getTime() - inDate.getTime()
                                const hours = Math.floor(diffMs / (1000 * 60 * 60))
                                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                                return formatDurationHM(hours, minutes)
                              }
                              return "0h 00m"
                            })()}
                          </span>
                        </TableCell>
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
                              onClick={() => {
                                // Implement your DTR view logic here
                              }}
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

            {filteredInterns.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No interns found matching your criteria.</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* All Logs Table */
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Intern Logs</CardTitle>
            <p className="text-sm text-gray-600">
              Showing {filteredLogs.length} of {logs.length} time records
            </p>
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
                  {filteredLogs
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="font-medium">{log.internName}</div>
                        </TableCell>
                        <TableCell className="font-medium">{formatLogDate(log.date)}</TableCell>
                        <TableCell>
                          {log.timeIn ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              {new Date(log.timeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">--</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.timeOut ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700">
                              {new Date(log.timeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </Badge>
                          ) : log.timeIn ? (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                              In Progress
                            </Badge>
                          ) : (
                            <span className="text-gray-400">--</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono">
                          {/* Duration */}
                          {log.timeIn && log.timeOut ? (
                            // Completed log: show static duration
                            <span className="font-semibold">
                              {(() => {
                                const inDate = new Date(log.timeIn)
                                const outDate = new Date(log.timeOut)
                                const diffMs = outDate.getTime() - inDate.getTime()
                                const hours = Math.floor(diffMs / (1000 * 60 * 60))
                                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                                return `${hours}h ${minutes.toString().padStart(2, "0")}m`
                              })()}
                            </span>
                          ) : log.timeIn && !log.timeOut ? (
                            // Active log: show real-time duration
                            <span className="font-semibold">
                              {(() => {
                                const inDate = new Date(log.timeIn)
                                const now = new Date()
                                const diffMs = now.getTime() - inDate.getTime()
                                const hours = Math.floor(diffMs / (1000 * 60 * 60))
                                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                                return `${hours}h ${minutes.toString().padStart(2, "0")}m`
                              })()}
                            </span>
                          ) : (
                            <span className="text-gray-400">--</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {/* Hours */}
                          {log.timeIn && log.timeOut ? (
                            <span className="font-semibold text-blue-600">
                              {(() => {
                                const inDate = new Date(log.timeIn)
                                const outDate = new Date(log.timeOut)
                                const diffMs = outDate.getTime() - inDate.getTime()
                                const hours = Math.floor(diffMs / (1000 * 60 * 60))
                                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                                const decimal = hours + minutes / 60
                                return `${decimal.toFixed(2)}h`
                              })()}
                            </span>
                          ) : log.timeIn && !log.timeOut ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">Active</Badge>
                          ) : (
                            <span className="text-gray-400">--</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{log.department}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>

            {filteredLogs.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No logs found matching your criteria.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
