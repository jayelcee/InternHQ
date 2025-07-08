/**
 * DailyTimeRecord Component
 * 
 * Displays daily time logs for interns, supporting admin and intern roles.
 * - Groups logs by date and processes sessions for regular and overtime hours.
 * - Handles edit requests, including continuous session edits.
 * - Provides UI for sorting, editing, and deleting logs.
 * - Applies visual indicators for pending edits and log statuses.
 * 
 * Props:
 *   - logs: TimeLogDisplay[] - Array of time log entries.
 *   - internId?: string - Optional filter for a specific intern.
 *   - loading?: boolean - Loading state.
 *   - error?: string | null - Error message.
 *   - onTimeLogUpdate?: () => void - Callback after log update.
 */

"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { EditTimeLogDialog } from "@/components/edit-time-log-dialog"
import { TimeLogDisplay, groupLogsByDate, formatLogDate, useSortDirection, sortGroupedLogsByDate } from "@/lib/ui-utils"
import { processTimeLogSessions, getTimeBadgeProps } from "@/lib/session-utils"
import { filterLogsByInternId, formatAccurateHours } from "@/lib/time-utils"

interface EditRequestMetadata {
  isContinuousSession?: boolean
  allLogIds?: number[]
}

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
  metadata?: EditRequestMetadata | string
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
  const { sortDirection, toggleSort, sortButtonText } = useSortDirection("desc")
  const [editRequests, setEditRequests] = useState<EditLogRequest[]>([])
  const isAdmin = user?.role === "admin"
  const isIntern = user?.role === "intern"

  // Fetch edit requests to show pending status
  const fetchEditRequestsData = async () => {
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
    fetchEditRequestsData()
  }, [logs])

  // Returns pending edit request for a log, if any
  const getPendingEditRequest = (logId: number): EditLogRequest | null => {
    return editRequests.find(req => req.logId === logId && req.status === "pending") || null
  }

  // Returns continuous session edit request affecting given logIds, if any
  const getContinuousSessionEditRequest = (logIds: number[]): EditLogRequest | null => {
    return editRequests.find(req => {
      if (req.status !== "pending" || !req.metadata) return false
      
      try {
        const metadata = typeof req.metadata === 'string' ? JSON.parse(req.metadata) : req.metadata
        if (metadata.isContinuousSession && metadata.allLogIds) {
          // Check if any of the provided logIds are in the continuous session
          return logIds.some(id => metadata.allLogIds.includes(id))
        }
      } catch (e) {
        console.error("Error parsing edit request metadata:", e)
      }
      
      return false
    }) || null
  }

  // Returns log with pending edit request data applied
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

  // Applies continuous session edit requests to logs
  const getLogsWithContinuousSessionEdits = (logs: TimeLogDisplay[]): TimeLogDisplay[] => {
    const logIds = logs.map(log => log.id)
    const continuousRequest = getContinuousSessionEditRequest(logIds)
    
    if (continuousRequest) {
      try {
        const metadata = typeof continuousRequest.metadata === 'string' 
          ? JSON.parse(continuousRequest.metadata) 
          : continuousRequest.metadata
          
        if (metadata.isContinuousSession && metadata.allLogIds) {
          // Apply the continuous session edit to all logs in the session
          return logs.map(log => {
            if (metadata.allLogIds.includes(log.id)) {
              // For continuous sessions, we need to reconstruct the logs
              // The first log gets the requested time_in, last log gets requested time_out
              const isFirstLog = log.id === Math.min(...metadata.allLogIds)
              const isLastLog = log.id === Math.max(...metadata.allLogIds)
              
              return {
                ...log,
                time_in: isFirstLog ? continuousRequest.requestedTimeIn || log.time_in : log.time_in,
                time_out: isLastLog ? continuousRequest.requestedTimeOut || log.time_out : log.time_out,
              }
            }
            return log
          })
        }
      } catch (e) {
        console.error("Error processing continuous session edit:", e)
      }
    }
    
    // Fall back to individual log edits
    return logs.map(log => getLogWithPendingData(log))
  }

  // Returns true if a log has a pending edit request (individual or continuous session)
  const hasPendingEdit = (logId: number): boolean => {
    return getPendingEditRequest(logId) !== null || getContinuousSessionEditRequest([logId]) !== null
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
      fetchEditRequestsData()
    } catch (error) {
      console.error("Error deleting time log:", error)
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

  // Group logs by intern and date for display count (like admin dashboard)
  const groupedLogs = groupLogsByDate(filterLogsByInternId(logs, internId));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-lg">All Intern Logs</CardTitle>
            <p className="text-sm text-gray-600">
              Showing {groupedLogs.length} of {groupedLogs.length} time records
            </p>
          </div>
          <div className="flex flex-row items-center gap-2 mt-2 sm:mt-0">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSort}
              type="button"
            >
              {sortButtonText}
            </Button>

            {(isIntern || isAdmin) && (
              !showActions ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowActions(true)}
                  type="button"
                >
                  {isIntern ? "Request Edit" : "Edit Log"}
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
                <TableHead className="w-45 whitespace-nowrap pr-16">Date</TableHead>
                <TableHead>Time In</TableHead>
                <TableHead>Time Out</TableHead>
                <TableHead>Regular Shift</TableHead>
                <TableHead>Overtime</TableHead>
                {((isAdmin && showActions) || (isIntern && showActions)) && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortGroupedLogsByDate(
                groupLogsByDate(
                  filterLogsByInternId(logs, internId)
                ), 
                sortDirection
              )
                .map(([key, logsForDate]) => {
                  const datePart = key.split("-").slice(-3).join("-")
                  
                  // Transform logs to use pending request data (including continuous sessions)
                  const logsWithPendingData = getLogsWithContinuousSessionEdits(logsForDate)
                  
                  // Check if any log in this date has pending edit requests
                  const hasAnyPendingEdit = logsForDate.some(log => hasPendingEdit(log.id))

                  // Check if any log in this date is active/pending (status === 'pending')
                  const hasAnyPendingLog = logsForDate.some(log => log.status === 'pending')
                  
                  // Use centralized session processing with modified logs
                  const { sessions } = processTimeLogSessions(logsWithPendingData)

                  return (
                    <TableRow key={key}>
                      <TableCell className="font-medium w-45 whitespace-nowrap pr-16">
                        <div className="flex flex-col items-start">
                          {(() => {
                            // Find the earliest timeIn and latest timeOut in the sessions for this date group
                            const validTimeIns = sessions.map(s => s.timeIn).filter((d): d is string => !!d)
                            const validTimeOuts = sessions.map(s => s.timeOut).filter((d): d is string => !!d)
                            let minTimeIn: Date | null = null
                            let maxTimeOut: Date | null = null
                            if (validTimeIns.length) {
                              minTimeIn = new Date(validTimeIns.reduce((a, b) => (new Date(a) < new Date(b) ? a : b)))
                            }
                            if (validTimeOuts.length) {
                              maxTimeOut = new Date(validTimeOuts.reduce((a, b) => (new Date(a) > new Date(b) ? a : b)))
                            }
                            // Format: MMM d, yyyy (e.g., Jun 19, 2025)
                            const formatDate = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            const formatDay = (date: Date) => date.toLocaleDateString("en-US", { weekday: "short" })
                            // If any session is active (in progress), use minTimeIn for day and date
                            const anyActive = sessions.some(s => s.isActive)
                            if (anyActive && minTimeIn) {
                              return (
                                <>
                                  <span className="text-xs text-gray-500">{formatDay(minTimeIn)}</span>
                                  <span>{formatDate(minTimeIn)}</span>
                                </>
                              )
                            } else if (minTimeIn && maxTimeOut) {
                              const startDate = formatDate(minTimeIn)
                              const endDate = formatDate(maxTimeOut)
                              const startDay = formatDay(minTimeIn)
                              const endDay = formatDay(maxTimeOut)
                              if (startDate !== endDate) {
                                // Spans two dates, show as range with days above
                                return (
                                  <>
                                    <span className="text-xs text-gray-500">{startDay} – {endDay}</span>
                                    <span>{startDate} – {endDate}</span>
                                  </>
                                )
                              } else {
                                // Single date, show day above
                                return (
                                  <>
                                    <span className="text-xs text-gray-500">{startDay}</span>
                                    <span>{startDate}</span>
                                  </>
                                )
                              }
                            } else {
                              // Fallback to original logic
                              return (
                                <span>{formatLogDate(datePart)}</span>
                              )
                            }
                          })()}
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
                          {sessions.map((session, i) => {
                            // Use session processing results directly
                            const displayText = formatAccurateHours(session.regularHours)
                            let badgeProps = {
                              variant: "outline" as const,
                              className: session.regularHours > 0 ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-gray-100 text-gray-700 border-gray-300",
                              text: displayText
                            }
                            
                            // Apply yellow badge styling if any log in this date has pending edit
                            if (hasAnyPendingEdit) {
                              badgeProps = {
                                ...badgeProps,
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
                      
                      {/* Overtime Column */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {sessions.map((session, i) => {
                            // Use session processing results directly
                            const displayText = formatAccurateHours(session.overtimeHours)
                            let badgeProps = {
                              variant: "outline" as const,
                              className: session.overtimeHours > 0 ? 
                                (session.overtimeStatus === "approved" ? "bg-purple-100 text-purple-700 border-purple-300" :
                                 session.overtimeStatus === "rejected" ? "bg-gray-100 text-gray-700 border-gray-300" :
                                 "bg-yellow-100 text-yellow-700 border-yellow-300") :
                                "bg-gray-100 text-gray-700 border-gray-300",
                              text: displayText
                            }
                            
                            // Apply yellow badge styling if any log in this date has pending edit
                            if (hasAnyPendingEdit) {
                              badgeProps = {
                                ...badgeProps,
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
                      
                      {/* Actions Column */}
                      {((isAdmin && showActions) || (isIntern && showActions)) && (
                        <TableCell className="text-right align-center" title="Edit Log">
                          <div className="flex justify-end">
                            <EditTimeLogDialog
                              key={key}
                              logs={logsForDate}
                              onDelete={handleTimeLogDelete}
                              isLoading={isUpdating}
                              isAdmin={isAdmin}
                              isIntern={isIntern}
                              // For interns, disable if any log is pending (active/in-progress) OR has a pending edit request
                              disabled={isIntern ? (hasAnyPendingLog || hasAnyPendingEdit) : hasAnyPendingEdit}
                              disabledReason={
                                isIntern
                                  ? hasAnyPendingLog
                                    ? "Cannot edit logs while in progress. Do it after time out."
                                    : hasAnyPendingEdit
                                      ? "Cannot edit logs with pending edit requests."
                                      : ""
                                  : hasAnyPendingEdit
                                    ? "Cannot edit logs with pending edit requests"
                                    : ""
                              }
                            />
                          </div>
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
