"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { CheckCircle, XCircle, Clock, RefreshCw, Zap, Shield, Search, Calendar, RotateCcw, Trash2 } from "lucide-react"
import { calculateTimeWorked } from "@/lib/time-utils"
import { formatLogDate, TimeLogDisplay, useSortDirection, sortLogsByDate } from "@/lib/ui-utils"
import { processTimeLogSessions, getTimeBadgeProps, getDurationBadgeProps } from "@/lib/session-utils"
import { format } from "date-fns"

/**
 * Overtime log data structure
 */
interface OvertimeLog {
  id: number
  user_id: number
  time_in: string
  time_out: string
  status: string
  log_type: string
  overtime_status: "pending" | "approved" | "rejected"
  approved_by?: number
  approved_at?: string
  notes?: string
  created_at: string
  updated_at: string
  user: {
    id: number
    first_name: string
    last_name: string
    email: string
    role: string
    department: string
    school: string
  }
  department: string
  school: string
  approver_name?: string | null
}

/**
 * Migration status interface
 */
interface MigrationStatus {
  hasLongLogs: boolean
  count: number
}

/**
 * OvertimeLogsDashboard - Admin interface for reviewing and approving overtime logs
 * 
 * Features:
 * - View all overtime logs with status indicators
 * - Approve/reject overtime requests
 * - One-time migration tool for splitting long logs (only shown when needed)
 * - Real-time status updates
 */
export function OvertimeLogsDashboard() {
  // State management
  const [logs, setLogs] = useState<OvertimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [migrationLoading, setMigrationLoading] = useState(false)
  // Sort state management - centralized  
  const { sortDirection, toggleSort, sortButtonText } = useSortDirection("desc")
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>({
    hasLongLogs: false,
    count: 0
  })
  const [minOvertimeHours, setMinOvertimeHours] = useState<number>(1)
  const [bulkActionLoading, setBulkActionLoading] = useState<string | null>(null)
  const [showBulkActions, setShowBulkActions] = useState<boolean>(false)
  
  // Filter and search state
  const [searchTerm, setSearchTerm] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  /**
   * Fetch overtime logs from API
   */
  const fetchOvertimeLogs = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/overtime", {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setLogs(data)
      }
    } catch (error) {
      console.error("Error fetching overtime logs:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Check if there are long logs that need migration
   */
  const checkLongLogs = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/check-long-logs", {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setMigrationStatus({
          hasLongLogs: data.hasLongLogs,
          count: data.count
        })
      }
    } catch (error) {
      console.error("Error checking long logs:", error)
    }
  }, [])

  // Initial data load
  useEffect(() => {
    fetchOvertimeLogs()
    checkLongLogs()
  }, [fetchOvertimeLogs, checkLongLogs])

  /**
   * Handle overtime status updates (approve/reject/revert to pending)
   */
  const handleStatusUpdate = async (logId: number, status: "approved" | "rejected" | "pending") => {
    // Confirmation for revert action
    if (status === "pending") {
      const confirmRevert = window.confirm(
        "Are you sure you want to revert this overtime log back to pending status? This will undo the previous approval/rejection decision."
      )
      if (!confirmRevert) return
    }

    setActionLoading(logId)
    try {
      const response = await fetch(`/api/admin/overtime/${logId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      })

      if (response.ok) {
        await fetchOvertimeLogs()
      } else {
        console.error("Failed to update overtime status")
      }
    } catch (error) {
      console.error("Error updating overtime status:", error)
    } finally {
      setActionLoading(null)
    }
  }

  /**
   * Handle one-time migration of long logs
   */
  const handleMigration = async () => {
    if (migrationLoading) return
    
    setMigrationLoading(true)
    try {
      const response = await fetch("/api/admin/migrate-long-logs", {
        method: "POST",
        credentials: "include",
      })
      
      if (response.ok) {
        await response.json()
        // Refresh data after migration
        await Promise.all([fetchOvertimeLogs(), checkLongLogs()])
      } else {
        const error = await response.json()
        alert(`Migration failed: ${error.error}`)
      }
    } catch (error) {
      console.error("Error running migration:", error)
      alert("Failed to run migration. Please try again.")
    } finally {
      setMigrationLoading(false)
    }
  }

  /**
   * Handle bulk auto-reject for sessions below minimum hours
   */
  const handleBulkAutoReject = async () => {
    const sessionsToReject = pendingSessions.filter(session => 
      session.totalOvertimeHours < minOvertimeHours
    )

    if (sessionsToReject.length === 0) {
      alert(`No pending sessions found with less than ${minOvertimeHours} hours to reject.`)
      return
    }

    const totalLogsCount = sessionsToReject.reduce((sum, session) => sum + session.logIds.length, 0)

    const confirmReject = window.confirm(
      `Are you sure you want to auto-reject ${sessionsToReject.length} overtime sessions (${totalLogsCount} individual logs) that are below the minimum ${minOvertimeHours} hours threshold?`
    )
    if (!confirmReject) return

    setBulkActionLoading("reject")
    try {
      let successCount = 0
      let errorCount = 0

      for (const session of sessionsToReject) {
        try {
          // Reject all logs in this session
          for (const logId of session.logIds) {
            const response = await fetch(`/api/admin/overtime/${logId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ status: "rejected" }),
            })
            
            if (response.ok) {
              successCount++
            } else {
              errorCount++
            }
          }
        } catch {
          errorCount += session.logIds.length
        }
      }

      alert(`Bulk auto-reject completed!\nSuccessfully rejected: ${successCount} logs from ${sessionsToReject.length} sessions\nErrors: ${errorCount}`)
      await fetchOvertimeLogs() // Refresh the data
    } catch (error) {
      console.error("Error in bulk auto-reject:", error)
      alert("Failed to complete bulk auto-reject. Please try again.")
    } finally {
      setBulkActionLoading(null)
    }
  }

  /**
   * Handle bulk auto-approve for sessions above minimum hours
   */
  const handleBulkAutoApprove = async () => {
    const sessionsToApprove = pendingSessions.filter(session => 
      session.totalOvertimeHours >= minOvertimeHours
    )

    if (sessionsToApprove.length === 0) {
      alert(`No pending sessions found with ${minOvertimeHours} hours or more to approve.`)
      return
    }

    const totalLogsCount = sessionsToApprove.reduce((sum, session) => sum + session.logIds.length, 0)

    const confirmApprove = window.confirm(
      `Are you sure you want to auto-approve ${sessionsToApprove.length} overtime sessions (${totalLogsCount} individual logs) that meet or exceed the minimum ${minOvertimeHours} hours threshold?`
    )
    if (!confirmApprove) return

    setBulkActionLoading("approve")
    try {
      let successCount = 0
      let errorCount = 0

      for (const session of sessionsToApprove) {
        try {
          // Approve all logs in this session
          for (const logId of session.logIds) {
            const response = await fetch(`/api/admin/overtime/${logId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ status: "approved" }),
            })
            
            if (response.ok) {
              successCount++
            } else {
              errorCount++
            }
          }
        } catch {
          errorCount += session.logIds.length
        }
      }

      alert(`Bulk auto-approve completed!\nSuccessfully approved: ${successCount} logs from ${sessionsToApprove.length} sessions\nErrors: ${errorCount}`)
      await fetchOvertimeLogs() // Refresh the data
    } catch (error) {
      console.error("Error in bulk auto-approve:", error)
      alert("Failed to complete bulk auto-approve. Please try again.")
    } finally {
      setBulkActionLoading(null)
    }
  }

  /**
   * Handle bulk revert for approved/rejected sessions back to pending
   */
  const handleBulkRevert = async () => {
    if (processedSessions.length === 0) {
      alert("No approved or rejected sessions found to revert.")
      return
    }

    const totalLogsCount = processedSessions.reduce((sum, session) => sum + session.logIds.length, 0)

    const confirmRevert = window.confirm(
      `Are you sure you want to revert ${processedSessions.length} approved/rejected overtime sessions (${totalLogsCount} individual logs) back to pending status? This will undo all previous decisions.`
    )
    if (!confirmRevert) return

    setBulkActionLoading("revert")
    try {
      let successCount = 0
      let errorCount = 0

      for (const session of processedSessions) {
        try {
          // Revert all logs in this session
          for (const logId of session.logIds) {
            const response = await fetch(`/api/admin/overtime/${logId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ status: "pending" }),
            })
            
            if (response.ok) {
              successCount++
            } else {
              errorCount++
            }
          }
        } catch {
          errorCount += session.logIds.length
        }
      }

      alert(`Bulk revert completed!\nSuccessfully reverted: ${successCount} logs from ${processedSessions.length} sessions\nErrors: ${errorCount}`)
      await fetchOvertimeLogs() // Refresh the data
    } catch (error) {
      console.error("Error in bulk revert:", error)
      alert("Failed to complete bulk revert. Please try again.")
    } finally {
      setBulkActionLoading(null)
    }
  }

  /**
   * Handle permanent deletion of overtime logs
   */
  const handleDeleteOvertimeLog = async (logId: number) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to permanently delete this overtime log? This action cannot be undone."
    )
    if (!confirmDelete) return

    setActionLoading(logId)
    try {
      const response = await fetch(`/api/admin/overtime/${logId}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (response.ok) {
        await fetchOvertimeLogs()
      } else {
        const error = await response.json()
        alert(`Failed to delete overtime log: ${error.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("Error deleting overtime log:", error)
      alert("Failed to delete overtime log. Please try again.")
    } finally {
      setActionLoading(null)
    }
  }

  /**
   * Handle bulk delete for sessions
   */
  const handleBulkDelete = async () => {
    if (processedSessions.length === 0) {
      alert("No approved/rejected sessions found to delete.")
      return
    }

    const totalLogsCount = processedSessions.reduce((sum, session) => sum + session.logIds.length, 0)

    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete ${processedSessions.length} approved/rejected overtime sessions (${totalLogsCount} individual logs)? This action cannot be undone.`
    )
    if (!confirmDelete) return

    setBulkActionLoading("delete")
    try {
      let successCount = 0
      let errorCount = 0

      for (const session of processedSessions) {
        try {
          // Delete all logs in this session
          for (const logId of session.logIds) {
            const response = await fetch(`/api/admin/overtime/${logId}`, {
              method: "DELETE",
              credentials: "include",
            })
            
            if (response.ok) {
              successCount++
            } else {
              errorCount++
            }
          }
        } catch {
          errorCount += session.logIds.length
        }
      }

      alert(`Bulk delete completed!\nSuccessfully deleted: ${successCount} logs from ${processedSessions.length} sessions\nErrors: ${errorCount}`)
      await fetchOvertimeLogs() // Refresh the data
    } catch (error) {
      console.error("Error in bulk delete:", error)
      alert("Failed to complete bulk delete. Please try again.")
    } finally {
      setBulkActionLoading(null)
    }
  }

  /**
   * Get status badge component based on overtime status
   */
  /* const getStatusBadge = (overtime_status: string) => {
    const statusConfig = {
      approved: {
        className: "bg-green-50 text-green-700 border-green-300",
        icon: CheckCircle,
        label: "Approved"
      },
      rejected: {
        className: "bg-red-50 text-red-700 border-red-300",
        icon: XCircle,
        label: "Rejected"
      },
      pending: {
        className: "bg-yellow-50 text-yellow-700 border-yellow-300",
        icon: Clock,
        label: "Pending"
      }
    }

    const config = statusConfig[overtime_status as keyof typeof statusConfig] || statusConfig.pending
    const Icon = config.icon

    return (
      <Badge variant="outline" className={config.className}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    )
  } */

  // Calculate summary statistics
  const stats = {
    pending: logs.filter(log => log.overtime_status === "pending").length,
    approved: logs.filter(log => log.overtime_status === "approved").length,
    rejected: logs.filter(log => log.overtime_status === "rejected").length
  }

  // Get departments for filter
  const departments = useMemo(() => {
    const depts = new Set<string>()
    logs.forEach(log => {
      if (log.user.department) {
        depts.add(log.user.department)
      }
    })
    return Array.from(depts).sort()
  }, [logs])

  // Filtered logs based on search and filters
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search filter
      const searchMatch = searchTerm === "" || 
        `${log.user.first_name} ${log.user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user.school.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user.department.toLowerCase().includes(searchTerm.toLowerCase())

      // Department filter
      const departmentMatch = departmentFilter === "all" || log.user.department === departmentFilter

      // Status filter
      const statusMatch = statusFilter === "all" || log.overtime_status === statusFilter

      // Date filter
      const dateMatch = !selectedDate || 
        new Date(log.time_in).toDateString() === selectedDate.toDateString()

      return searchMatch && departmentMatch && statusMatch && dateMatch
    })
  }, [logs, searchTerm, departmentFilter, statusFilter, selectedDate])

  // Calculate bulk action stats for filtered pending logs using session grouping
  const filteredPendingLogs = filteredLogs.filter(log => log.overtime_status === "pending")
  const filteredProcessedLogs = filteredLogs.filter(log => 
    log.overtime_status === "approved" || log.overtime_status === "rejected"
  )

  // Group logs into sessions for bulk actions
  const pendingSessions = useMemo(() => {
    // Convert overtime logs to TimeLogDisplay format
    const timeLogDisplays: TimeLogDisplay[] = filteredPendingLogs.map(log => ({
      id: log.id,
      user_id: log.user_id,
      time_in: log.time_in,
      time_out: log.time_out,
      log_type: log.log_type as "overtime" | "extended_overtime",
      overtime_status: log.overtime_status,
      status: 'completed' as const,
      created_at: log.created_at,
      updated_at: log.updated_at
    }))
    
    // Group by user and date
    const groupedByUserAndDate = timeLogDisplays.reduce((groups, log) => {
      const user = filteredPendingLogs.find(l => l.id === log.id)?.user
      if (!user || !log.time_in) return groups
      
      const dateKey = log.time_in.split('T')[0]
      const groupKey = `${user.id}-${dateKey}`
      
      if (!groups[groupKey]) {
        groups[groupKey] = { user, date: dateKey, logs: [] }
      }
      groups[groupKey].logs.push(log)
      return groups
    }, {} as Record<string, { user: { id: number; first_name: string; last_name: string; email: string; role: string; department: string; school: string }, date: string, logs: TimeLogDisplay[] }>)
    
    // Process each group into sessions and return only overtime sessions
    return Object.values(groupedByUserAndDate).flatMap(group => {
      const { sessions } = processTimeLogSessions(group.logs)
      const overtimeSessions = sessions.filter(s => s.isOvertimeSession || s.overtimeHours > 0)
      
      return overtimeSessions.map(session => ({
        ...session,
        user: group.user,
        date: group.date,
        totalOvertimeHours: session.overtimeHours, // Use overtimeHours property directly
        logIds: session.logs.map(l => l.id)
      }))
    })
  }, [filteredPendingLogs])

  // Group processed logs into sessions for bulk revert
  const processedSessions = useMemo(() => {
    // Convert overtime logs to TimeLogDisplay format
    const timeLogDisplays: TimeLogDisplay[] = filteredProcessedLogs.map(log => ({
      id: log.id,
      user_id: log.user_id,
      time_in: log.time_in,
      time_out: log.time_out,
      log_type: log.log_type as "overtime" | "extended_overtime",
      overtime_status: log.overtime_status,
      status: 'completed' as const,
      created_at: log.created_at,
      updated_at: log.updated_at
    }))
    
    // Group by user and date
    const groupedByUserAndDate = timeLogDisplays.reduce((groups, log) => {
      const user = filteredProcessedLogs.find(l => l.id === log.id)?.user
      if (!user || !log.time_in) return groups
      
      const dateKey = log.time_in.split('T')[0]
      const groupKey = `${user.id}-${dateKey}`
      
      if (!groups[groupKey]) {
        groups[groupKey] = { user, date: dateKey, logs: [] }
      }
      groups[groupKey].logs.push(log)
      return groups
    }, {} as Record<string, { user: { id: number; first_name: string; last_name: string; email: string; role: string; department: string; school: string }, date: string, logs: TimeLogDisplay[] }>)
    
    // Process each group into sessions and return only overtime sessions
    return Object.values(groupedByUserAndDate).flatMap(group => {
      const { sessions } = processTimeLogSessions(group.logs)
      const overtimeSessions = sessions.filter(s => s.isOvertimeSession || s.overtimeHours > 0)
      
      return overtimeSessions.map(session => ({
        ...session,
        user: group.user,
        date: group.date,
        totalOvertimeHours: session.overtimeHours,
        logIds: session.logs.map(l => l.id)
      }))
    })
  }, [filteredProcessedLogs])

  const bulkStats = {
    belowMinimum: pendingSessions.filter(session => 
      session.totalOvertimeHours < minOvertimeHours
    ).length,
    aboveMinimum: pendingSessions.filter(session => 
      session.totalOvertimeHours >= minOvertimeHours
    ).length,
    processed: processedSessions.length
  }

  // Sort filtered logs by date
  // Sort logs using centralized logic
  const sortedLogs = sortLogsByDate(filteredLogs, sortDirection)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-600">Loading overtime logs...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Overtime logs awaiting review</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">Approved overtime logs</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <p className="text-xs text-muted-foreground">Rejected overtime logs</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search Card */}
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
                  placeholder="Search by name, email, school, or department..."
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

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            {/* Date filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-48"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {selectedDate
                    ? format(selectedDate, "MMM dd, yyyy")
                    : "All Dates"}
                </Button>
              </PopoverTrigger>
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
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Panel */}
      {(stats.pending > 0 || processedSessions.length > 0) && showBulkActions && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-800 flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Bulk Actions for Overtime Sessions
            </CardTitle>
            <CardDescription className="text-amber-700">
              Set minimum overtime hours threshold to auto-approve or auto-reject overtime sessions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.pending > 0 && (
                <>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="minHours" className="text-sm font-medium">
                        Minimum Hours:
                      </Label>
                      <Input
                        id="minHours"
                        type="number"
                        min="0"
                        max="24"
                        step="0.5"
                        value={minOvertimeHours}
                        onChange={(e) => setMinOvertimeHours(parseFloat(e.target.value) || 0)}
                        className="w-24"
                      />
                    </div>
                    <div className="text-sm text-gray-600">
                      <div>• {bulkStats.belowMinimum} overtime sessions below {minOvertimeHours}h (can auto-reject)</div>
                      <div>• {bulkStats.aboveMinimum} overtime sessions {minOvertimeHours}h+ (can auto-approve)</div>
                      {processedSessions.length > 0 && (
                        <div>• {bulkStats.processed} approved/rejected sessions (can revert to pending)</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkAutoReject}
                      disabled={bulkActionLoading !== null || bulkStats.belowMinimum === 0}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      {bulkActionLoading === "reject" ? (
                        <>
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-600 border-t-transparent mr-2" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-2" />
                          Auto-Reject {bulkStats.belowMinimum} Sessions
                        </>
                      )}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkAutoApprove}
                      disabled={bulkActionLoading !== null || bulkStats.aboveMinimum === 0}
                      className="text-green-600 border-green-300 hover:bg-green-50"
                    >
                      {bulkActionLoading === "approve" ? (
                        <>
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-green-600 border-t-transparent mr-2" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-3 w-3 mr-2" />
                          Auto-Approve {bulkStats.aboveMinimum} Sessions
                        </>
                      )}
                    </Button>

                    {processedSessions.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkRevert}
                        disabled={bulkActionLoading !== null || bulkStats.processed === 0}
                        className="text-gray-600 border-gray-300 hover:bg-gray-50"
                      >
                        {bulkActionLoading === "revert" ? (
                          <>
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-600 border-t-transparent mr-2" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <RotateCcw className="h-3 w-3 mr-2" />
                            Revert {bulkStats.processed} Sessions
                          </>
                        )}
                      </Button>
                    )}

                    {processedSessions.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkDelete}
                        disabled={bulkActionLoading !== null}
                        className="text-red-600 border-red-300 hover:bg-red-50"
                      >
                        {bulkActionLoading === "delete" ? (
                          <>
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-600 border-t-transparent mr-2" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-3 w-3 mr-2" />
                            Delete {processedSessions.length} Sessions
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </>
              )}

              {stats.pending === 0 && processedSessions.length > 0 && (
                <>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      <div>• {bulkStats.processed} approved/rejected sessions (can revert to pending)</div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkRevert}
                      disabled={bulkActionLoading !== null || bulkStats.processed === 0}
                      className="text-gray-600 border-gray-300 hover:bg-gray-50"
                    >
                      {bulkActionLoading === "revert" ? (
                        <>
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-600 border-t-transparent mr-2" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-3 w-3 mr-2" />
                          Revert {bulkStats.processed} Sessions
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkDelete}
                      disabled={bulkActionLoading !== null}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      {bulkActionLoading === "delete" ? (
                        <>
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-600 border-t-transparent mr-2" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-3 w-3 mr-2" />
                          Delete {bulkStats.processed} Sessions
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}

              <div className="text-xs text-amber-700 bg-amber-100 p-2 rounded flex items-start gap-2">
                <Shield className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Safety Notice:</strong> Bulk actions process continuous overtime sessions as units. 
                  All logs within a session (overtime + extended_overtime) are approved/rejected together.
                  You can always adjust decisions individually or bulk revert here.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overtime Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Overtime Logs</CardTitle>
              <CardDescription>
                Review and manage overtime hours submitted by interns. 
                Showing {filteredLogs.length} of {logs.length} logs.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSort}
              >
                {sortButtonText}
              </Button>
              {(stats.pending > 0 || processedSessions.length > 0) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkActions(!showBulkActions)}
                  className="text-amber-700 border-amber-300 hover:bg-amber-50"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  {showBulkActions ? "Hide Bulk Actions" : "Show Bulk Actions"}
                </Button>
              )}
              {migrationStatus.hasLongLogs && (
                <Button
                  onClick={handleMigration}
                  variant="outline"
                  size="sm"
                  disabled={migrationLoading}
                  className="shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${migrationLoading ? 'animate-spin' : ''}`} />
                  {migrationLoading ? 'Processing...' : `Split ${migrationStatus.count} Long Logs`}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {logs.length === 0 
                ? "No overtime logs found."
                : "No overtime logs match your current filters."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Intern</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time In</TableHead>
                    <TableHead>Time Out</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approved By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    // Convert overtime logs to TimeLogDisplay format
                    const timeLogDisplays: TimeLogDisplay[] = sortedLogs.map(log => ({
                      id: log.id,
                      user_id: log.user_id,
                      time_in: log.time_in,
                      time_out: log.time_out,
                      log_type: log.log_type as "overtime" | "extended_overtime",
                      overtime_status: log.overtime_status,
                      status: 'completed' as const, // Required field for TimeLogDisplay
                      created_at: log.created_at,
                      updated_at: log.updated_at
                    }))
                    
                    // Group by user and date
                    const groupedByUserAndDate = timeLogDisplays.reduce((groups, log) => {
                      const user = sortedLogs.find(l => l.id === log.id)?.user
                      if (!user || !log.time_in) return groups
                      
                      const dateKey = log.time_in.split('T')[0]
                      const groupKey = `${user.id}-${dateKey}`
                      
                      if (!groups[groupKey]) {
                        groups[groupKey] = {
                          user,
                          date: dateKey,
                          logs: []
                        }
                      }
                      groups[groupKey].logs.push(log)
                      return groups
                    }, {} as Record<string, { user: { id: number; first_name: string; last_name: string; email: string; role: string; department: string; school: string }, date: string, logs: TimeLogDisplay[] }>)
                    
                    // Process each group into sessions
                    return Object.values(groupedByUserAndDate).map(group => {
                      const { sessions } = processTimeLogSessions(group.logs)
                      const overtimeSessions = sessions.filter(s => s.isOvertimeSession || s.overtimeHours > 0)
                      
                      return overtimeSessions.map((session, sessionIndex) => {
                        // Determine the overall status for the session
                        const sessionStatus: "pending" | "approved" | "rejected" = 
                          session.overtimeStatus === "none" ? "pending" : session.overtimeStatus
                        
                        // Find the first log ID for actions (we'll act on all logs in the session)
                        const firstLogId = session.logs[0]?.id
                        const originalLog = sortedLogs.find(l => l.id === firstLogId)
                        if (!originalLog) return null
                        
                        return (
                          <TableRow key={`${group.user.id}-${group.date}-${sessionIndex}`}>
                            <TableCell>
                              <div className="text-sm">
                                <div className="font-medium">
                                  {group.user.first_name} {group.user.last_name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {group.user.department} • {group.user.school}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {session.logs.length > 1 && `Combined from ${session.logs.length} continuous logs`}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {sessionStatus === "rejected" && "❌ Rejected - Not counted in progress"}
                                  {sessionStatus === "approved" && "✅ Approved - Counted in progress"}
                                  {sessionStatus === "pending" && "⏳ Pending approval - Awaiting admin decision"}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500">
                                  {new Date(group.date).toLocaleDateString("en-US", { weekday: "short" })}
                                </span>
                                <span>{formatLogDate(group.date)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {session.timeIn && (() => {
                                const badge = getTimeBadgeProps(
                                  session.timeIn,
                                  session.sessionType,
                                  "in",
                                  session.overtimeStatus,
                                  session.isContinuousSession
                                )
                                return (
                                  <Badge variant={badge.variant} className={badge.className}>
                                    {badge.text}
                                  </Badge>
                                )
                              })()}
                            </TableCell>
                            <TableCell>
                              {session.timeOut && (() => {
                                const badge = getTimeBadgeProps(
                                  session.timeOut,
                                  session.sessionType,
                                  "out",
                                  session.overtimeStatus,
                                  session.isContinuousSession
                                )
                                return (
                                  <Badge variant={badge.variant} className={badge.className}>
                                    {badge.text}
                                  </Badge>
                                )
                              })()}
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const badge = getDurationBadgeProps(
                                  session.overtimeHours,
                                  "overtime",
                                  session.overtimeStatus
                                )
                                return (
                                  <Badge variant={badge.variant} className={badge.className}>
                                    {badge.text}
                                  </Badge>
                                )
                              })()}
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const badge = getTimeBadgeProps(
                                  session.timeIn,
                                  session.sessionType,
                                  session.isActive ? "active" : "in",
                                  session.overtimeStatus,
                                  session.isContinuousSession
                                )
                                // Use status badge color for status column
                                let statusBadgeProps = badge
                                if (session.overtimeStatus === "approved") {
                                  statusBadgeProps = {
                                    ...badge,
                                    className: "bg-green-50 text-green-700 border-green-300"
                                  }
                                } else if (session.overtimeStatus === "rejected") {
                                  statusBadgeProps = {
                                    ...badge,
                                    className: "bg-red-50 text-red-700 border-red-300"
                                  }
                                } else if (session.overtimeStatus === "pending" || session.overtimeStatus === "none") {
                                  statusBadgeProps = {
                                    ...badge,
                                    className: "bg-yellow-50 text-yellow-700 border-yellow-300"
                                  }
                                }
                                return (
                                  <Badge variant={statusBadgeProps.variant} className={statusBadgeProps.className}>
                                    {session.overtimeStatus === "approved" && (
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                    )}
                                    {session.overtimeStatus === "rejected" && (
                                      <XCircle className="w-3 h-3 mr-1" />
                                    )}
                                    {(session.overtimeStatus === "pending" || session.overtimeStatus === "none") && (
                                      <Clock className="w-3 h-3 mr-1" />
                                    )}
                                    {session.overtimeStatus === "approved" && "Approved"}
                                    {session.overtimeStatus === "rejected" && "Rejected"}
                                    {(session.overtimeStatus === "pending" || session.overtimeStatus === "none") && "Pending"}
                                  </Badge>
                                )
                              })()}
                            </TableCell>
                            <TableCell>
                              {originalLog.approver_name ? (
                                <div className="text-sm">
                                  <div>{originalLog.approver_name}</div>
                                  <div className="text-xs text-gray-500">
                                    {originalLog.approved_at ? new Date(originalLog.approved_at).toLocaleDateString() : ""}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {sessionStatus === "pending" && (
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600 border-green-300 hover:bg-green-50"
                                    onClick={async () => {
                                      // Approve all logs in this session
                                      for (const log of session.logs) {
                                        await handleStatusUpdate(log.id, "approved")
                                      }
                                    }}
                                    disabled={actionLoading === firstLogId}
                                  >
                                    {actionLoading === firstLogId ? (
                                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                                    ) : (
                                      <CheckCircle className="h-3 w-3" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 border-red-300 hover:bg-red-50"
                                    onClick={async () => {
                                      // Reject all logs in this session
                                      for (const log of session.logs) {
                                        await handleStatusUpdate(log.id, "rejected")
                                      }
                                    }}
                                    disabled={actionLoading === firstLogId}
                                  >
                                    {actionLoading === firstLogId ? (
                                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                                    ) : (
                                      <XCircle className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                              )}
                              {(sessionStatus === "approved" || sessionStatus === "rejected") && (
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-gray-600 border-gray-300 hover:bg-gray-50"
                                    onClick={async () => {
                                      // Revert all logs in this session to pending
                                      for (const log of session.logs) {
                                        await handleStatusUpdate(log.id, "pending")
                                      }
                                    }}
                                    disabled={actionLoading === firstLogId}
                                    title="Revert to pending status"
                                  >
                                    {actionLoading === firstLogId ? (
                                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-600 border-t-transparent" />
                                    ) : (
                                      <RotateCcw className="h-3 w-3" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 border-red-300 hover:bg-red-50"
                                    onClick={async () => {
                                      // Delete all logs in this session
                                      for (const log of session.logs) {
                                        await handleDeleteOvertimeLog(log.id)
                                      }
                                    }}
                                    disabled={actionLoading === firstLogId}
                                    title="Permanently delete overtime log"
                                  >
                                    {actionLoading === firstLogId ? (
                                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                                    ) : (
                                      <Trash2 className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      }).filter(Boolean) // Remove null entries
                    }).flat()
                  })()}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
