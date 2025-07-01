"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { TimeLogDisplay, groupLogsByDate, formatLogDate } from "@/lib/ui-utils"
import { processTimeLogSessions, getTimeBadgeProps } from "@/lib/session-utils"
import { calculateAccurateSessionDuration, formatAccurateHours, calculateRawSessionDuration } from "@/lib/time-utils"

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

/**
 * ThisWeekLogs Component
 * 
 * Displays a weekly view of time logs with session grouping and overtime calculations.
 * Uses centralized session processing utilities for consistent business logic.
 */
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
                  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD format
                  const isToday = datePart === today

                  // Add active dashboard session if no database logs exist for today
                  const activeLogs = [...logsForDate]
                  if (isToday && (isTimedIn || isOvertimeIn) && !activeLogs.some(log => log.time_in && !log.time_out)) {
                    if (isTimedIn && timeInTimestamp) {
                      activeLogs.push({
                        id: -1,
                        time_in: timeInTimestamp.toISOString(),
                        time_out: null,
                        status: "pending",
                        log_type: "regular"
                      })
                    }
                    
                    if (isOvertimeIn && overtimeInTimestamp) {
                      activeLogs.push({
                        id: -2,
                        time_in: overtimeInTimestamp.toISOString(),
                        time_out: null,
                        status: "pending",
                        log_type: "overtime"
                      })
                    }
                  }

                  // Process sessions using centralized logic
                  const sessionData = processTimeLogSessions(activeLogs, freezeAt || currentTime)

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
                          {sessionData.sessions.map((session, sessionIndex) => {
                            const timeIn = session.timeIn
                            if (!timeIn) return null
                            
                            const badgeProps = getTimeBadgeProps(
                              timeIn, 
                              session.sessionType, 
                              "in", 
                              session.overtimeStatus,
                              session.isContinuousSession
                            )
                            
                            return (
                              <Badge 
                                key={sessionIndex} 
                                variant="outline" 
                                className={badgeProps.className}
                              >
                                {badgeProps.text}
                              </Badge>
                            )
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {sessionData.sessions.map((session, sessionIndex) => {
                            const timeOut = session.timeOut
                            const isActive = session.isActive
                            
                            if (isActive) {
                              const badgeProps = getTimeBadgeProps(null, session.sessionType, "active")
                              return (
                                <Badge key={sessionIndex} variant="outline" className={badgeProps.className}>
                                  {badgeProps.text}
                                </Badge>
                              )
                            } else if (timeOut) {
                              const badgeProps = getTimeBadgeProps(
                                timeOut, 
                                session.sessionType, 
                                "out", 
                                session.overtimeStatus,
                                session.isContinuousSession
                              )
                              return (
                                <Badge 
                                  key={sessionIndex} 
                                  variant="outline" 
                                  className={badgeProps.className}
                                >
                                  {badgeProps.text}
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
                          {(() => {
                            let previousRegularHours = 0
                            return sessionData.sessions.map((session, sessionIndex) => {
                              // Use accurate calculation instead of session-utils truncation
                              const accurateCalc = calculateAccurateSessionDuration(
                                session.logs,
                                freezeAt || currentTime,
                                previousRegularHours
                              )
                              
                              const displayText = formatAccurateHours(accurateCalc.regularHours)
                              const badgeProps = {
                                variant: "outline" as const,
                                className: accurateCalc.regularHours > 0 ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-gray-100 text-gray-700 border-gray-300",
                                text: displayText
                              }
                              
                              previousRegularHours += accurateCalc.regularHours
                              
                              return (
                                <Badge 
                                  key={sessionIndex} 
                                  variant={badgeProps.variant} 
                                  className={badgeProps.className}
                                >
                                  {badgeProps.text}
                                </Badge>
                              )
                            })
                          })()}
                          
                          {/* Show total if multiple non-overtime sessions */}
                          {sessionData.sessions.length > 1 && 
                           sessionData.sessions.filter(s => !s.isOvertimeSession).length > 1 && (
                            <Badge 
                              variant="outline" 
                              className="bg-blue-200 text-blue-800 border-blue-400 font-medium"
                            >
                              Total: {formatAccurateHours(
                                sessionData.sessions.reduce((total, session, i) => {
                                  const prevHours = sessionData.sessions.slice(0, i).reduce((sum, prevSession) => 
                                    sum + calculateAccurateSessionDuration(prevSession.logs, freezeAt || currentTime, 0).regularHours, 0)
                                  return total + calculateAccurateSessionDuration(session.logs, freezeAt || currentTime, prevHours).regularHours
                                }, 0)
                              )}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {(() => {
                            let previousRegularHours = 0
                            return sessionData.sessions.map((session, sessionIndex) => {
                              // Use raw calculation for overtime display (shows actual time worked)
                              const rawCalc = calculateRawSessionDuration(
                                session.logs,
                                freezeAt || currentTime,
                                previousRegularHours
                              )
                              
                              const displayText = formatAccurateHours(rawCalc.overtimeHours)
                              const badgeProps = {
                                variant: "outline" as const,
                                className: rawCalc.overtimeHours > 0 ? 
                                  (rawCalc.overtimeStatus === "approved" ? "bg-purple-100 text-purple-700 border-purple-300" :
                                   rawCalc.overtimeStatus === "rejected" ? "bg-gray-100 text-gray-700 border-gray-300" :
                                   "bg-yellow-100 text-yellow-700 border-yellow-300") :
                                  "bg-gray-100 text-gray-700 border-gray-300",
                                text: displayText
                              }
                              
                              // Update previousRegularHours for next iteration using RAW hours for display consistency
                              previousRegularHours += rawCalc.regularHours
                              
                              return (
                                <Badge 
                                  key={sessionIndex}
                                  variant={badgeProps.variant} 
                                  className={badgeProps.className}
                                >
                                  {badgeProps.text}
                                </Badge>
                              )
                            })
                          })()}
                          
                          {/* Show overtime total if multiple sessions with overtime */}
                          {sessionData.sessions.length > 1 && 
                           sessionData.sessions.some(s => s.isOvertimeSession || 
                             calculateRawSessionDuration(s.logs, freezeAt || currentTime, 0).overtimeHours > 0) && (
                            <Badge 
                              variant="outline" 
                              className="bg-purple-200 text-purple-800 border-purple-400 font-medium"
                            >
                              Total: {formatAccurateHours(
                                sessionData.sessions.reduce((total, session, i) => {
                                  const prevHours = sessionData.sessions.slice(0, i).reduce((sum, prevSession) => 
                                    sum + calculateRawSessionDuration(prevSession.logs, freezeAt || currentTime, 0).regularHours, 0)
                                  return total + calculateRawSessionDuration(session.logs, freezeAt || currentTime, prevHours).overtimeHours
                                }, 0)
                              )}
                            </Badge>
                          )}
                        </div>
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
