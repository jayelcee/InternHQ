"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { 
  calculateTimeWorked, 
  truncateTo2Decimals, 
  filterLogsByInternId 
} from "@/lib/time-utils"
import { 
  TimeLogDisplay, 
  groupLogsByDate, 
  formatLogDate 
} from "@/lib/ui-utils"

interface DailyTimeRecordProps {
  logs: TimeLogDisplay[]
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
                              : "bg-blue-50 text-blue-700"
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
