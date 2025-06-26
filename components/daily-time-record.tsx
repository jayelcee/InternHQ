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
            <TableHead className={isAdmin ? "" : "text-right"}>Overtime</TableHead>
            {isAdmin && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupLogsByDate(filterLogsByInternId(logs, internId)).map(([key, logsForDate]) => {
            // Extract date part from the group key (format: "internId-YYYY-MM-DD")
            const datePart = key.split("-").slice(-3).join("-") // gets "YYYY-MM-DD"

            // Calculate total hours for this date (all logs combined)
            const totalHoursWorked = logsForDate
              .filter(log => log.time_in && log.time_out && log.status === "completed")
              .reduce((sum, log) => {
                if (!log.time_in || !log.time_out) return sum
                const result = calculateTimeWorked(log.time_in, log.time_out)
                return sum + result.hoursWorked
              }, 0)

            // For existing data or mixed data, treat as regular hours up to required hours limit
            // then overtime for the rest
            const regularHoursWorked = Math.min(totalHoursWorked, DAILY_REQUIRED_HOURS)
            const overtimeHours = Math.max(0, totalHoursWorked - DAILY_REQUIRED_HOURS)

            return (
              <TableRow key={key}>
                <TableCell className="font-medium">
                  <div className="flex flex-col items-start">
                    <span className="text-xs text-gray-500">
                      {new Date(datePart).toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                    <span>{formatLogDate(datePart)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {logsForDate.map((log, idx) =>
                      log.time_in ? (
                        <Badge 
                          key={idx} 
                          variant="outline" 
                          className={
                            log.log_type === "overtime" 
                              ? "bg-purple-50 text-purple-700 border-purple-300" 
                              : "bg-green-50 text-green-700"
                          }
                        >
                          {new Date(log.time_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Badge>
                      ) : (
                        <span key={idx} className="text-gray-400">--</span>
                      )
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {logsForDate.map((log, idx) =>
                      log.time_out ? (
                        <Badge 
                          key={idx} 
                          variant="outline" 
                          className={
                            log.log_type === "overtime" 
                              ? "bg-purple-50 text-purple-700 border-purple-300" 
                              : "bg-blue-50 text-blue-700"
                          }
                        >
                          {new Date(log.time_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Badge>
                      ) : log.time_in && log.status === "pending" ? (
                        <Badge 
                          key={idx} 
                          variant="outline" 
                          className={
                            log.log_type === "overtime" 
                              ? "bg-purple-50 text-purple-700 border-purple-300" 
                              : "bg-yellow-50 text-yellow-700"
                          }
                        >
                          In Progress
                        </Badge>
                      ) : (
                        <span key={idx} className="text-gray-400">--</span>
                      )
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    {truncateTo2Decimals(regularHoursWorked)}h
                  </Badge>
                </TableCell>
                <TableCell className={isAdmin ? "" : "text-right"}>
                  {Number(truncateTo2Decimals(overtimeHours)) > 0 ? (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                      {truncateTo2Decimals(overtimeHours)}h
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
