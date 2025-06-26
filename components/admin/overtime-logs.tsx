"use client"

import { useState, useEffect, useCallback } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react"
import { calculateTimeWorked, truncateTo2Decimals } from "@/lib/time-utils"
import { formatLogDate } from "@/lib/ui-utils"

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
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("asc")
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>({
    hasLongLogs: false,
    count: 0
  })

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
        const result = await response.json()
        alert(`Migration completed! Processed ${result.processed} logs.${result.errors.length > 0 ? `\n\nErrors: ${result.errors.join('\n')}` : ''}`)
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
   * Get status badge component based on overtime status
   */
  const getStatusBadge = (overtime_status: string) => {
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
  }

  // Calculate summary statistics
  const stats = {
    pending: logs.filter(log => log.overtime_status === "pending").length,
    approved: logs.filter(log => log.overtime_status === "approved").length,
    rejected: logs.filter(log => log.overtime_status === "rejected").length
  }

  // Sort logs by date
  const sortedLogs = [...logs].sort((a, b) => {
    const aDate = new Date(a.time_in).getTime()
    const bDate = new Date(b.time_in).getTime()
    
    // Handle invalid dates in sorting
    if (isNaN(aDate) && isNaN(bDate)) return 0
    if (isNaN(aDate)) return 1
    if (isNaN(bDate)) return -1
    
    // Sort by date: ascending shows oldest first, descending shows newest first
    return sortDirection === "desc" ? bDate - aDate : aDate - bDate
  })

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

      {/* Overtime Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Overtime Logs</CardTitle>
              <CardDescription>
                Review and manage overtime hours submitted by interns.
              </CardDescription>
            </div>
            <div className="flex gap-2">
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
          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No overtime logs found.
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
                  {sortedLogs.map((log) => {
                    const timeWorked = calculateTimeWorked(log.time_in, log.time_out)
                    
                    return (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">
                              {log.user.first_name} {log.user.last_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {log.user.department} • {log.user.school}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {log.overtime_status === "rejected" && "❌ Rejected - Not counted in progress (click Revert to change)"}
                              {log.overtime_status === "approved" && "✅ Approved - Counted in progress (click Revert to change)"}
                              {log.overtime_status === "pending" && "⏳ Pending approval - Awaiting admin decision"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500">
                              {new Date(log.time_in).toLocaleDateString("en-US", { weekday: "short" })}
                            </span>
                            <span>{formatLogDate(log.time_in.split("T")[0])}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                            {new Date(log.time_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                            {new Date(log.time_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-gray-100 text-gray-700">
                            {truncateTo2Decimals(timeWorked.hoursWorked)}h
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(log.overtime_status)}
                        </TableCell>
                        <TableCell>
                          {log.approver_name ? (
                            <div className="text-sm">
                              <div>{log.approver_name}</div>
                              <div className="text-xs text-gray-500">
                                {log.approved_at ? new Date(log.approved_at).toLocaleDateString() : ""}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {log.overtime_status === "pending" && (
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-300 hover:bg-green-50"
                                onClick={() => handleStatusUpdate(log.id, "approved")}
                                disabled={actionLoading === log.id}
                              >
                                {actionLoading === log.id ? (
                                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                                ) : (
                                  <CheckCircle className="h-3 w-3" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-300 hover:bg-red-50"
                                onClick={() => handleStatusUpdate(log.id, "rejected")}
                                disabled={actionLoading === log.id}
                              >
                                {actionLoading === log.id ? (
                                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                                ) : (
                                  <XCircle className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          )}
                          {(log.overtime_status === "approved" || log.overtime_status === "rejected") && (
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-gray-600 border-gray-300 hover:bg-gray-50"
                                onClick={() => handleStatusUpdate(log.id, "pending")}
                                disabled={actionLoading === log.id}
                                title="Revert to pending status"
                              >
                                {actionLoading === log.id ? (
                                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-600 border-t-transparent" />
                                ) : (
                                  <Clock className="h-3 w-3" />
                                )}
                                Revert
                              </Button>
                            </div>
                          )}
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
    </div>
  )
}
