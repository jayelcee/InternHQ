"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { calculateTimeWorked, getLocalDateString } from "@/lib/time-utils"
import { TimeLogDisplay } from "@/lib/ui-utils"

interface ThisWeekLogsProps {
  weeklyLogs: TimeLogDisplay[]
  loading: boolean
  error: string | null
  currentTime: Date
}

/**
 * Groups time logs by date and sorts them
 */
function groupLogsByDate(logs: TimeLogDisplay[]) {
  const map = new Map<string, TimeLogDisplay[]>()
  logs.forEach(log => {
    const dateKey = log.time_in ? getLocalDateString(log.time_in) : undefined
    if (!dateKey) return
    if (!map.has(dateKey)) map.set(dateKey, [])
    map.get(dateKey)!.push(log)
  })
  map.forEach(arr => arr.sort((a, b) =>
    new Date(a.time_in!).getTime() - new Date(b.time_in!).getTime()
  ))
  return Array.from(map.entries()).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
}

/**
 * Calculates duration and hours for a time log entry using centralized calculation
 */
function getLogDuration(log: TimeLogDisplay) {
  if (log.time_in && log.time_out) {
    const result = calculateTimeWorked(log.time_in, log.time_out)
    return {
      duration: result.duration,
      decimal: result.decimal
    }
  }
  return null
}

export function ThisWeekLogs({ weeklyLogs, loading, error, currentTime }: ThisWeekLogsProps) {
  // Utility formatting functions
  const formatters = useMemo(() => ({
    logDate: (dateString: string) => {
      const date = new Date(dateString)
      return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}-${date.getFullYear()}`
    }
  }), [])

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
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupLogsByDate(weeklyLogs).map(([date, logs]) => (
                  <TableRow key={date}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col items-start">
                        <span className="text-xs text-gray-500">
                          {new Date(date).toLocaleDateString("en-US", { weekday: "short" })}
                        </span>
                        <span>{formatters.logDate(date)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {logs.map((log, idx) =>
                          log.time_in ? (
                            <Badge
                              key={idx}
                              variant="outline"
                              className={
                                log.log_type === "overtime"
                                  ? "bg-purple-50 text-purple-700"
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
                        {logs.map((log, idx) =>
                          log.time_out ? (
                            <Badge
                              key={idx}
                              variant="outline"
                              className={
                                log.log_type === "overtime"
                                  ? "bg-purple-50 text-purple-700"
                                  : "bg-red-50 text-red-700"
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
                                  ? "bg-purple-50 text-purple-700"
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
                    <TableCell className="text-right font-mono">
                      <div className="flex flex-col gap-1">
                        {logs.map((log, idx) => {
                          const dur = getLogDuration(log)
                          if (dur) {
                            return (
                              <span key={idx} className="font-semibold">
                                {dur.duration}
                              </span>
                            )
                          } else if (log.time_in && !log.time_out) {
                            // Show real-time duration for active logs using centralized calculation
                            const result = calculateTimeWorked(log.time_in, currentTime)
                            return (
                              <span key={idx} className="font-semibold text-yellow-700">
                                {result.duration}
                              </span>
                            )
                          } else if (log.status === "pending") {
                            return (
                              <Badge
                                key={idx}
                                variant="outline"
                                className={
                                  log.log_type === "overtime"
                                    ? "bg-purple-50 text-purple-700"
                                    : "bg-yellow-50 text-yellow-700"
                                }
                              >
                                In Progress
                              </Badge>
                            )
                          } else {
                            return <span key={idx} className="text-gray-400">--</span>
                          }
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <div className="flex flex-col gap-1">
                        {logs.map((log, idx) => {
                          const dur = getLogDuration(log)
                          return dur ? (
                            <span
                              key={idx}
                              className={
                                "font-semibold " +
                                (log.log_type === "overtime" ? "text-purple-700" : "text-blue-600")
                              }
                            >
                              {dur.decimal}h
                            </span>
                          ) : log.time_in && !log.time_out ? (
                            <span key={idx} className="font-semibold text-right block">
                              <Badge
                                variant="outline"
                                className={
                                  log.log_type === "overtime"
                                    ? "bg-purple-50 text-purple-700"
                                    : "bg-blue-50 text-blue-700"
                                }
                              >
                                Active
                              </Badge>
                            </span>
                          ) : (
                            <span key={idx} className="text-gray-400">--</span>
                          )
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
