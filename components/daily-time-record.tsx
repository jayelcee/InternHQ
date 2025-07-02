"use client"

import { Badge } from "@/components/ui/badge"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { EditTimeLogDialog } from "@/components/edit-time-log-dialog"
import { TimeLogDisplay, groupLogsByDate, formatLogDate, useSortDirection, sortGroupedLogsByDate } from "@/lib/ui-utils"
import { processTimeLogSessions, getTimeBadgeProps } from "@/lib/session-utils"
import { filterLogsByInternId, calculateAccurateSessionDuration, formatAccurateHours, calculateRawSessionDuration } from "@/lib/time-utils"

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

  // State for long logs migration
  const [migrationStatus, setMigrationStatus] = useState<{ hasLongLogs: boolean; count: number }>({
    hasLongLogs: false,
    count: 0
  })
  const [migrationLoading, setMigrationLoading] = useState(false)

  // Check if there are long logs that need migration
  const checkLongLogs = useCallback(async () => {
    try {
      // Determine the user ID to check
      let targetUserId: string | null = null
      
      if (internId) {
        // Admin viewing specific intern or explicit internId provided
        targetUserId = internId
      } else if (isIntern && user?.id) {
        // Intern viewing their own DTR
        targetUserId = String(user.id)
      }
      
      // Use user-specific endpoint if we have a target user ID, otherwise global endpoint
      const endpoint = targetUserId 
        ? `/api/time-logs/long-logs/user/${targetUserId}`
        : "/api/time-logs/long-logs"
      
      const response = await fetch(endpoint, {
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
  }, [internId, isIntern, user?.id])

  // Check for long logs on component mount
  useEffect(() => {
    checkLongLogs()
  }, [checkLongLogs])

  // Handle manual migration of long logs
  const handleMigration = async () => {
    if (migrationLoading) return
    
    setMigrationLoading(true)
    try {
      // Determine the user ID to migrate
      let targetUserId: string | null = null
      
      if (internId) {
        // Admin viewing specific intern or explicit internId provided
        targetUserId = internId
      } else if (isIntern && user?.id) {
        // Intern viewing their own DTR
        targetUserId = String(user.id)
      }
      
      // Use user-specific endpoint if we have a target user ID, otherwise global endpoint
      const endpoint = targetUserId 
        ? `/api/time-logs/long-logs/user/${targetUserId}/migrate`
        : "/api/time-logs/long-logs"
      
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
      })
      
      if (response.ok) {
        await response.json()
        // Refresh data after migration
        if (onTimeLogUpdate) onTimeLogUpdate()
        await checkLongLogs()
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
                        </div>
                      </TableCell>
                      
                      {/* Overtime Column */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {(() => {
                            let previousRegularHours = 0
                            return sessions.map((session, i) => {
                              // Use raw calculation for overtime display (shows actual time worked)
                              const rawCalc = calculateRawSessionDuration(
                                session.logs,
                                new Date(),
                                previousRegularHours
                              )
                              
                              const displayText = formatAccurateHours(rawCalc.overtimeHours)
                              let badgeProps = {
                                variant: "outline" as const,
                                className: rawCalc.overtimeHours > 0 ? 
                                  (rawCalc.overtimeStatus === "approved" ? "bg-purple-100 text-purple-700 border-purple-300" :
                                   rawCalc.overtimeStatus === "rejected" ? "bg-gray-100 text-gray-700 border-gray-300" :
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
                              
                              // Update tracking variables for next iteration using RAW hours for display consistency
                              previousRegularHours += rawCalc.regularHours
                              
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
