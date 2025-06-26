"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { 
  calculateTimeWorked, 
  truncateTo2Decimals, 
  filterLogsByInternId,
  DAILY_REQUIRED_HOURS
} from "@/lib/time-utils"
import { 
  TimeLogDisplay, 
  groupLogsByDate, 
  formatLogDate 
} from "@/lib/ui-utils"
import { EditTimeLogDialog } from "@/components/admin/edit-time-log-dialog"
import { useAuth } from "@/contexts/auth-context"

interface DailyTimeRecordProps {
  logs: TimeLogDisplay[]
  internId?: string
  loading?: boolean
  error?: string | null
  onTimeLogUpdate?: () => void
}

/**
 * DailyTimeRecord - Reusable component for displaying time logs table
 */
export function DailyTimeRecord({ logs, internId, loading, error, onTimeLogUpdate }: DailyTimeRecordProps) {
  const { user } = useAuth()
  const [isUpdating, setIsUpdating] = useState(false)
  const isAdmin = user?.role === "admin"

  const handleTimeLogUpdate = async (logId: number, updates: { time_in?: string; time_out?: string }) => {
    if (!isAdmin) return

    setIsUpdating(true)
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

      // Call the callback to refresh data
      if (onTimeLogUpdate) {
        onTimeLogUpdate()
      }
    } catch (error) {
      console.error("Error updating time log:", error)
      // You could add a toast notification here
    } finally {
      setIsUpdating(false)
    }
  }

  const handleTimeLogDelete = async (logId: number) => {
    if (!isAdmin) return

    setIsUpdating(true)
    try {
      const response = await fetch(`/api/admin/time-logs/${logId}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error("Failed to delete time log")
      }

      // Call the callback to refresh data
      if (onTimeLogUpdate) {
        onTimeLogUpdate()
      }
    } catch (error) {
      console.error("Error deleting time log:", error)
      // You could add a toast notification here
    } finally {
      setIsUpdating(false)
    }
  }

  if (loading) {
    return <div className="text-center text-gray-500 py-8">Loading logs...</div>
  }

  if (error) {
    return <div className="text-center text-red-500 py-8">{error}</div>
  }

  if (logs.length === 0) {
    return <div className="text-center text-gray-500 py-8">No logs found.</div>
  }

  return (
    <div className="overflow-x-auto">
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Time In</TableHead>
            <TableHead>Time Out</TableHead>
            <TableHead>Hours Worked</TableHead>
            <TableHead>Overtime Hours</TableHead>
            {isAdmin && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupLogsByDate(filterLogsByInternId(logs, internId)).map(([key, logsForDate]) => {
            // Extract date part from the group key (format: "internId-YYYY-MM-DD")
            const datePart = key.split("-").slice(-3).join("-") // gets "YYYY-MM-DD"

            // Separate regular and overtime logs
            const regularLogs = logsForDate.filter(log => log.log_type !== "overtime")
            const overtimeLogs = logsForDate.filter(log => log.log_type === "overtime")
            
            // Get the earliest time_in and latest time_out for continuous display
            const allCompletedLogs = [...regularLogs, ...overtimeLogs].filter(log => log.time_in && log.time_out)
            
            let earliestTimeIn: string | null = null
            let latestTimeOut: string | null = null
            let isCurrentlyActive = false
            
            if (allCompletedLogs.length > 0) {
              // Find earliest time_in
              earliestTimeIn = allCompletedLogs.reduce((earliest, log) => {
                if (!log.time_in) return earliest
                if (!earliest) return log.time_in
                return new Date(log.time_in) < new Date(earliest) ? log.time_in : earliest
              }, null as string | null)
              
              // Find latest time_out, but adjust based on overtime status
              const hasRejectedOvertime = overtimeLogs.some(log => log.overtime_status === "rejected")
              const hasApprovedOvertime = overtimeLogs.some(log => log.overtime_status === "approved")
              
              if (hasRejectedOvertime && !hasApprovedOvertime) {
                // If overtime is rejected, cut time_out to required daily hours from time_in
                if (earliestTimeIn) {
                  const startTime = new Date(earliestTimeIn)
                  const cutoffTime = new Date(startTime.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
                  latestTimeOut = cutoffTime.toISOString()
                }
              } else {
                // Show full time (approved overtime or no overtime)
                latestTimeOut = allCompletedLogs.reduce((latest, log) => {
                  if (!log.time_out) return latest
                  if (!latest) return log.time_out
                  return new Date(log.time_out) > new Date(latest) ? log.time_out : latest
                }, null as string | null)
              }
            }
            
            // Check for active sessions (pending logs)
            const activeLogs = [...regularLogs, ...overtimeLogs].filter(log => log.time_in && !log.time_out && log.status === "pending")
            if (activeLogs.length > 0) {
              isCurrentlyActive = true
              if (!earliestTimeIn) {
                earliestTimeIn = activeLogs[0].time_in
              }
            }

            // Calculate total hours worked (considering overtime approval/rejection)
            let totalHoursWorked = 0
            if (earliestTimeIn && latestTimeOut) {
              const result = calculateTimeWorked(earliestTimeIn, latestTimeOut)
              totalHoursWorked = result.hoursWorked
            }

            // Calculate regular hours (capped at required daily hours) and overtime hours
            const regularHours = Math.min(totalHoursWorked, DAILY_REQUIRED_HOURS)
            let overtimeHours = 0
            let overtimeStatus = "none"
            
            if (overtimeLogs.length > 0) {
              const hasApprovedOvertime = overtimeLogs.some(log => log.overtime_status === "approved")
              const hasRejectedOvertime = overtimeLogs.some(log => log.overtime_status === "rejected")
              const hasPendingOvertime = overtimeLogs.some(log => !log.overtime_status || log.overtime_status === "pending")
              
              if (totalHoursWorked > DAILY_REQUIRED_HOURS) {
                overtimeHours = totalHoursWorked - DAILY_REQUIRED_HOURS
                
                if (hasApprovedOvertime) {
                  overtimeStatus = "approved"
                } else if (hasPendingOvertime) {
                  overtimeStatus = "pending"
                } else if (hasRejectedOvertime) {
                  overtimeStatus = "rejected"
                  // For rejected overtime, we already cut the time_out above, so overtime should be 0
                  overtimeHours = 0
                }
              }
            }

            // Check overtime status for badge display
            const hasApprovedOvertime = overtimeLogs.some(log => log.overtime_status === "approved")
            const hasRejectedOvertime = overtimeLogs.some(log => log.overtime_status === "rejected")
            const hasPendingOvertime = overtimeLogs.some(log => !log.overtime_status || log.overtime_status === "pending")

            return (
              <TableRow key={key} className={hasPendingOvertime ? "opacity-60" : ""}>
                <TableCell className="font-medium">
                  <div className="flex flex-col items-start">
                    <span className="text-xs text-gray-500">
                      {new Date(datePart).toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                    <span>{formatLogDate(datePart)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {earliestTimeIn ? (
                    <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                      {new Date(earliestTimeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Badge>
                  ) : (
                    <span className="text-gray-400">--</span>
                  )}
                </TableCell>
                <TableCell>
                  {latestTimeOut ? (
                    <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                      {new Date(latestTimeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Badge>
                  ) : isCurrentlyActive ? (
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                      In Progress
                    </Badge>
                  ) : (
                    <span className="text-gray-400">--</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                    {truncateTo2Decimals(regularHours)}h
                  </Badge>
                </TableCell>
                <TableCell>
                  {overtimeHours > 0 ? (
                    <Badge 
                      variant="outline" 
                      className={
                        overtimeStatus === "approved" 
                          ? "bg-purple-100 text-purple-700 border-purple-300"
                          : overtimeStatus === "pending"
                            ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                            : "bg-gray-100 text-gray-400 border-gray-200"
                      }
                    >
                      {truncateTo2Decimals(overtimeHours)}h
                    </Badge>
                  ) : overtimeLogs.length > 0 ? (
                    <Badge variant="outline" className="bg-gray-100 text-gray-400 border-gray-200">
                      0.00h
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-100 text-gray-400 border-gray-200">
                      0.00h
                    </Badge>
                  )}
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <div className="flex flex-col gap-1 items-end">
                      {logsForDate.map((log) => (
                        <EditTimeLogDialog
                          key={log.id}
                          log={log}
                          onSave={handleTimeLogUpdate}
                          onDelete={handleTimeLogDelete}
                          isLoading={isUpdating}
                        />
                      ))}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
