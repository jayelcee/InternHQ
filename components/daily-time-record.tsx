"use client"

import { useState, useEffect } from "react"
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
import { EditTimeLogDialog } from "@/components/edit-time-log-dialog"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

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
  const [showActions, setShowActions] = useState(false) // NEW: controls actions column for interns
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc")
  const isAdmin = user?.role === "admin"
  const isIntern = user?.role === "intern"

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

  // --- New: For intern edit requests ---
  const handleEditRequest = async (logId: number, updates: { time_in?: string; time_out?: string }) => {
    if (!isIntern) return
    setIsUpdating(true)
    try {
      const response = await fetch("/api/interns/time-log-edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ logId, ...updates, userId: user?.id }),
      })
      if (!response.ok) {
        throw new Error("Failed to submit edit request")
      }
      if (onTimeLogUpdate) onTimeLogUpdate()
    } catch (error) {
      console.error("Error submitting edit request:", error)
    } finally {
      setIsUpdating(false)
    }
  }

  // --- Automatic migration of long logs on DTR load ---
  useEffect(() => {
    let cancelled = false
    async function maybeMigrateLongLogs() {
      try {
        // Check if there are long logs to migrate
        const checkRes = await fetch("/api/admin/check-long-logs", { credentials: "include" })
        if (!checkRes.ok) return
        const checkData = await checkRes.json()
        if (checkData.hasLongLogs && !cancelled) {
          // Run migration if needed
          await fetch("/api/admin/migrate-long-logs", {
            method: "POST",
            credentials: "include"
          })
          // Optionally, you can call onTimeLogUpdate to refresh logs after migration
          if (onTimeLogUpdate) onTimeLogUpdate()
        }
      } catch (err) {
        // Ignore errors, don't block DTR
        // console.error("Error checking/migrating long logs:", err)
      }
    }
    maybeMigrateLongLogs()
    return () => { cancelled = true }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-lg">All Intern Logs</CardTitle>
            <p className="text-sm text-gray-600">
              Showing {logs.length} of {logs.length} time records
            </p>
          </div>
          <div className="flex flex-row items-center gap-2 mt-2 sm:mt-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))}
              type="button"
            >
              Sort by Date&nbsp;{sortDirection === "desc" ? "↓" : "↑"}
            </Button>
            {isIntern && (
              !showActions ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowActions(true)}
                  type="button"
                >
                  Request Edit
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowActions(false)}
                  type="button"
                >
                  Cancel
                </Button>
              )
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {/* Top right controls: Sort and Request Edit */}
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time In</TableHead>
                <TableHead>Time Out</TableHead>
                <TableHead>Regular Shift</TableHead>
                <TableHead>Overtime</TableHead>
                {(isAdmin || (isIntern && showActions)) && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupLogsByDate(
                filterLogsByInternId(logs, internId)
              )
                // Sort by date key according to sortDirection
                .sort(([keyA], [keyB]) => {
                  const dateA = new Date(keyA.split("-").slice(-3).join("-")).getTime()
                  const dateB = new Date(keyB.split("-").slice(-3).join("-")).getTime()
                  return sortDirection === "desc" ? dateB - dateA : dateA - dateB
                })
                .map(([key, logsForDate]) => {
                  const datePart = key.split("-").slice(-3).join("-")
                  const regularLogs = logsForDate.filter(log => !log.log_type || log.log_type === "regular")
                  const overtimeLogs = logsForDate.filter(log => log.log_type === "overtime" || log.log_type === "extended_overtime")
                  const allLogs = [...regularLogs, ...overtimeLogs].sort((a, b) => {
                    const aTime = a.time_in || a.time_out || ""
                    const bTime = b.time_in || b.time_out || ""
                    return new Date(aTime).getTime() - new Date(bTime).getTime()
                  })
                  // Group logs into continuous sessions
                  const isContinuous = (log1: TimeLogDisplay, log2: TimeLogDisplay): boolean => {
                    if (!log1.time_out || !log2.time_in) return false
                    const gap = new Date(log2.time_in).getTime() - new Date(log1.time_out).getTime()
                    return gap <= 60 * 1000
                  }
                  const sessions: TimeLogDisplay[][] = []
                  let currentSession: TimeLogDisplay[] = []
                  for (const log of allLogs) {
                    if (currentSession.length === 0) {
                      currentSession = [log]
                    } else {
                      const lastLog = currentSession[currentSession.length - 1]
                      if (isContinuous(lastLog, log)) {
                        currentSession.push(log)
                      } else {
                        sessions.push(currentSession)
                        currentSession = [log]
                      }
                    }
                  }
                  if (currentSession.length > 0) sessions.push(currentSession)
                  // Calculate totals
                  let totalRegularHours = 0
                  let totalOvertimeHours = 0
                  let overallOvertimeStatus = "none"
                  for (const session of sessions) {
                    const isPureOvertimeSession = session.every(log => log.log_type === "overtime" || log.log_type === "extended_overtime")
                    for (const log of session) {
                      if (log.time_in && log.time_out) {
                        const result = calculateTimeWorked(log.time_in, log.time_out)
                        const logHours = result.hoursWorked
                        if (log.log_type === "overtime" || log.log_type === "extended_overtime") {
                          totalOvertimeHours += logHours
                          if (log.overtime_status === "approved" && overallOvertimeStatus !== "rejected") {
                            overallOvertimeStatus = "approved"
                          } else if ((!log.overtime_status || log.overtime_status === "pending") && overallOvertimeStatus === "none") {
                            overallOvertimeStatus = "pending"
                          } else if (log.overtime_status === "rejected") {
                            overallOvertimeStatus = "rejected"
                          }
                        } else {
                          totalRegularHours += logHours
                        }
                      } else if (log.time_in && !log.time_out) {
                        // Active session, treat as in progress
                        // For DTR, we don't have freezeAt/currentTime, so skip
                      }
                    }
                  }
                  if (totalRegularHours > DAILY_REQUIRED_HOURS) {
                    // Cap regular hours at DAILY_REQUIRED_HOURS, move excess to overtime
                    const excess = totalRegularHours - DAILY_REQUIRED_HOURS
                    totalRegularHours = DAILY_REQUIRED_HOURS
                    totalOvertimeHours += excess
                  }
                  // If any overtime log is rejected, set overtime to 0 and cap regular at DAILY_REQUIRED_HOURS
                  if (overallOvertimeStatus === "rejected") {
                    totalRegularHours = Math.min(totalRegularHours, DAILY_REQUIRED_HOURS)
                    totalOvertimeHours = 0
                  }
                  // --- Render row ---
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
                          {sessions.map((session, i) => {
                            const sessionTimeIn = session[0]?.time_in
                            const isOvertimeSession = session.every(log => log.log_type === "overtime" || log.log_type === "extended_overtime")
                            const overtimeStatus = isOvertimeSession ? session[0]?.overtime_status : null
                            return sessionTimeIn ? (
                              <Badge
                                key={i}
                                variant="outline"
                                className={
                                  isOvertimeSession
                                    ? overtimeStatus === "approved"
                                      ? "bg-purple-100 text-purple-700 border-purple-300"
                                      : overtimeStatus === "rejected"
                                        ? "bg-gray-100 text-gray-700 border-gray-300"
                                        : "bg-yellow-100 text-yellow-700 border-yellow-300"
                                    : "bg-green-100 text-green-700 border-green-300"
                                }
                              >
                                {new Date(sessionTimeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </Badge>
                            ) : null
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {sessions.map((session, i) => {
                            const isOvertimeSession = session.every(log => log.log_type === "overtime" || log.log_type === "extended_overtime")
                            const overtimeStatus = isOvertimeSession ? session[0]?.overtime_status : null
                            const lastLog = session[session.length - 1]
                            const sessionTimeOut = lastLog?.time_out || null
                            if (sessionTimeOut) {
                              return (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className={
                                    isOvertimeSession
                                      ? overtimeStatus === "approved"
                                        ? "bg-purple-100 text-purple-700 border-purple-300"
                                        : overtimeStatus === "rejected"
                                          ? "bg-gray-100 text-gray-700 border-gray-300"
                                          : "bg-yellow-100 text-yellow-700 border-yellow-300"
                                      : "bg-red-100 text-red-700 border-red-300"
                                  }
                                >
                                  {new Date(sessionTimeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </Badge>
                              )
                            } else {
                              return (
                                <Badge key={i} variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                                  In Progress
                                </Badge>
                              )
                            }
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {sessions.map((session, i) => {
                            const isOvertimeOnlySession = session.every(log => log.log_type === "overtime" || log.log_type === "extended_overtime")
                            if (isOvertimeOnlySession) {
                              return (
                                <Badge key={i} variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">
                                  0h 00m
                                </Badge>
                              )
                            } else {
                              // Calculate regular hours for this session
                              let sessionRegularHours = 0
                              for (const log of session) {
                                if (log.log_type === "regular" || !log.log_type) {
                                  if (log.time_in && log.time_out) {
                                    const result = calculateTimeWorked(log.time_in, log.time_out)
                                    sessionRegularHours += result.hoursWorked
                                  }
                                }
                                const cappedHours = Math.min(sessionRegularHours, DAILY_REQUIRED_HOURS)
                                const displayHours = Math.floor(cappedHours)
                                const displayMinutes = Math.round((cappedHours % 1) * 60)
                                return (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className={cappedHours > 0 ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-gray-100 text-gray-700 border-gray-300"}
                                  >
                                    {`${displayHours}h ${displayMinutes.toString().padStart(2, '0')}m`}
                                  </Badge>
                                )
                              }}
                            })}
                            {sessions.length > 1 &&
                              sessions.some(session => !session.every(log => log.log_type === "overtime" || log.log_type === "extended_overtime")) &&
                              sessions.filter(session => session.some(log => log.log_type !== "overtime" && log.log_type !== "extended_overtime")).length > 1 && (
                                <Badge
                                  variant="outline"
                                  className={
                                    totalRegularHours > 0
                                      ? "bg-blue-200 text-blue-800 border-blue-400 font-medium"
                                      : "bg-gray-100 text-gray-700 border-gray-300"
                                  }
                                >
                                  {truncateTo2Decimals(totalRegularHours)}h
                                </Badge>
                              )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {sessions.map((session, i) => {
                            let sessionOvertimeHours = 0
                            let sessionOvertimeStatus = "none"
                            for (const log of session) {
                              if (log.log_type === "overtime" || log.log_type === "extended_overtime") {
                                if (log.time_in && log.time_out) {
                                  const result = calculateTimeWorked(log.time_in, log.time_out)
                                  sessionOvertimeHours += result.hoursWorked
                                }
                                if (log.overtime_status === "approved") {
                                  sessionOvertimeStatus = "approved"
                                } else if (log.overtime_status === "rejected") {
                                  sessionOvertimeStatus = "rejected"
                                } else if (sessionOvertimeStatus === "none") {
                                  sessionOvertimeStatus = "pending"
                                }
                              }
                            }
                            const displayHours = Math.floor(sessionOvertimeHours)
                            const displayMinutes = Math.round((sessionOvertimeHours % 1) * 60)
                            return (
                              <Badge
                                key={i}
                                variant="outline"
                                className={
                                  displayHours === 0 && displayMinutes === 0
                                    ? "bg-gray-100 text-gray-700 border-gray-300"
                                    : sessionOvertimeStatus === "approved"
                                      ? "bg-purple-100 text-purple-700 border-purple-300"
                                      : sessionOvertimeStatus === "rejected"
                                        ? "bg-gray-100 text-gray-700 border-gray-300"
                                        : "bg-yellow-100 text-yellow-700 border-yellow-300"
                                }
                              >
                                {`${displayHours}h ${displayMinutes.toString().padStart(2, '0')}m`}
                              </Badge>
                            )
                          })}
                        </div>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex flex-col gap-1 items-end">
                            {/* Only one pencil per date, pass all logs for the date */}
                            <EditTimeLogDialog
                              key={key}
                              logs={logsForDate}
                              onSave={handleTimeLogUpdate}
                              onDelete={handleTimeLogDelete}
                              isLoading={isUpdating}
                              isAdmin={true}
                              isIntern={false}
                            />
                          </div>
                        </TableCell>
                      )}
                      {isIntern && showActions && (
                        <TableCell className="text-right">
                          {/* Only one pencil per date, pass all logs for the date */}
                          <EditTimeLogDialog
                            key={key}
                            logs={logsForDate}
                            onSave={handleEditRequest}
                            onDelete={async () => {}}
                            isLoading={isUpdating}
                            isAdmin={false}
                            isIntern={true}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
