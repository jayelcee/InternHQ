/**
 * OvertimeLogsDashboard
 *
 * Admin interface for reviewing and managing overtime logs.
 * - View, filter, and search all overtime logs
 * - Approve, reject, revert, or delete overtime sessions (individually or in bulk)
 * - Bulk actions for auto-approve/reject/revert/delete based on session duration
 * - One-time migration tool for splitting long logs
 * - Displays summary statistics and supports department/status/date filtering
 *
 * Context:
 * - Only accessible to admins
 */

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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { CheckCircle, XCircle, Clock, RefreshCw, Zap, Shield, Search, Calendar, RotateCcw, Trash2 } from "lucide-react"
import { formatLogDate, TimeLogDisplay, useSortDirection, sortLogsByDate } from "@/lib/ui-utils"
import { processTimeLogSessions, getTimeBadgeProps, getDurationBadgeProps, ProcessedSession } from "@/lib/session-utils"
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
 * Session data structure for internal component use
 */
interface Session extends ProcessedSession {
  user: OvertimeLog["user"]
  date: string
  totalOvertimeHours: number
  logIds: number[]
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

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    action: () => void
    actionLabel: string
    variant: "default" | "destructive"
  }>({
    isOpen: false,
    title: "",
    message: "",
    action: () => {},
    actionLabel: "",
    variant: "default"
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
   * Show confirmation dialog
   */
  const showConfirmDialog = (
    title: string,
    message: string,
    action: () => void,
    actionLabel: string,
    variant: "default" | "destructive" = "default"
  ) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      action,
      actionLabel,
      variant
    })
  }

  /**
   * Close confirmation dialog
   */
  const closeConfirmDialog = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }))
  }

  /**
   * Handle session-based status updates (for continuous overtime sessions)
   */
  const handleSessionStatusUpdate = async (sessionLogs: TimeLogDisplay[], status: "approved" | "rejected" | "pending") => {
    // Confirmation for all actions
    if (status === "pending") {
      showConfirmDialog(
        "Revert Session to Pending",
        `Are you sure you want to revert this overtime session back to pending status? This will undo the previous approval/rejection decision.`,
        async () => {
          await updateSessionStatus(sessionLogs, status)
          closeConfirmDialog()
        },
        "Revert to Pending",
        "destructive"
      )
      return
    }
    if (status === "approved") {
      showConfirmDialog(
        "Approve Overtime Session",
        `Are you sure you want to approve this overtime session? This will mark this session as approved.`,
        async () => {
          await updateSessionStatus(sessionLogs, status)
          closeConfirmDialog()
        },
        "Approve Session",
        "default"
      )
      return
    }
    if (status === "rejected") {
      showConfirmDialog(
        "Reject Overtime Session",
        `Are you sure you want to reject this overtime session? This will mark this session as rejected.`,
        async () => {
          await updateSessionStatus(sessionLogs, status)
          closeConfirmDialog()
        },
        "Reject Session",
        "destructive"
      )
      return
    }
    await updateSessionStatus(sessionLogs, status)
  }

  /**
   * Update status for all logs in a session
   */
  const updateSessionStatus = async (sessionLogs: TimeLogDisplay[], status: "approved" | "rejected" | "pending") => {
    const firstLogId = sessionLogs[0]?.id
    if (!firstLogId) return

    setActionLoading(firstLogId)
    try {
      // Update all logs in the session
      for (const log of sessionLogs) {
        const response = await fetch(`/api/admin/overtime/${log.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status }),
        })

        if (!response.ok) {
          console.error(`Failed to update overtime status for log ${log.id}`)
        }
      }
      
      await fetchOvertimeLogs()
    } catch (error) {
      console.error("Error updating session overtime status:", error)
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
        showConfirmDialog(
          "Migration Failed",
          `Migration failed: ${error.error}`,
          () => {},
          "Close",
          "destructive"
        )
      }
    } catch (error) {
      console.error("Error running migration:", error)
      showConfirmDialog(
        "Migration Error",
        "Failed to run migration. Please try again.",
        () => {},
        "Close",
        "destructive"
      )
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
      return
    }

    showConfirmDialog(
      "Bulk Auto-Reject",
      `Are you sure you want to auto-reject ${sessionsToReject.length} overtime sessions that are below the minimum ${minOvertimeHours} hours threshold?`,
      async () => {
        await performBulkAutoReject(sessionsToReject)
        closeConfirmDialog()
      },
      "Auto-Reject Sessions",
      "destructive"
    )
  }

  /**
   * Perform bulk auto-reject (extracted from handleBulkAutoReject)
   */
  const performBulkAutoReject = async (sessionsToReject: Session[]) => {
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

      if (errorCount > 0) {
        showConfirmDialog(
          "Bulk Auto-Reject Results",
          `Some errors occurred during bulk auto-reject.\nSuccessfully rejected: ${successCount} logs\nErrors: ${errorCount}`,
          () => {},
          "Close",
          "destructive"
        )
      }
      await fetchOvertimeLogs() // Refresh the data
    } catch (error) {
      console.error("Error in bulk auto-reject:", error)
      showConfirmDialog(
        "Bulk Auto-Reject Error",
        "Failed to complete bulk auto-reject. Please try again.",
        () => {},
        "Close",
        "destructive"
      )
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

    showConfirmDialog(
      "Bulk Auto-Approve",
      `Are you sure you want to auto-approve ${sessionsToApprove.length} overtime sessions that meet or exceed the minimum ${minOvertimeHours} hours threshold?`,
      async () => {
        await performBulkAutoApprove(sessionsToApprove)
        closeConfirmDialog()
      },
      "Auto-Approve Sessions",
      "default"
    )
  }

  /**
   * Perform bulk auto-approve (extracted from handleBulkAutoApprove)
   */
  const performBulkAutoApprove = async (sessionsToApprove: Session[]) => {
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

      if (errorCount > 0) {
        showConfirmDialog(
          "Bulk Auto-Approve Results",
          `Some errors occurred during bulk auto-approve.\nSuccessfully approved: ${successCount} logs\nErrors: ${errorCount}`,
          () => {},
          "Close",
          "destructive"
        )
      }
      await fetchOvertimeLogs() // Refresh the data
    } catch (error) {
      console.error("Error in bulk auto-approve:", error)
      showConfirmDialog(
        "Bulk Auto-Approve Error",
        "Failed to complete bulk auto-approve. Please try again.",
        () => {},
        "Close",
        "destructive"
      )
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

    showConfirmDialog(
      "Bulk Revert to Pending",
      `Are you sure you want to revert ${processedSessions.length} approved/rejected overtime sessions back to pending status? This will undo all previous decisions.`,
      async () => {
        await performBulkRevert()
        closeConfirmDialog()
      },
      "Revert to Pending",
      "destructive"
    )
  }

  /**
   * Perform bulk revert (extracted from handleBulkRevert)
   */
  const performBulkRevert = async () => {
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

      if (errorCount > 0) {
        showConfirmDialog(
          "Bulk Revert Results",
          `Some errors occurred during bulk revert.\nSuccessfully reverted: ${successCount} logs\nErrors: ${errorCount}`,
          () => {},
          "Close",
          "destructive"
        )
      }
      await fetchOvertimeLogs() // Refresh the data
    } catch (error) {
      console.error("Error in bulk revert:", error)
      showConfirmDialog(
        "Bulk Revert Error",
        "Failed to complete bulk revert. Please try again.",
        () => {},
        "Close",
        "destructive"
      )
    } finally {
      setBulkActionLoading(null)
    }
  }

  /**
   * Handle session-based deletion of overtime logs
   */
  const handleDeleteOvertimeSession = async (sessionLogs: TimeLogDisplay[]) => {
    showConfirmDialog(
      "Delete Overtime Session",
      `Are you sure you want to permanently delete this overtime session? This action cannot be undone.`,
      async () => {
        await performDeleteOvertimeSession(sessionLogs)
        closeConfirmDialog()
      },
      "Delete Session",
      "destructive"
    )
  }

  /**
   * Perform session deletion (extracted from handleDeleteOvertimeSession)
   */
  const performDeleteOvertimeSession = async (sessionLogs: TimeLogDisplay[]) => {
    const firstLogId = sessionLogs[0]?.id
    if (!firstLogId) return

    setActionLoading(firstLogId)
    try {
      let successCount = 0
      let errorCount = 0

      for (const log of sessionLogs) {
        try {
          const response = await fetch(`/api/admin/overtime/${log.id}`, {
            method: "DELETE",
            credentials: "include",
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

      if (errorCount > 0) {
        showConfirmDialog(
          "Session Deletion Results",
          `Some errors occurred during session deletion.\nSuccessfully deleted: ${successCount} logs\nErrors: ${errorCount}`,
          () => {},
          "Close",
          "destructive"
        )
      }
      
      await fetchOvertimeLogs()
    } catch (error) {
      console.error("Error deleting overtime session:", error)
      showConfirmDialog(
        "Delete Error",
        "Failed to delete overtime session. Please try again.",
        () => {},
        "Close",
        "destructive"
      )
    } finally {
      setActionLoading(null)
    }
  }

  /**
   * Handle bulk delete for sessions
   */
  const handleBulkDelete = async () => {
    // Filter only rejected sessions for bulk delete
    const rejectedSessions = processedSessions.filter(session => {
      const sessionStatus = session.logs.every(log => log.overtime_status === "rejected") ? "rejected" : "approved"
      return sessionStatus === "rejected"
    })

    if (rejectedSessions.length === 0) {
      alert("No rejected sessions found to delete.")
      return
    }

    showConfirmDialog(
      "Bulk Delete Sessions",
      `Are you sure you want to permanently delete ${rejectedSessions.length} rejected overtime sessions? This action cannot be undone.`,
      async () => {
        await performBulkDelete(rejectedSessions)
        closeConfirmDialog()
      },
      "Delete Sessions",
      "destructive"
    )
  }

  /**
   * Perform bulk delete (extracted from handleBulkDelete)
   */
  const performBulkDelete = async (rejectedSessions: Session[]) => {
    setBulkActionLoading("delete")
    try {
      let successCount = 0
      let errorCount = 0

      for (const session of rejectedSessions) {
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

      if (errorCount > 0) {
        showConfirmDialog(
          "Bulk Delete Results",
          `Some errors occurred during bulk delete.\nSuccessfully deleted: ${successCount} logs\nErrors: ${errorCount}`,
          () => {},
          "Close",
          "destructive"
        )
      }
      await fetchOvertimeLogs() // Refresh the data
    } catch (error) {
      console.error("Error in bulk delete:", error)
      showConfirmDialog(
        "Bulk Delete Error",
        "Failed to complete bulk delete. Please try again.",
        () => {},
        "Close",
        "destructive"
      )
    } finally {
      setBulkActionLoading(null)
    }
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
  const pendingSessions: Session[] = useMemo(() => {
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
        totalOvertimeHours: (() => {
          // Calculate total session duration for bulk actions
          if (session.timeIn && session.timeOut) {
            const start = new Date(session.timeIn)
            const end = new Date(session.timeOut)
            const durationMs = end.getTime() - start.getTime()
            return durationMs / (1000 * 60 * 60) // Convert to hours
          }
          return 0
        })(),
        logIds: session.logs.map(l => l.id)
      }))
    })
  }, [filteredPendingLogs])

  // Group processed logs into sessions for bulk revert
  const processedSessions: Session[] = useMemo(() => {
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

  // Calculate summary statistics (after session grouping)
  const stats = {
    pending: pendingSessions.length,
    approved: processedSessions.filter(session =>
      session.logs.every(log => log.overtime_status === "approved")
    ).length,
    rejected: processedSessions.filter(session =>
      session.logs.every(log => log.overtime_status === "rejected")
    ).length
  }

  const bulkStats = {
    belowMinimum: pendingSessions.filter(session => 
      session.totalOvertimeHours < minOvertimeHours
    ).length,
    aboveMinimum: pendingSessions.filter(session => 
      session.totalOvertimeHours >= minOvertimeHours
    ).length,
    processed: processedSessions.length,
    rejected: processedSessions.filter(session => {
      const sessionStatus = session.logs.every(log => log.overtime_status === "rejected") ? "rejected" : "approved"
      return sessionStatus === "rejected"
    }).length,
    approved: processedSessions.filter(session => {
      const sessionStatus = session.logs.some(log => log.overtime_status === "approved") ? "approved" : "rejected"
      return sessionStatus === "approved"
    }).length
  }

  // Sort filtered logs by date
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
            <p className="text-xs text-muted-foreground">Overtime sessions awaiting review</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">Approved overtime sessions</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <p className="text-xs text-muted-foreground">Rejected overtime sessions</p>
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
              {stats.pending > 0 && (
                <>Set minimum overtime hours threshold to auto-approve or auto-reject overtime sessions.</>
              )}
              {stats.pending === 0 && processedSessions.length > 0 && (
                <>Manage processed overtime sessions - revert decisions or delete rejected sessions.</>
              )}
              {stats.pending === 0 && processedSessions.length === 0 && (
                <>No overtime sessions available for bulk actions at this time.</>
              )}
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
                      {bulkStats.belowMinimum > 0 && (
                        <div>• {bulkStats.belowMinimum} overtime sessions below {minOvertimeHours}h → Auto-reject available</div>
                      )}
                      {bulkStats.aboveMinimum > 0 && (
                        <div>• {bulkStats.aboveMinimum} overtime sessions {minOvertimeHours}h+ → Auto-approve available</div>
                      )}
                      {bulkStats.approved > 0 && (
                        <div>• {bulkStats.approved} approved overtime sessions → Can revert to pending</div>
                      )}
                      {bulkStats.rejected > 0 && (
                        <div>• {bulkStats.rejected} rejected overtime sessions → Can delete or revert to pending</div>
                      )}
                      {bulkStats.belowMinimum === 0 && bulkStats.aboveMinimum === 0 && bulkStats.approved === 0 && bulkStats.rejected === 0 && (
                        <div className="text-gray-500">• No actions available for current sessions</div>
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

                    {bulkStats.rejected > 0 && (
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
                            Delete {bulkStats.rejected} Rejected Sessions
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
                      {bulkStats.approved > 0 && (
                        <div>• {bulkStats.approved} approved overtime sessions → Can revert to pending</div>
                      )}
                      {bulkStats.rejected > 0 && (
                        <div>• {bulkStats.rejected} rejected overtime sessions → Can delete or revert to pending</div>
                      )}
                      {bulkStats.approved === 0 && bulkStats.rejected === 0 && (
                        <div className="text-gray-500">• No processed sessions available for bulk actions</div>
                      )}
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

                    {bulkStats.rejected > 0 && (
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
                            Delete {bulkStats.rejected} Rejected Sessions
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </>
              )}

              <div className="text-xs text-amber-700 bg-amber-100 p-2 rounded flex items-start gap-2">
                <Shield className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Safety Notice:</strong> 
                  {stats.pending > 0 && processedSessions.length > 0 && (
                    <> Bulk actions process continuous overtime sessions as units. All logs within a session (overtime + extended_overtime) are approved/rejected together. You can always adjust decisions individually or bulk revert processed sessions here.</>
                  )}
                  {stats.pending > 0 && processedSessions.length === 0 && (
                    <> Auto-approve/reject actions process continuous overtime sessions as units. All logs within a session (overtime + extended_overtime) are processed together. You can always adjust decisions individually after bulk processing.</>
                  )}
                  {stats.pending === 0 && processedSessions.length > 0 && (
                    <> Bulk revert and delete actions process continuous overtime sessions as units. All logs within a session are reverted or deleted together. {bulkStats.rejected > 0 ? 'Only rejected sessions can be permanently deleted.' : 'Individual adjustments can be made from the table below.'}</>
                  )}
                  {stats.pending === 0 && processedSessions.length === 0 && (
                    <> No bulk actions are currently available. Individual session management can be performed from the table below when overtime sessions are present.</>
                  )}
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
                Review and manage overtime durations submitted by interns. 
                {(() => {
                  // Helper to count grouped sessions
                  function countSessions(logsToGroup: OvertimeLog[]) {
                    // Convert logs to TimeLogDisplay format
                    const timeLogDisplays = logsToGroup.map(log => ({
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
                      const user = logsToGroup.find(l => l.id === log.id)?.user
                      if (!user || !log.time_in) return groups
                      const dateKey = log.time_in.split('T')[0]
                      const groupKey = `${user.id}-${dateKey}`
                      if (!groups[groupKey]) {
                        groups[groupKey] = { user, date: dateKey, logs: [] }
                      }
                      groups[groupKey].logs.push(log)
                      return groups
                    }, {} as Record<string, { user: OvertimeLog["user"], date: string, logs: TimeLogDisplay[] }>)
                    // Process each group into sessions and count overtime sessions
                    return Object.values(groupedByUserAndDate).reduce((count, group) => {
                      const { sessions } = processTimeLogSessions(group.logs)
                      const overtimeSessions = sessions.filter(s => s.isOvertimeSession || s.overtimeHours > 0)
                      return count + overtimeSessions.length
                    }, 0)
                  }
                  const filteredSessionCount = countSessions(filteredLogs)
                  const totalSessionCount = countSessions(logs)
                  return (
                    <> Showing {filteredSessionCount} of {totalSessionCount} overtime sessions.</>
                  )
                })()}
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
                  title="Split long logs to manage overtime sessions."
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${migrationLoading ? 'animate-spin' : ''}`}/>
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
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approved By</TableHead>
                    <TableHead>Notes</TableHead>
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
                                // Calculate duration from session timeIn/timeOut for accurate display
                                let durationText = "0h 00m"
                                if (session.timeIn && session.timeOut) {
                                  const start = new Date(session.timeIn)
                                  const end = new Date(session.timeOut)
                                  const ms = end.getTime() - start.getTime()
                                  if (ms > 0) {
                                    const totalMinutes = Math.floor(ms / 60000)
                                    const hours = Math.floor(totalMinutes / 60)
                                    const minutes = totalMinutes % 60
                                    durationText = `${hours}h ${minutes.toString().padStart(2, "0")}m`
                                  }
                                }
                                const badge = getDurationBadgeProps(
                                  (session.timeIn && session.timeOut)
                                    ? ((new Date(session.timeOut).getTime() - new Date(session.timeIn).getTime()) / 3600000)
                                    : 0,
                                  "overtime",
                                  session.overtimeStatus
                                )
                                return (
                                  <Badge variant={badge.variant} className={badge.className}>
                                    {durationText}
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
                            <TableCell>
                              {(() => {
                                // Find unique notes from any log in this session
                                const notesFromSession = session.logs
                                  .map(log => sortedLogs.find(l => l.id === log.id)?.notes)
                                  .filter((note): note is string => note != null && note.trim() !== '')
                                
                                if (notesFromSession.length === 0) {
                                  return <span className="text-gray-400">—</span>
                                }
                                
                                // Remove duplicates for continuous sessions
                                const uniqueNotes = Array.from(new Set(notesFromSession))
                                const combinedNotes = uniqueNotes.join('; ')
                                
                                return (
                                  <div className="text-sm max-w-xs">
                                    <div 
                                      className="text-gray-700 cursor-help" 
                                      title="Tasks or notes for this overtime session."
                                      style={{
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        lineHeight: '1.4'
                                      }}
                                    >
                                      {combinedNotes}
                                    </div>
                                    {combinedNotes.length > 50 && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        Click to view full notes
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                            </TableCell>
                            <TableCell className="text-right">
                              {sessionStatus === "pending" && (
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600 border-green-300 hover:bg-green-50"
                                    title="Approve Overtime"
                                    onClick={async () => {
                                      // Approve all logs in this session
                                      await handleSessionStatusUpdate(session.logs, "approved")
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
                                    title="Reject Overtime"
                                    onClick={async () => {
                                      // Reject all logs in this session
                                      await handleSessionStatusUpdate(session.logs, "rejected")
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
                                      await handleSessionStatusUpdate(session.logs, "pending")
                                    }}
                                    disabled={actionLoading === firstLogId}
                                    title="Revert to pending status."
                                  >
                                    {actionLoading === firstLogId ? (
                                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-600 border-t-transparent" />
                                    ) : (
                                      <RotateCcw className="h-3 w-3" />
                                    )}
                                  </Button>
                                  {sessionStatus === "approved" ? (
                                    <button
                                      type="button"
                                      className="inline-flex items-center justify-center h-8 px-2 py-2 rounded-md border border-red-300 bg-transparent opacity-40 cursor-not-allowed text-red-600"
                                      style={{ minWidth: 36 }}
                                      tabIndex={-1}
                                      title="Cannot delete an approved overtime log."
                                      disabled
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-red-600 border-red-300 hover:bg-red-50"
                                      onClick={async () => {
                                        if (sessionStatus !== "rejected") return;
                                        await handleDeleteOvertimeSession(session.logs)
                                      }}
                                      disabled={actionLoading === firstLogId || sessionStatus !== "rejected"}
                                      title="Permanently delete overtime session."
                                    >
                                      {actionLoading === firstLogId ? (
                                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                                      ) : (
                                        <Trash2 className="h-5 w-5" />
                                      )}
                                    </Button>
                                  )}
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

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.isOpen} onOpenChange={closeConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>
              {confirmDialog.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant={confirmDialog.variant}
              className={
                confirmDialog.actionLabel.toLowerCase().includes("revert to pending")
                  ? "bg-black text-white hover:bg-gray-900 border-black"
                  : confirmDialog.variant === "destructive"
                  ? "bg-red-600 text-white hover:bg-red-700 border-red-600"
                  : confirmDialog.variant === "default" && confirmDialog.actionLabel.toLowerCase().includes("approve")
                  ? "bg-green-600 text-white hover:bg-green-700 border-green-600"
                  : ""
              }
              onClick={confirmDialog.action}
            >
              {confirmDialog.actionLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
