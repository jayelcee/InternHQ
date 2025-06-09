"use client"

import { useState, useMemo, useEffect } from "react"
import { Search, Download, Clock, Users, TrendingUp, Calendar, FileText, Eye } from "lucide-react"
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

export function HRAdminDashboard() {
  const [searchTerm, setSearchTerm] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedInternId, setSelectedInternId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<"overview" | "logs">("overview")

  // Real data state
  const [interns, setInterns] = useState<InternRecord[]>([])
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        // Fetch interns
        const internsRes = await fetch("/api/interns")
        if (!internsRes.ok) throw new Error("Failed to fetch interns")
        const internsData = await internsRes.json()
        setInterns(internsData)

        // Fetch logs
        const logsRes = await fetch("/api/time-logs")
        if (!logsRes.ok) throw new Error("Failed to fetch time logs")
        const logsData = await logsRes.json()
        setLogs(logsData)
      } catch (err: any) {
        setError(err.message || "Failed to load dashboard data")
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
    return logs.filter((log) => {
      const matchesSearch =
        log.internName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.school.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesDepartment = departmentFilter === "all" || log.department === departmentFilter
      return matchesSearch && matchesDepartment
    })
  }, [logs, searchTerm, departmentFilter])

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
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
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
          <Button onClick={handleExportAllPDF} className="bg-green-600 hover:bg-green-700">
            <Download className="mr-2 h-4 w-4" />
            Export PDF
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
            <div className="text-2xl font-bold">{stats.totalCompletedHours}h</div>
            <p className="text-xs text-muted-foreground">of {stats.totalRequiredHours}h required</p>
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
                <Button variant="outline" className="w-full sm:w-48">
                  <Calendar className="mr-2 h-4 w-4" />
                  {format(selectedDate, "MMM dd, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
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
                    <TableHead>Today's Hours</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Required Hours</TableHead>
                    <TableHead>Actions</TableHead>
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
                            <div className="text-sm text-gray-500">{intern.email}</div>
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
                          <div className="space-y-1">
                            <Badge
                              variant={intern.status === "in" ? "default" : "secondary"}
                              className={cn(
                                intern.status === "in"
                                  ? "bg-green-100 text-green-800 hover:bg-green-200"
                                  : "bg-gray-100 text-gray-800 hover:bg-gray-200",
                              )}
                            >
                              {intern.status === "in" ? "Clocked In" : "Clocked Out"}
                            </Badge>
                            <div className="text-xs text-gray-500">{intern.lastActivity}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono font-semibold">{intern.todayHours}</span>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2 min-w-32">
                            <div className="flex justify-between text-sm">
                              <span>{intern.internshipDetails.completedHours}h</span>
                              <span>{progressPercentage.toFixed(1)}%</span>
                            </div>
                            <Progress value={progressPercentage} className="h-2" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-center">
                            <div className="font-semibold">{intern.internshipDetails.requiredHours}h</div>
                            <div className="text-xs text-gray-500">
                              {intern.internshipDetails.requiredHours - intern.internshipDetails.completedHours}h
                              remaining
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleViewInternDetails(intern.id)}>
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleGenerateIndividualReport(intern.id, `${intern.first_name} ${intern.last_name}`)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              Report
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
                    <TableHead>Department</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{log.internName}</div>
                            <Badge variant="outline" className="text-xs">
                              {log.school}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{formatLogDate(log.date)}</TableCell>
                        <TableCell>
                          {log.timeIn ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              {log.timeIn}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">--</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.timeOut ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700">
                              {log.timeOut}
                            </Badge>
                          ) : log.timeIn ? (
                            <Badge variant="secondary">In Progress</Badge>
                          ) : (
                            <span className="text-gray-400">--</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono">
                          {log.duration ? (
                            <span className="font-semibold">{log.duration}</span>
                          ) : (
                            <span className="text-gray-400">--</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {log.hoursWorked > 0 ? (
                            <span className="font-semibold text-blue-600">{log.hoursWorked.toFixed(2)}h</span>
                          ) : (
                            <span className="text-gray-400">--</span>
                          )}
                        </TableCell>
                        <TableCell>
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
