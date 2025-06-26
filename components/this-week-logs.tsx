"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { calculateTimeWorked, getLocalDateString } from "@/lib/time-utils"
import { TimeLogDisplay, groupLogsByDate, formatLogDate } from "@/lib/ui-utils"

interface ThisWeekLogsProps {
  weeklyLogs: TimeLogDisplay[]
  loading: boolean
  error: string | null
  currentTime: Date
}

export function ThisWeekLogs({ weeklyLogs, loading, error, currentTime }: ThisWeekLogsProps) {
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
                {groupLogsByDate(weeklyLogs).map(([key, logs]) => {
                  // Extract date part from the group key (format: "internId-YYYY-MM-DD")
                  const datePart = key.split("-").slice(-3).join("-") // gets "YYYY-MM-DD"
                  
                  return (
                    <TableRow key={key}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col items-start">
                          <span className="text-xs text-gray-500">
                            {(() => {
                              const date = new Date(datePart)
                              return isNaN(date.getTime()) ? "Invalid" : date.toLocaleDateString("en-US", { weekday: "short" })
                            })()}
                          </span>
                          <span>{formatLogDate(datePart)}</span>
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
                          if (log.time_in && log.time_out) {
                            const result = calculateTimeWorked(log.time_in, log.time_out)
                            return (
                              <span key={idx} className="font-semibold">
                                {result.duration}
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
                          if (log.time_in && log.time_out) {
                            const result = calculateTimeWorked(log.time_in, log.time_out)
                            return (
                              <span
                                key={idx}
                                className={
                                  "font-semibold " +
                                  (log.log_type === "overtime" ? "text-purple-700" : "text-blue-600")
                                }
                              >
                                {result.decimal}h
                              </span>
                            )
                          } else if (log.time_in && !log.time_out) {
                            return (
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
                            )
                          } else {
                            return <span key={idx} className="text-gray-400">--</span>
                          }
                        })}
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
