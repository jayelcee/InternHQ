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
import { filterLogsByInternId, calculateAccurateSessionDuration, formatAccurateHours } from "@/lib/time-utils"

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
  // Sort state management - centralized
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

  // Helper function to get pending edit request for a log
  const getPendingEditRequest = (logId: number): EditLogRequest | null => {
    return editRequests.find(req => req.logId === logId && req.status === "pending") || null
  }

  // Helper function to get effective time (requested if pending, otherwise original)
  // const getEffectiveTime = (log: TimeLogDisplay, field: "time_in" | "time_out"): string | null => {
  //   const pendingRequest = getPendingEditRequest(log.id)
  //   if (pendingRequest) {
  //     return field === "time_in" ? pendingRequest.requestedTimeIn : pendingRequest.requestedTimeOut
  //   }
  //   return log[field]
  // }

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
  // const getPendingBadgeProps = (originalBadgeProps: any, logId: number) => {
  //   if (hasPendingEdit(logId)) {
  //     return {
  //       ...originalBadgeProps,
  //       variant: "outline" as const,
  //       className: "bg-yellow-100 text-yellow-700 border-yellow-300"
  //     }
  //   }
  //   return originalBadgeProps
  // }

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
      fetchEditRequestsData()
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
      fetchEditRequestsData()
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
      fetchEditRequestsData()
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
              onClick={toggleSort}
              type="button"
            >
              {sortButtonText}
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
              {sortGroupedLogsByDate(
                groupLogsByDate(
                  filterLogsByInternId(logs, internId)
                ), 
                sortDirection
              )
                .map(([key, logsForDate]) => {
                  const datePart = key.split("-").slice(-3).join("-")
                  
                  // Transform logs to use pending request data if available
                  const logsWithPendingData = logsForDate.map(log => getLogWithPendingData(log))
                  
                  // Check if any log in this date has pending edit requests
                  const hasAnyPendingEdit = logsForDate.some(log => hasPendingEdit(log.id))
                  
                  // Use centralized session processing with modified logs
                  const { sessions } = processTimeLogSessions(logsWithPendingData)

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
                              // Use accurate calculation instead of centralized truncation
                              const accurateCalc = calculateAccurateSessionDuration(
                                session.logs,
                                new Date(),
                                previousRegularHours
                              )
                              
                              const displayText = formatAccurateHours(accurateCalc.regularHours)
                              let badgeProps = {
                                variant: "outline" as const,
                                className: accurateCalc.regularHours > 0 ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-gray-100 text-gray-700 border-gray-300",
                                text: displayText
                              }
                              
                              // Apply yellow badge styling if any log in this date has pending edit
                              if (hasAnyPendingEdit) {
                                badgeProps = {
                                  ...badgeProps,
                                  className: "bg-yellow-100 text-yellow-700 border-yellow-300"
                                }
                              }
                              
                              // Update tracking variables for next iteration
                              previousRegularHours += accurateCalc.regularHours
                              
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
                                  : "bg-blue-200 text-blue-800 border-blue-400 font-medium"
                              }
                            >
                              Total: {formatAccurateHours(
                                sessions.reduce((total, session, i) => {
                                  const prevHours = sessions.slice(0, i).reduce((sum, prevSession) => 
                                    sum + calculateAccurateSessionDuration(prevSession.logs, new Date(), 0).regularHours, 0)
                                  return total + calculateAccurateSessionDuration(session.logs, new Date(), prevHours).regularHours
                                }, 0)
                              )}
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
                              // Use accurate calculation for overtime
                              const accurateCalc = calculateAccurateSessionDuration(
                                session.logs,
                                new Date(),
                                previousRegularHours
                              )
                              
                              const displayText = formatAccurateHours(accurateCalc.overtimeHours)
                              let badgeProps = {
                                variant: "outline" as const,
                                className: accurateCalc.overtimeHours > 0 ? 
                                  (accurateCalc.overtimeStatus === "approved" ? "bg-purple-100 text-purple-700 border-purple-300" :
                                   accurateCalc.overtimeStatus === "rejected" ? "bg-gray-100 text-gray-700 border-gray-300" :
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
                              
                              // Update tracking variables for next iteration
                              previousRegularHours += accurateCalc.regularHours
                              
                              return (
                                <Badge key={i} variant={badgeProps.variant} className={badgeProps.className}>
                                  {badgeProps.text}
                                </Badge>
                              )
                            })
                          })()}
                          
                          {/* Show overtime total only if multiple sessions with overtime */}
                          {sessions.length > 1 && 
                           sessions.some(s => s.isOvertimeSession || 
                             calculateAccurateSessionDuration(s.logs, new Date(), 0).overtimeHours > 0) && (
                            <Badge 
                              variant="outline" 
                              className={
                                hasAnyPendingEdit 
                                  ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                                  : "bg-purple-200 text-purple-800 border-purple-400 font-medium"
                              }
                            >
                              Total: {formatAccurateHours(
                                sessions.reduce((total, session, i) => {
                                  const prevHours = sessions.slice(0, i).reduce((sum, prevSession) => 
                                    sum + calculateAccurateSessionDuration(prevSession.logs, new Date(), 0).regularHours, 0)
                                  return total + calculateAccurateSessionDuration(session.logs, new Date(), prevHours).overtimeHours
                                }, 0)
                              )}
                            </Badge>
                          )}
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
