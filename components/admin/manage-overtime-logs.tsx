"use client"

import { useState, useEffect, useCallback } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle, XCircle, Clock, RefreshCw, Zap, Shield } from "lucide-react"
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
  const [minOvertimeHours, setMinOvertimeHours] = useState<number>(1)
  const [bulkActionLoading, setBulkActionLoading] = useState<string | null>(null)
  const [showBulkActions, setShowBulkActions] = useState<boolean>(false)

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
   * Handle bulk auto-reject for logs below minimum hours
   */
  const handleBulkAutoReject = async () => {
    const pendingLogs = logs.filter(log => log.overtime_status === "pending")
    const logsToReject = pendingLogs.filter(log => {
      const timeWorked = calculateTimeWorked(log.time_in, log.time_out)
      return timeWorked.hoursWorked < minOvertimeHours
    })

    if (logsToReject.length === 0) {
      alert(`No pending logs found with less than ${minOvertimeHours} hours to reject.`)
      return
    }

    const confirmReject = window.confirm(
      `Are you sure you want to auto-reject ${logsToReject.length} overtime logs that are below the minimum ${minOvertimeHours} hours threshold?`
    )
    if (!confirmReject) return

    setBulkActionLoading("reject")
    try {
      let successCount = 0
      let errorCount = 0

      for (const log of logsToReject) {
        try {
          const response = await fetch(`/api/admin/overtime/${log.id}`, {
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
        } catch {
          errorCount++
        }
      }

      alert(`Bulk auto-reject completed!\nSuccessfully rejected: ${successCount}\nErrors: ${errorCount}`)
      await fetchOvertimeLogs() // Refresh the data
    } catch (error) {
      console.error("Error in bulk auto-reject:", error)
      alert("Failed to complete bulk auto-reject. Please try again.")
    } finally {
      setBulkActionLoading(null)
    }
  }

  /**
   * Handle bulk auto-approve for logs above minimum hours
   */
  const handleBulkAutoApprove = async () => {
    const pendingLogs = logs.filter(log => log.overtime_status === "pending")
    const logsToApprove = pendingLogs.filter(log => {
      const timeWorked = calculateTimeWorked(log.time_in, log.time_out)
      return timeWorked.hoursWorked >= minOvertimeHours
    })

    if (logsToApprove.length === 0) {
      alert(`No pending logs found with ${minOvertimeHours} hours or more to approve.`)
      return
    }

    const confirmApprove = window.confirm(
      `Are you sure you want to auto-approve ${logsToApprove.length} overtime logs that meet or exceed the minimum ${minOvertimeHours} hours threshold?`
    )
    if (!confirmApprove) return

    setBulkActionLoading("approve")
    try {
      let successCount = 0
      let errorCount = 0

      for (const log of logsToApprove) {
        try {
          const response = await fetch(`/api/admin/overtime/${log.id}`, {
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
        } catch {
          errorCount++
        }
      }

      alert(`Bulk auto-approve completed!\nSuccessfully approved: ${successCount}\nErrors: ${errorCount}`)
      await fetchOvertimeLogs() // Refresh the data
    } catch (error) {
      console.error("Error in bulk auto-approve:", error)
      alert("Failed to complete bulk auto-approve. Please try again.")
    } finally {
      setBulkActionLoading(null)
    }
  }

  /**
   * Handle bulk revert for approved/rejected logs back to pending
   */
  const handleBulkRevert = async () => {
    const processedLogs = logs.filter(log => 
      log.overtime_status === "approved" || log.overtime_status === "rejected"
    )

    if (processedLogs.length === 0) {
      alert("No approved or rejected logs found to revert.")
      return
    }

    const confirmRevert = window.confirm(
      `Are you sure you want to revert ${processedLogs.length} approved/rejected overtime logs back to pending status? This will undo all previous decisions.`
    )
    if (!confirmRevert) return

    setBulkActionLoading("revert")
    try {
      let successCount = 0
      let errorCount = 0

      for (const log of processedLogs) {
        try {
          const response = await fetch(`/api/admin/overtime/${log.id}`, {
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
        } catch {
          errorCount++
        }
      }

      alert(`Bulk revert completed!\nSuccessfully reverted: ${successCount}\nErrors: ${errorCount}`)
      await fetchOvertimeLogs() // Refresh the data
    } catch (error) {
      console.error("Error in bulk revert:", error)
      alert("Failed to complete bulk revert. Please try again.")
    } finally {
      setBulkActionLoading(null)
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

  // Calculate bulk action stats for pending logs
  const pendingLogs = logs.filter(log => log.overtime_status === "pending")
  const processedLogs = logs.filter(log => 
    log.overtime_status === "approved" || log.overtime_status === "rejected"
  )
  const bulkStats = {
    belowMinimum: pendingLogs.filter(log => {
      const timeWorked = calculateTimeWorked(log.time_in, log.time_out)
      return timeWorked.hoursWorked < minOvertimeHours
    }).length,
    aboveMinimum: pendingLogs.filter(log => {
      const timeWorked = calculateTimeWorked(log.time_in, log.time_out)
      return timeWorked.hoursWorked >= minOvertimeHours
    }).length,
    processed: processedLogs.length
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

      {/* Bulk Actions Panel */}
      {(stats.pending > 0 || processedLogs.length > 0) && showBulkActions && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-800 flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Bulk Actions for Overtime Logs
            </CardTitle>
            <CardDescription className="text-amber-700">
              Set minimum overtime hours threshold to auto-approve or auto-reject multiple logs at once, or revert processed logs back to pending.
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
                      <div>• {bulkStats.belowMinimum} logs below {minOvertimeHours}h (can auto-reject)</div>
                      <div>• {bulkStats.aboveMinimum} logs {minOvertimeHours}h+ (can auto-approve)</div>
                      {processedLogs.length > 0 && (
                        <div>• {bulkStats.processed} approved/rejected logs (can revert to pending)</div>
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
                          Auto-Reject {bulkStats.belowMinimum} Logs
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
                          Auto-Approve {bulkStats.aboveMinimum} Logs
                        </>
                      )}
                    </Button>

                    {processedLogs.length > 0 && (
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
                            <Clock className="h-3 w-3 mr-2" />
                            Revert {bulkStats.processed} Logs
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </>
              )}

              {stats.pending === 0 && processedLogs.length > 0 && (
                <>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      <div>• {bulkStats.processed} approved/rejected logs (can revert to pending)</div>
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
                          <Clock className="h-3 w-3 mr-2" />
                          Revert {bulkStats.processed} Logs
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}

              <div className="text-xs text-amber-700 bg-amber-100 p-2 rounded flex items-start gap-2">
                <Shield className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Safety Notice:</strong> Bulk actions will process all logs that meet the criteria. 
                  You can always adjust decisions individually using the action buttons in the table or bulk revert here.
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
              {(stats.pending > 0 || processedLogs.length > 0) && (
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
                              {log.overtime_status === "rejected" && "❌ Rejected - Not counted in progress"}
                              {log.overtime_status === "approved" && "✅ Approved - Counted in progress"}
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
