"use client"

import { useState, useEffect } from "react"
import { BarChart3, Download, TrendingUp, FileText, Users, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

interface InternReport {
  id: string
  name: string
  school: string
  department: string
  requiredHours: number
  completedHours: number
  weeklyAverage: number
  attendanceRate: number
  lastGenerated: string
}

interface Department {
  id: string
  name: string
}

export function ReportsDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState("current-month")
  const [selectedDepartment, setSelectedDepartment] = useState("all")
  const [reports, setReports] = useState<InternReport[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch departments and reports from API
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await fetch("/api/departments")
        if (!res.ok) throw new Error("Failed to fetch departments")
        const data = await res.json()
        setDepartments(data)
      } catch {
        setDepartments([])
      }
    }
    fetchDepartments()
  }, [])

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (selectedPeriod) params.append("period", selectedPeriod)
        if (selectedDepartment !== "all") params.append("department", selectedDepartment)
        const res = await fetch(`/api/reports?${params.toString()}`)
        if (!res.ok) throw new Error("Failed to fetch reports")
        const data = await res.json()
        setReports(data)
      } catch (err: any) {
        setError(err.message || "Failed to load reports")
      } finally {
        setLoading(false)
      }
    }
    fetchReports()
  }, [selectedPeriod, selectedDepartment])

  const handleGenerateReport = (internId: string, internName: string) => {
    alert(`Generating detailed report for ${internName}...`)
  }

  const handleDownloadReport = (internId: string, internName: string) => {
    alert(`Downloading report for ${internName}...`)
  }

  const handleGenerateBulkReport = () => {
    alert("Generating bulk report for all interns...")
  }

  const filteredReports = reports

  // Calculate summary statistics
  const avgCompletion =
    filteredReports.length > 0
      ? (
          filteredReports.reduce(
            (acc, report) => acc + (report.completedHours / report.requiredHours) * 100,
            0,
          ) / filteredReports.length
        ).toFixed(1)
      : "0.0"

  const avgAttendance =
    filteredReports.length > 0
      ? (
          filteredReports.reduce((acc, report) => acc + report.attendanceRate, 0) /
          filteredReports.length
        ).toFixed(1)
      : "0.0"

  const avgWeeklyHours =
    filteredReports.length > 0
      ? (
          filteredReports.reduce((acc, report) => acc + report.weeklyAverage, 0) /
          filteredReports.length
        ).toFixed(1)
      : "0.0"

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600">Generate and manage individual intern reports</p>
        </div>
        <Button onClick={handleGenerateBulkReport} className="bg-blue-600 hover:bg-blue-700">
          <Download className="mr-2 h-4 w-4" />
          Generate Bulk Report
        </Button>
      </div>

      {/* Report Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Report Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Select Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current-week">Current Week</SelectItem>
                <SelectItem value="current-month">Current Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.name}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredReports.length}</div>
            <p className="text-xs text-muted-foreground">Individual reports available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Completion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgCompletion}%</div>
            <p className="text-xs text-muted-foreground">Across selected interns</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Attendance</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgAttendance}%</div>
            <p className="text-xs text-muted-foreground">Average attendance rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Weekly Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgWeeklyHours}h</div>
            <p className="text-xs text-muted-foreground">Per intern per week</p>
          </CardContent>
        </Card>
      </div>

      {/* Individual Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Individual Intern Reports</CardTitle>
          <p className="text-sm text-gray-600">Generate and download detailed reports for each intern</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center text-gray-500 py-8">Loading reports...</div>
          ) : error ? (
            <div className="text-center text-red-500 py-8">{error}</div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No reports found for the selected filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Intern Details</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Weekly Avg</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Last Report</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((report) => {
                    const progressPercentage = (report.completedHours / report.requiredHours) * 100
                    return (
                      <TableRow key={report.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{report.name}</div>
                            <div className="text-sm text-gray-500">{report.school}</div>
                            <Badge variant="outline" className="text-xs">
                              {report.department}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2 min-w-32">
                            <div className="flex justify-between text-sm">
                              <span>
                                {report.completedHours}h / {report.requiredHours}h
                              </span>
                              <span>{progressPercentage.toFixed(1)}%</span>
                            </div>
                            <Progress value={progressPercentage} className="h-2" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono font-semibold">{report.weeklyAverage}h</span>
                        </TableCell>
                        <TableCell>
                          <div className="text-center">
                            <div className="font-semibold">{report.attendanceRate}%</div>
                            <Badge
                              variant={report.attendanceRate >= 90 ? "default" : "secondary"}
                              className={
                                report.attendanceRate >= 90
                                  ? "bg-green-100 text-green-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }
                            >
                              {report.attendanceRate >= 90 ? "Excellent" : "Good"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">{report.lastGenerated}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleGenerateReport(report.id, report.name)}
                            >
                              <BarChart3 className="h-3 w-3 mr-1" />
                              Generate
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDownloadReport(report.id, report.name)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Report Templates</CardTitle>
          <p className="text-sm text-gray-600">Pre-configured report formats for different purposes</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">School Submission Report</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Formal report for school submission including hours, evaluations, and attendance
                </p>
                <Button variant="outline" className="w-full">
                  Use Template
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Performance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Detailed performance analysis with charts and recommendations
                </p>
                <Button variant="outline" className="w-full">
                  Use Template
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Completion Certificate</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Official completion certificate for successful internship completion
                </p>
                <Button variant="outline" className="w-full">
                  Use Template
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
