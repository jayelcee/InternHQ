"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { calculateTimeWorked, truncateTo2Decimals, DAILY_REQUIRED_HOURS } from "@/lib/time-utils"
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
  freezeAt?: Date | null
}

// Helper function to calculate regular hours for a session
function calculateSessionRegularHours(session: TimeLogDisplay[], endTime: Date | string): number {
  // If this is a pure overtime session (all logs are marked as overtime), return 0 immediately
  const isPureOvertimeSession = session.every(log => log.log_type === "overtime" || log.log_type === "extended_overtime");
  if (isPureOvertimeSession) {
    return 0;
  }
  
  let sessionHours = 0;
  for (const log of session) {
    if ((log.log_type === "regular" || !log.log_type)) {
      if (log.time_in && log.time_out) {
        const result = calculateTimeWorked(log.time_in, log.time_out);
        sessionHours += result.hoursWorked;
      } else if (log.time_in && !log.time_out) {
        const result = calculateTimeWorked(log.time_in, typeof endTime === 'string' ? endTime : endTime.toISOString());
        sessionHours += result.hoursWorked;
      }
    }
  }
  return sessionHours;
}

export function ThisWeekLogs({ 
  weeklyLogs, 
  loading, 
  error, 
  currentTime,
  isTimedIn = false,
  isOvertimeIn = false,
  timeInTimestamp = null,
  overtimeInTimestamp = null,
  freezeAt = null
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
                  <TableHead>Regular Shift</TableHead>
                  <TableHead>Overtime</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupLogsByDate(weeklyLogs).map(([key, logsForDate]) => {
                  // Extract date part from the group key (format: "internId-YYYY-MM-DD")
                  const datePart = key.split("-").slice(-3).join("-") // gets "YYYY-MM-DD"

                  // Separate regular and overtime logs
                  // Treat logs without log_type or with log_type="regular" as regular logs
                  const regularLogs = logsForDate.filter(log => !log.log_type || log.log_type === "regular")
                  const overtimeLogs = logsForDate.filter(log => log.log_type === "overtime" || log.log_type === "extended_overtime")
                  
                  // Sort all logs by time_in for chronological order
                  const allLogs = [...regularLogs, ...overtimeLogs].sort((a, b) => {
                    const aTime = a.time_in || a.time_out || ""
                    const bTime = b.time_in || b.time_out || ""
                    return new Date(aTime).getTime() - new Date(bTime).getTime()
                  })

                  // Helper function to check if logs are continuous (no gap between them)
                  const isContinuous = (log1: TimeLogDisplay, log2: TimeLogDisplay): boolean => {
                    if (!log1.time_out || !log2.time_in) return false
                    const gap = new Date(log2.time_in).getTime() - new Date(log1.time_out).getTime()
                    return gap <= 60 * 1000 // 1 minute tolerance for truly continuous sessions
                  }

                  // Group logs into continuous sessions
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
                  if (currentSession.length > 0) {
                    sessions.push(currentSession)
                  }
                  
                  // Debug session formation for Friday
                  if (datePart === "2025-06-27") {
                    console.log("Sessions formed:", sessions.map((s, i) => ({
                      sessionIndex: i,
                      types: s.map(log => log.log_type),
                      timeIns: s.map(log => log.time_in ? new Date(log.time_in).toLocaleTimeString() : null),
                      timeOuts: s.map(log => log.time_out ? new Date(log.time_out).toLocaleTimeString() : null),
                      isOvertime: s.every(log => log.log_type === "overtime" || log.log_type === "extended_overtime"),
                      hasRegular: s.some(log => log.log_type === "regular" || !log.log_type)
                    })));
                  }

                  // Handle active sessions for today
                  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD format
                  const isToday = datePart === today
                  
                  // Add active dashboard session if no database logs exist for today
                  if (isToday && (isTimedIn || isOvertimeIn) && allLogs.filter(log => log.time_in && !log.time_out).length === 0) {
                    const activeSession: TimeLogDisplay[] = []
                    
                    if (isTimedIn && timeInTimestamp) {
                      activeSession.push({
                        id: -1, // Temporary ID for dashboard session
                        time_in: timeInTimestamp.toISOString(),
                        time_out: null,
                        status: "pending",
                        log_type: "regular"
                      })
                    }
                    
                    if (isOvertimeIn && overtimeInTimestamp) {
                      activeSession.push({
                        id: -2, // Temporary ID for dashboard overtime session
                        time_in: overtimeInTimestamp.toISOString(),
                        time_out: null,
                        status: "pending",
                        log_type: "overtime"
                      })
                    }
                    
                    if (activeSession.length > 0) {
                      sessions.push(activeSession)
                    }
                  }

                  // Always display all sessions for a date in one row with multiple time stamps
                  // Calculate combined totals for all sessions in this date
                  let totalRegularHours = 0
                  let totalOvertimeHours = 0
                  let overallOvertimeStatus = "none"
                  
                  // Calculate totals by processing individual logs
                  for (const session of sessions) {
                    // Skip pure overtime sessions for regular hours calculation
                    const isPureOvertimeSession = session.every(log => log.log_type === "overtime" || log.log_type === "extended_overtime");
                    
                    for (const log of session) {
                      if (log.time_in && log.time_out) {
                        const result = calculateTimeWorked(log.time_in, log.time_out)
                        const logHours = result.hoursWorked
                        
                        // Debug logging for Friday
                        if (datePart === "2025-06-27") {
                          console.log("Friday log:", {
                            log_type: log.log_type,
                            time_in: log.time_in,
                            time_out: log.time_out,
                            logHours,
                            isOvertime: log.log_type === "overtime" || log.log_type === "extended_overtime",
                            isPureOvertimeSession
                          })
                        }
                        
                        if (log.log_type === "overtime" || log.log_type === "extended_overtime") {
                          // Overtime log - add hours to overtime total
                          totalOvertimeHours += logHours
                          
                          // Determine overtime status
                          if (log.overtime_status === "approved" && overallOvertimeStatus !== "rejected") {
                            overallOvertimeStatus = "approved"
                          } else if ((!log.overtime_status || log.overtime_status === "pending") && overallOvertimeStatus === "none") {
                            overallOvertimeStatus = "pending"
                          } else if (log.overtime_status === "rejected") {
                            overallOvertimeStatus = "rejected"
                          }
                        } else {
                          // Regular log (null, undefined, or "regular") - add hours to regular total
                          totalRegularHours += logHours
                        }
                      } else if (log.time_in && !log.time_out) {
                        // Active session - calculate from time_in to freeze time or current time
                        const endTime = freezeAt || currentTime
                        const result = calculateTimeWorked(log.time_in, endTime.toISOString())
                        const logHours = result.hoursWorked
                        
                        // Debug logging for Friday
                        if (datePart === "2025-06-27") {
                          console.log("Friday active log:", {
                            log_type: log.log_type,
                            time_in: log.time_in,
                            logHours,
                            isOvertime: log.log_type === "overtime" || log.log_type === "extended_overtime"
                          })
                        }
                        
                        if (log.log_type === "overtime" || log.log_type === "extended_overtime") {
                          totalOvertimeHours += logHours
                          if (overallOvertimeStatus === "none") {
                            overallOvertimeStatus = "pending"
                          }
                        } else {
                          totalRegularHours += logHours
                        }
                      }
                    }
                  }
                  
                  // Debug logging for Friday final totals
                  if (datePart === "2025-06-27") {
                    console.log("Friday totals before cap:", {
                      totalRegularHours,
                      totalOvertimeHours,
                      DAILY_REQUIRED_HOURS
                    })
                  }

                  // Debug total hours before capping (for Friday)
                  if (datePart === "2025-06-27") {
                    console.log("Total hours before capping:", {
                      totalRegularHours,
                      totalOvertimeHours,
                      sessions: sessions.map(s => ({
                        types: s.map(log => log.log_type),
                        isOvertimeOnly: s.every(log => log.log_type === "overtime" || log.log_type === "extended_overtime")
                      }))
                    });
                  }
                  
                  // After calculating all hours, apply the daily cap and move excess to overtime
                  if (totalRegularHours > DAILY_REQUIRED_HOURS) {
                    const excess = totalRegularHours - DAILY_REQUIRED_HOURS
                    totalOvertimeHours += excess
                    totalRegularHours = DAILY_REQUIRED_HOURS
                    if (overallOvertimeStatus === "none") {
                      overallOvertimeStatus = "pending"
                    }
                  }

                  // Cap totals if overtime is rejected
                  if (overallOvertimeStatus === "rejected") {
                    totalRegularHours = Math.min(totalRegularHours, DAILY_REQUIRED_HOURS)
                    totalOvertimeHours = 0
                  }

                  // Return single row with all timestamps
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
                          {sessions.map((session, sessionIndex) => {
                            const sessionTimeIn = session[0]?.time_in
                            const isOvertimeSession = session.every(log => log.log_type === "overtime" || log.log_type === "extended_overtime")
                            const overtimeStatus = isOvertimeSession ? session[0]?.overtime_status : null
                            
                            return sessionTimeIn ? (
                              <Badge 
                                key={sessionIndex} 
                                variant="outline" 
                                className={
                                  isOvertimeSession
                                    ? overtimeStatus === "approved"
                                      ? "bg-purple-100 text-purple-700 border-purple-300"
                                      : overtimeStatus === "rejected"
                                        ? "bg-gray-100 text-gray-700 border-gray-300"
                                        : "bg-yellow-100 text-yellow-700 border-yellow-300" // pending or no status
                                    : "bg-green-100 text-green-700 border-green-300" // regular session
                                }
                              >
                                {new Date(sessionTimeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </Badge>
                            ) : null
                          }).filter(Boolean)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {sessions.map((session, sessionIndex) => {
                            // Get the session's time out and overtime status
                            const isOvertimeSession = session.every(log => log.log_type === "overtime" || log.log_type === "extended_overtime")
                            const overtimeStatus = isOvertimeSession ? session[0]?.overtime_status : null
                            const isActiveSession = session.some(log => log.time_in && !log.time_out)
                            
                            // For overtime sessions, always use the actual time_out from the database
                            // For regular sessions, use the actual time_out regardless of overtime status
                            let sessionTimeOut: string | null = null
                            
                            if (isOvertimeSession) {
                              // For pure overtime sessions, use the actual database time_out
                              const lastLog = session[session.length - 1]
                              sessionTimeOut = lastLog?.time_out || null
                            } else {
                              // For regular sessions, always use the actual time_out from the last log
                              // Do not modify time_out based on overtime rejection status
                              const lastLog = session[session.length - 1]
                              sessionTimeOut = lastLog?.time_out || null
                            }
                            
                            if (sessionTimeOut && !isActiveSession) {
                              return (
                                <Badge 
                                  key={sessionIndex} 
                                  variant="outline" 
                                  className={
                                    isOvertimeSession
                                      ? overtimeStatus === "approved"
                                        ? "bg-purple-100 text-purple-700 border-purple-300"
                                        : overtimeStatus === "rejected"
                                          ? "bg-gray-100 text-gray-700 border-gray-300"
                                          : "bg-yellow-100 text-yellow-700 border-yellow-300" // pending or no status
                                      : "bg-red-100 text-red-700 border-red-300" // regular session
                                  }
                                >
                                  {new Date(sessionTimeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </Badge>
                              )
                            } else if (isActiveSession) {
                              return (
                                <Badge key={sessionIndex} variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                                  In Progress
                                </Badge>
                              )
                            } else {
                              return (
                                <span key={sessionIndex} className="text-gray-400">--</span>
                              )
                            }
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {/* 
                            For each session, only render one badge in the hours worked column:
                            - For overtime-only sessions: show "0.00h" in gray
                            - For regular sessions: show the calculated regular hours
                           */}
                          {sessions.map((session, sessionIndex) => {
                            // Check if this is a pure overtime session (all logs are overtime type)
                            const isOvertimeOnlySession = session.every(log => log.log_type === "overtime" || log.log_type === "extended_overtime");
                            if (isOvertimeOnlySession) {
                              // Overtime-only session: show 0.00h in gray
                              return (
                                <Badge key={sessionIndex} variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">
                                  0h 00m
                                </Badge>
                              );
                            } else {
                              // Regular session: calculate hours worked
                              let sessionRegularHours = 0;
                              let sessionRegularMinutes = 0;
                              for (const log of session) {
                                if (log.log_type === "regular" || !log.log_type) {
                                  if (log.time_in && log.time_out) {
                                    const result = calculateTimeWorked(log.time_in, log.time_out);
                                    sessionRegularHours += Math.floor(result.hoursWorked);
                                    sessionRegularMinutes += Math.round((result.hoursWorked % 1) * 60);
                                  } else if (log.time_in && !log.time_out) {
                                    const endTime = freezeAt || currentTime;
                                    const result = calculateTimeWorked(
                                      log.time_in, 
                                      typeof endTime === 'string' ? endTime : endTime.toISOString()
                                    );
                                    sessionRegularHours += Math.floor(result.hoursWorked);
                                    sessionRegularMinutes += Math.round((result.hoursWorked % 1) * 60);
                                  }
                                }
                              }
                              // Normalize minutes to hours
                              sessionRegularHours += Math.floor(sessionRegularMinutes / 60);
                              sessionRegularMinutes = sessionRegularMinutes % 60;
                              // Cap at daily required hours
                              const cappedHours = Math.min(sessionRegularHours + sessionRegularMinutes / 60, DAILY_REQUIRED_HOURS);
                              const displayHours = Math.floor(cappedHours);
                              const displayMinutes = Math.round((cappedHours % 1) * 60);
                              return (
                                <Badge 
                                  key={sessionIndex} 
                                  variant="outline" 
                                  className={cappedHours > 0 
                                    ? "bg-blue-100 text-blue-700 border-blue-300"
                                    : "bg-gray-100 text-gray-700 border-gray-300"
                                  }>
                                  {`${displayHours}h ${displayMinutes.toString().padStart(2, '0')}m`}
                                </Badge>
                              );
                            }
                          })}
                          
                          {/* 
                            Show total only if:
                            1. Multiple sessions exist
                            2. At least one session has regular hours (not all are pure overtime)
                            3. There's at least one session that isn't being displayed with 0.00h due to being pure overtime
                          */}
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
                          {sessions.map((session, sessionIndex) => {
                            // Debug the session type for each session to help identify what's happening
                            if (datePart === "2025-06-27") {
                              console.log(`Session ${sessionIndex} Types:`, session.map(log => log.log_type));
                            }
                            
                            // Calculate overtime hours for this session
                            let sessionOvertimeHours = 0
                            let sessionOvertimeMinutes = 0
                            let sessionOvertimeStatus = "none"
                            let sessionRegularHoursForOvertime = 0
                            
                            // Calculate total regular hours for this session using the helper function
                            sessionRegularHoursForOvertime = calculateSessionRegularHours(session, freezeAt || currentTime);
                            
                            // Calculate completed regular hours from all other sessions on this date
                            let otherSessionsRegularHours = 0
                            sessions.forEach((otherSession, otherIndex) => {
                              if (otherIndex !== sessionIndex) {
                                for (const log of otherSession) {
                                  if ((log.log_type === "regular" || !log.log_type) && log.time_in && log.time_out) {
                                    const result = calculateTimeWorked(log.time_in, log.time_out)
                                    otherSessionsRegularHours += result.hoursWorked
                                  }
                                }
                              }
                            })
                            
                            // Calculate overtime from regular hour overflow
                            const totalRegularHoursBeforeSession = otherSessionsRegularHours
                            const remainingRegularCapacity = Math.max(0, DAILY_REQUIRED_HOURS - totalRegularHoursBeforeSession)
                            
                            if (sessionRegularHoursForOvertime > remainingRegularCapacity) {
                              const overflowOvertime = sessionRegularHoursForOvertime - remainingRegularCapacity
                              // Truncate to minutes (no rounding)
                              const overflowMinutes = Math.floor((overflowOvertime % 1) * 60)
                              sessionOvertimeHours += Math.floor(overflowOvertime)
                              sessionOvertimeMinutes += overflowMinutes
                              if (sessionOvertimeStatus === "none") {
                                sessionOvertimeStatus = "pending"
                              }
                            }
                            
                            // Add explicit overtime logs
                            for (const log of session) {
                              if (log.log_type === "overtime" || log.log_type === "extended_overtime") {
                                if (log.time_in && log.time_out) {
                                  const result = calculateTimeWorked(log.time_in, log.time_out)
                                  sessionOvertimeHours += Math.floor(result.hoursWorked)
                                  sessionOvertimeMinutes += Math.floor((result.hoursWorked % 1) * 60)
                                } else if (log.time_in && !log.time_out) {
                                  const endTime = freezeAt || currentTime
                                  const result = calculateTimeWorked(log.time_in, endTime.toISOString())
                                  sessionOvertimeHours += Math.floor(result.hoursWorked)
                                  sessionOvertimeMinutes += Math.floor((result.hoursWorked % 1) * 60)
                                }
                                
                                // Determine session overtime status
                                if (log.overtime_status === "approved") {
                                  sessionOvertimeStatus = "approved"
                                } else if (log.overtime_status === "rejected") {
                                  sessionOvertimeStatus = "rejected"
                                } else if (sessionOvertimeStatus === "none") {
                                  sessionOvertimeStatus = "pending"
                                }
                              }
                            }
                            
                            // Normalize minutes to hours
                            sessionOvertimeHours += Math.floor(sessionOvertimeMinutes / 60);
                            sessionOvertimeMinutes = sessionOvertimeMinutes % 60;
                            // Show a badge for overtime duration
                            const displayHours = sessionOvertimeHours;
                            const displayMinutes = sessionOvertimeMinutes;
                            return (
                              <Badge 
                                key={sessionIndex}
                                variant="outline" 
                                className={
                                  displayHours === 0 && displayMinutes === 0
                                    ? "bg-gray-100 text-gray-700 border-gray-300"
                                    : sessionOvertimeStatus === "approved" 
                                      ? "bg-purple-100 text-purple-700 border-purple-300"
                                      : sessionOvertimeStatus === "rejected"
                                        ? "bg-gray-100 text-gray-700 border-gray-300"
                                        : "bg-yellow-100 text-yellow-700 border-yellow-300" // pending or no status
                                }
                              >
                                {`${displayHours}h ${displayMinutes.toString().padStart(2, '0')}m`}
                              </Badge>
                            )
                          }).filter(Boolean)}
                          
                          {/* We now show 0.00h directly in each session's badge */}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                }).flat()}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
