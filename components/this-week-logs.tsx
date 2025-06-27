"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { calculateTimeWorked, truncateTo2Decimals, DAILY_REQUIRED_HOURS, formatDuration } from "@/lib/time-utils"
import { TimeLogDisplay, groupLogsByDate, formatLogDate } from "@/lib/ui-utils"

interface ThisWeekLogsProps {
  weeklyLogs: TimeLogDisplay[]
  loading: boolean
  error: string | null
  currentTime: Date
  isTimedIn?: boolean
  isOvertimeIn?: boolean
  timeInTimestamp?: Date | null
  overtimeInTimestamp?: Date | null
}

export function ThisWeekLogs({ 
  weeklyLogs, 
  loading, 
  error, 
  currentTime,
  isTimedIn = false,
  isOvertimeIn = false,
  timeInTimestamp = null,
  overtimeInTimestamp = null
}: ThisWeekLogsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">This Week&apos;s Logs</CardTitle>
        <p className="text-sm text-gray-600">Your daily time records for the current week</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading logs...</div>
        ) : error ? (
          <div className="text-center text-red-500 py-8">{error}</div>
        ) : weeklyLogs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No logs found yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time In</TableHead>
                  <TableHead>Time Out</TableHead>
                  <TableHead>Hours Worked</TableHead>
                  <TableHead>Overtime Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupLogsByDate(weeklyLogs).map(([key, logsForDate]) => {
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
                  
                  // Check for active sessions (pending logs OR current dashboard state)
                  const activeLogs = [...regularLogs, ...overtimeLogs].filter(log => log.time_in && !log.time_out && log.status === "pending")
                  
                  // Also check if user is currently active according to dashboard state (for today)
                  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD format
                  const isToday = datePart === today
                  const isDashboardActive = isToday && (isTimedIn || isOvertimeIn)
                  
                  if (activeLogs.length > 0 || isDashboardActive) {
                    isCurrentlyActive = true
                    
                    // For dashboard active state, use the session timestamps
                    if (isDashboardActive && activeLogs.length === 0) {
                      // Use dashboard state for active session
                      if (isTimedIn && timeInTimestamp) {
                        if (!earliestTimeIn) {
                          earliestTimeIn = timeInTimestamp.toISOString()
                        }
                      }
                      if (isOvertimeIn && overtimeInTimestamp) {
                        if (!earliestTimeIn) {
                          earliestTimeIn = overtimeInTimestamp.toISOString()
                        }
                      }
                    } else if (activeLogs.length > 0) {
                      // Use log data for active session
                      if (!earliestTimeIn) {
                        earliestTimeIn = activeLogs[0].time_in
                      }
                    }
                    
                    // For active sessions, use current time as latest time out for calculations
                    if (!latestTimeOut) {
                      latestTimeOut = currentTime.toISOString()
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
                  
                  // Calculate overtime hours if total exceeds required hours
                  if (totalHoursWorked > DAILY_REQUIRED_HOURS) {
                    overtimeHours = totalHoursWorked - DAILY_REQUIRED_HOURS
                    
                    if (overtimeLogs.length > 0) {
                      const hasApprovedOvertime = overtimeLogs.some(log => log.overtime_status === "approved")
                      const hasRejectedOvertime = overtimeLogs.some(log => log.overtime_status === "rejected")
                      const hasPendingOvertime = overtimeLogs.some(log => !log.overtime_status || log.overtime_status === "pending")
                      
                      if (hasApprovedOvertime) {
                        overtimeStatus = "approved"
                      } else if (hasPendingOvertime) {
                        overtimeStatus = "pending"
                      } else if (hasRejectedOvertime) {
                        overtimeStatus = "rejected"
                        // For rejected overtime, we already cut the time_out above, so overtime should be 0
                        overtimeHours = 0
                      }
                    } else {
                      // If no overtime logs but hours exceed required, treat as pending
                      overtimeStatus = "pending"
                    }
                  }

                  // Check overtime status for row opacity
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
                        {latestTimeOut && !isCurrentlyActive ? (
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
                        ) : (
                          <Badge variant="outline" className="bg-gray-100 text-gray-400 border-gray-200">
                            0.00h
                          </Badge>
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
  )
}
