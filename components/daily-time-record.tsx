"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { EditTimeLogDialog } from "@/components/edit-time-log-dialog"
import { TimeLogDisplay, groupLogsByDate, formatLogDate } from "@/lib/ui-utils"
import { processTimeLogSessions, getTimeBadgeProps, getDurationBadgeProps, getTotalBadgeProps, getAdjustedSessionHours } from "@/lib/session-utils"
import { filterLogsByInternId } from "@/lib/time-utils"

interface EditLogRequest {
  id: number
  logId: number
  internName: string
  requestedTimeIn: string | null
  requestedTimeOut: string | null
  originalTimeIn: string | null
  originalTimeOut: string | null
  status: "pending" | "approved" | "rejected"
  requestedAt: string
}

interface DailyTimeRecordProps {
  logs: TimeLogDisplay[]
  internId?: string
  loading?: boolean
  error?: string | null
  onTimeLogUpdate?: () => void
}

/**
 * DailyTimeRecord - Displays time logs with centralized session processing
 * Uses session-utils for consistent overtime calculations and badge styling
 */
export function DailyTimeRecord({ logs, internId, loading, error, onTimeLogUpdate }: DailyTimeRecordProps) {
  const { user } = useAuth()
  const [isUpdating, setIsUpdating] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc")
  const [editRequests, setEditRequests] = useState<EditLogRequest[]>([])
  const isAdmin = user?.role === "admin"
  const isIntern = user?.role === "intern"

  // Fetch edit requests to show pending status
  const fetchEditRequests = async () => {
    try {
      const response = await fetch("/api/admin/time-log-edit-requests", {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setEditRequests(Array.isArray(data) ? data : data.requests || [])
      }
    } catch (error) {
      console.error("Error fetching edit requests:", error)
      // Don't block the DTR if edit requests fail
    }
  }

  useEffect(() => {
    fetchEditRequests()
  }, [logs])

  // Helper function to get pending edit request for a log
  const getPendingEditRequest = (logId: number): EditLogRequest | null => {
    return editRequests.find(req => req.logId === logId && req.status === "pending") || null
  }

  // Helper function to get effective time (requested if pending, otherwise original)
  const getEffectiveTime = (log: TimeLogDisplay, field: "time_in" | "time_out"): string | null => {
    const pendingRequest = getPendingEditRequest(log.id)
    if (pendingRequest) {
      return field === "time_in" ? pendingRequest.requestedTimeIn : pendingRequest.requestedTimeOut
    }
    return log[field]
  }

  // Helper function to create modified log with pending request data
  const getLogWithPendingData = (log: TimeLogDisplay): TimeLogDisplay => {
    const pendingRequest = getPendingEditRequest(log.id)
    if (pendingRequest) {
      return {
        ...log,
        time_in: pendingRequest.requestedTimeIn || log.time_in,
        time_out: pendingRequest.requestedTimeOut || log.time_out,
      }
    }
    return log
  }

  // Check if a log has pending edit request
  const hasPendingEdit = (logId: number): boolean => {
    return getPendingEditRequest(logId) !== null
  }

  // Get yellow badge props for pending edit requests
  const getPendingBadgeProps = (originalBadgeProps: any, logId: number) => {
    if (hasPendingEdit(logId)) {
      return {
        ...originalBadgeProps,
        variant: "outline" as const,
        className: "bg-yellow-100 text-yellow-700 border-yellow-300"
      }
    }
    return originalBadgeProps
  }

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

      if (onTimeLogUpdate) {
        onTimeLogUpdate()
      }
      // Refetch edit requests after time log update
      fetchEditRequests()
    } catch (error) {
      console.error("Error updating time log:", error)
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

      if (onTimeLogUpdate) {
        onTimeLogUpdate()
      }
      // Refetch edit requests after time log update
      fetchEditRequests()
    } catch (error) {
      console.error("Error deleting time log:", error)
    } finally {
      setIsUpdating(false)
    }
  }

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
      // Refetch edit requests after submitting edit request
      fetchEditRequests()
    } catch (error) {
      console.error("Error submitting edit request:", error)
    } finally {
      setIsUpdating(false)
    }
  }

  // Automatic migration of long logs on DTR load
  useEffect(() => {
    let cancelled = false
    async function maybeMigrateLongLogs() {
      try {
        const checkRes = await fetch("/api/time-logs/long-logs", { credentials: "include" })
        if (!checkRes.ok) return
        const checkData = await checkRes.json()
        if (checkData.hasLongLogs && !cancelled) {
          await fetch("/api/time-logs/long-logs", {
            method: "POST",
            credentials: "include"
          })
          if (onTimeLogUpdate) onTimeLogUpdate()
        }
      } catch (error) {
        console.error("Error migrating long logs:", error)
        // Ignore errors, don't block DTR
      }
    }
    maybeMigrateLongLogs()
    return () => { cancelled = true }
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
                .sort(([keyA], [keyB]) => {
                  const dateA = new Date(keyA.split("-").slice(-3).join("-")).getTime()
                  const dateB = new Date(keyB.split("-").slice(-3).join("-")).getTime()
                  return sortDirection === "desc" ? dateB - dateA : dateA - dateB
                })
                .map(([key, logsForDate]) => {
                  const datePart = key.split("-").slice(-3).join("-")
                  
                  // Transform logs to use pending request data if available
                  const logsWithPendingData = logsForDate.map(log => getLogWithPendingData(log))
                  
                  // Check if any log in this date has pending edit requests
                  const hasAnyPendingEdit = logsForDate.some(log => hasPendingEdit(log.id))
                  
                  // Use centralized session processing with modified logs
                  const { sessions, totals } = processTimeLogSessions(logsWithPendingData)

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
                      
                      {/* Time In Column */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {sessions.map((session, i) => {
                            if (!session.timeIn) return null
                            let badgeProps = getTimeBadgeProps(
                              session.timeIn,
                              session.sessionType,
                              "in",
                              session.overtimeStatus === "none" ? undefined : session.overtimeStatus,
                              session.isContinuousSession
                            )
                            
                            // Apply yellow badge styling if any log in this date has pending edit
                            if (hasAnyPendingEdit) {
                              badgeProps = {
                                ...badgeProps,
                                variant: "outline" as const,
                                className: "bg-yellow-100 text-yellow-700 border-yellow-300"
                              }
                            }
                            
                            return (
                              <Badge key={i} variant={badgeProps.variant} className={badgeProps.className}>
                                {badgeProps.text}
                              </Badge>
                            )
                          })}
                        </div>
                      </TableCell>
                      
                      {/* Time Out Column */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {sessions.map((session, i) => {
                            let badgeProps = session.isActive
                              ? getTimeBadgeProps(null, session.sessionType, "active")
                              : getTimeBadgeProps(
                                  session.timeOut,
                                  session.sessionType,
                                  "out",
                                  session.overtimeStatus === "none" ? undefined : session.overtimeStatus,
                                  session.isContinuousSession
                                )
                            
                            // Apply yellow badge styling if any log in this date has pending edit
                            if (hasAnyPendingEdit) {
                              badgeProps = {
                                ...badgeProps,
                                variant: "outline" as const,
                                className: "bg-yellow-100 text-yellow-700 border-yellow-300"
                              }
                            }
                            
                            return (
                              <Badge key={i} variant={badgeProps.variant} className={badgeProps.className}>
                                {badgeProps.text}
                              </Badge>
                            )
                          })}
                        </div>
                      </TableCell>
                      
                      {/* Regular Shift Column */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {(() => {
                            let previousRegularHours = 0
                            return sessions.map((session, i) => {
                              const { adjustedRegularHours } = getAdjustedSessionHours(session, previousRegularHours)
                              let badgeProps = getDurationBadgeProps(adjustedRegularHours, "regular")
                              
                              // Apply yellow badge styling if any log in this date has pending edit
                              if (hasAnyPendingEdit) {
                                badgeProps = {
                                  ...badgeProps,
                                  variant: "outline" as const,
                                  className: "bg-yellow-100 text-yellow-700 border-yellow-300"
                                }
                              }
                              
                              previousRegularHours += adjustedRegularHours
                              
                              return (
                                <Badge key={i} variant={badgeProps.variant} className={badgeProps.className}>
                                  {badgeProps.text}
                                </Badge>
                              )
                            })
                          })()}
                          
                          {/* Show total only if multiple non-overtime sessions */}
                          {sessions.length > 1 && 
                           sessions.filter(s => !s.isOvertimeSession).length > 1 && (
                            <Badge 
                              variant="outline" 
                              className={
                                hasAnyPendingEdit 
                                  ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                                  : getTotalBadgeProps(totals.totalRegularHours, "regular").className
                              }
                            >
                              {getTotalBadgeProps(totals.totalRegularHours, "regular").text}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      
                      {/* Overtime Column */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {(() => {
                            let previousRegularHours = 0
                            return sessions.map((session, i) => {
                              const { adjustedOvertimeHours } = getAdjustedSessionHours(session, previousRegularHours)
                              let badgeProps = getDurationBadgeProps(
                                adjustedOvertimeHours,
                                "overtime",
                                session.overtimeStatus
                              )
                              
                              // Apply yellow badge styling if any log in this date has pending edit
                              if (hasAnyPendingEdit) {
                                badgeProps = {
                                  ...badgeProps,
                                  variant: "outline" as const,
                                  className: "bg-yellow-100 text-yellow-700 border-yellow-300"
                                }
                              }
                              
                              // Update previousRegularHours for next iteration
                              const { adjustedRegularHours } = getAdjustedSessionHours(session, previousRegularHours)
                              previousRegularHours += adjustedRegularHours
                              
                              return (
                                <Badge key={i} variant={badgeProps.variant} className={badgeProps.className}>
                                  {badgeProps.text}
                                </Badge>
                              )
                            })
                          })()}
                        </div>
                      </TableCell>
                      
                      {/* Actions Column */}
                      {(isAdmin || (isIntern && showActions)) && (
                        <TableCell className="text-right">
                          <EditTimeLogDialog
                            key={key}
                            logs={logsForDate}
                            onSave={isAdmin ? handleTimeLogUpdate : handleEditRequest}
                            onDelete={handleTimeLogDelete}
                            isLoading={isUpdating}
                            isAdmin={isAdmin}
                            isIntern={isIntern}
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
