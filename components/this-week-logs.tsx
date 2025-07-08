"use client"

/**
 * ThisWeekLogs Component
 * 
 * Displays a weekly view of time logs with session grouping and overtime calculations.
 * Utilizes centralized session processing utilities for consistent business logic.
 * 
 * Props:
 * - weeklyLogs: Array of time log entries for the week
 * - loading: Loading state
 * - error: Error message, if any
 * - currentTime: Current time for session calculations
 * - isTimedIn, isOvertimeIn: Flags for active sessions
 * - timeInTimestamp, overtimeInTimestamp: Timestamps for active sessions
 * - freezeAt: Optional override for current time (e.g., for reporting)
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { TimeLogDisplay, groupLogsByDate, formatLogDate } from "@/lib/ui-utils"
import { processTimeLogSessions, getTimeBadgeProps } from "@/lib/session-utils"
import { calculateAccurateSessionDuration, formatAccurateHours, calculateRawSessionDuration, truncateToMinute } from "@/lib/time-utils"

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
                  <TableHead className="w-45 whitespace-nowrap pr-16">Date</TableHead>
                  <TableHead>Time In</TableHead>
                  <TableHead>Time Out</TableHead>
                  <TableHead>Regular Shift</TableHead>
                  <TableHead>Overtime</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupLogsByDate(weeklyLogs).map(([key, logsForDate]) => {
                  // Extract date part from the group key (format: "internId-YYYY-MM-DD")
                  const datePart = key.split("-").slice(-3).join("-")
                  const today = new Date().toLocaleDateString('en-CA')
                  const isToday = datePart === today

                  // Add active dashboard session if no database logs exist for today
                  const activeLogs = [...logsForDate]
                  if (isToday && (isTimedIn || isOvertimeIn) && !activeLogs.some(log => log.time_in && !log.time_out)) {
                    if (isTimedIn && timeInTimestamp) {
                      activeLogs.push({
                        id: -1,
                        time_in: truncateToMinute(timeInTimestamp),
                        time_out: null,
                        status: "pending",
                        log_type: "regular"
                      })
                    }
                    if (isOvertimeIn && overtimeInTimestamp) {
                      activeLogs.push({
                        id: -2,
                        time_in: truncateToMinute(overtimeInTimestamp),
                        time_out: null,
                        status: "pending",
                        log_type: "overtime"
                      })
                    }
                  }

                  // Process sessions using centralized logic
                  const sessionData = processTimeLogSessions(activeLogs, freezeAt || currentTime)

                  // Date column: show range if session spans multiple days, else show single date
                  const sessions = sessionData.sessions
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
                  const formatDate = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  const formatDay = (date: Date) => date.toLocaleDateString("en-US", { weekday: "short" })

                  return (
                    <TableRow key={key}>
                      <TableCell className="font-medium w-45 whitespace-nowrap pr-16">
                        <div className="flex flex-col items-start">
                          {(() => {
                            if (minTimeIn && maxTimeOut) {
                              const startDate = formatDate(minTimeIn)
                              const endDate = formatDate(maxTimeOut)
                              const startDay = formatDay(minTimeIn)
                              const endDay = formatDay(maxTimeOut)
                              if (startDate !== endDate) {
                                return (
                                  <>
                                    <span className="text-xs text-gray-500">{startDay} – {endDay}</span>
                                    <span>{startDate} – {endDate}</span>
                                  </>
                                )
                              } else {
                                return (
                                  <>
                                    <span className="text-xs text-gray-500">{startDay}</span>
                                    <span>{startDate}</span>
                                  </>
                                )
                              }
                            } else {
                              const fallbackDate = new Date(datePart)
                              const fallbackDay = fallbackDate.toLocaleDateString("en-US", { weekday: "short" })
                              return (
                                <>
                                  <span className="text-xs text-gray-500">{fallbackDay}</span>
                                  <span>{formatLogDate(datePart)}</span>
                                </>
                              )
                            }
                          })()}
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
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {(() => {
                            let previousRegularHours = 0
                            return sessionData.sessions.map((session, sessionIndex) => {
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