"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { calculateTimeWorked, truncateTo2Decimals, extractDateString, filterLogsByInternId } from "@/lib/time-utils"

/**
 * TimeLog type for intern logs
 */
export interface TimeLog {
  id: number
  date: string
  time_in: string | null
  time_out: string | null
  status: "pending" | "completed"
  log_type: "regular" | "overtime"
  notes?: string
  user_id?: number | string
  internId?: number | string
}

interface DailyTimeRecordProps {
  logs: TimeLog[]
  internId?: string
  loading?: boolean
  error?: string | null
}

const REQUIRED_HOURS_PER_DAY = 9

/**
 * DailyTimeRecord - Reusable component for displaying time logs table
 */
export function DailyTimeRecord({ logs, internId, loading, error }: DailyTimeRecordProps) {
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
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Time In</TableHead>
            <TableHead>Time Out</TableHead>
            <TableHead className="text-right">Hours Worked</TableHead>
            <TableHead className="text-right">Overtime</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupLogsByDate(filterLogsByInternId(logs, internId)).map(([key, logsForDate]) => {
            // Extract date part from the group key (format: "internId-YYYY-MM-DD")
            const datePart = key.split("-").slice(-3).join("-") // gets "YYYY-MM-DD"

            // Calculate total hours for this date (all logs combined)
            const totalHoursWorked = logsForDate
              .filter(log => log.time_in && log.time_out && log.status === "completed")
              .reduce((sum, log) => {
                if (!log.time_in || !log.time_out) return sum
                const result = calculateTimeWorked(log.time_in, log.time_out)
                return sum + result.hoursWorked
              }, 0)

            // For existing data or mixed data, treat as regular hours up to required hours limit
            // then overtime for the rest
            const dailyRequiredHours = REQUIRED_HOURS_PER_DAY
            const regularHoursWorked = Math.min(totalHoursWorked, dailyRequiredHours)
            const overtimeHours = Math.max(0, totalHoursWorked - dailyRequiredHours)

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
                    {logsForDate.map((log, idx) =>
                      log.time_in ? (
                        <Badge 
                          key={idx} 
                          variant="outline" 
                          className={
                            log.log_type === "overtime" 
                              ? "bg-purple-50 text-purple-700 border-purple-300" 
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
                    {logsForDate.map((log, idx) =>
                      log.time_out ? (
                        <Badge 
                          key={idx} 
                          variant="outline" 
                          className={
                            log.log_type === "overtime" 
                              ? "bg-purple-50 text-purple-700 border-purple-300" 
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
                              ? "bg-purple-50 text-purple-700 border-purple-300" 
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
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    {truncateTo2Decimals(regularHoursWorked)}h
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {Number(truncateTo2Decimals(overtimeHours)) > 0 ? (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                      {truncateTo2Decimals(overtimeHours)}h
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-100 text-gray-400 border-gray-200">
                      0.00h
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * Group logs by intern and date for compact display in logs table
 */
function groupLogsByDate(logs: TimeLog[]) {
  const map = new Map<string, TimeLog[]>()
  logs.forEach(log => {
    // Use intern id + date as key to separate different interns' logs
    const internId = log.user_id ?? log.internId ?? ""
    
    // Extract date from time_in, time_out, or date field using proper date extraction
    let dateKey = ""
    if (log.time_in) {
      dateKey = extractDateString(log.time_in)
    } else if (log.time_out) {
      dateKey = extractDateString(log.time_out)
    } else if (log.date) {
      dateKey = log.date.slice(0, 10)
    }
    
    if (!dateKey) return
    const key = `${internId}-${dateKey}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(log)
  })
  
  // Sort logs within each group by time_in
  map.forEach(arr => arr.sort((a, b) => {
    const aTime = a.time_in || a.time_out || a.date || ""
    const bTime = b.time_in || b.time_out || b.date || ""
    return new Date(aTime).getTime() - new Date(bTime).getTime()
  }))
  
  // Return as array of [key, logs[]], sorted by date ascending
  return Array.from(map.entries()).sort((a, b) => {
    // Extract date part for sorting
    const aDate = a[0].split("-").slice(-3).join("-") // gets "YYYY-MM-DD"
    const bDate = b[0].split("-").slice(-3).join("-") // gets "YYYY-MM-DD"
    return new Date(aDate).getTime() - new Date(bDate).getTime()
  })
}

/**
 * Format a date string as MM/DD/YYYY
 */
function formatLogDate(date: string) {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return "N/A"
  const d = new Date(date)
  if (isNaN(d.getTime())) return date
  return d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" })
}
