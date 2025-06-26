"use client"

import { useEffect, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { GraduationCap } from "lucide-react"
import { calculateTimeWorked, truncateTo2Decimals } from "@/lib/time-utils"

/**
 * TimeLog type for intern logs
 */
interface TimeLog {
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

/**
 * Profile/internship details type for type safety
 */
interface InternshipDetails {
  school?: { name: string }
  department?: { name: string }
  supervisor?: string
  required_hours: number
  start_date: string
  end_date: string
  status?: string
}

interface UserShape {
  first_name?: string
  last_name?: string
  internship?: InternshipDetails
}

const REQUIRED_HOURS_PER_DAY = 9

/**
 * DailyTimeRecord
 * Displays the daily time record table and progress for an intern.
 */
export function DailyTimeRecord({ internId }: { internId?: string }) {
  const { user } = useAuth()
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserShape | null>(null)

  // Fetch logs for the intern
  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true)
      setError(null)
      try {
        let url = "/api/time-logs"
        if (internId) {
          url += `?userId=${internId}`
        }
        const res = await fetch(url)
        if (!res.ok) throw new Error("Failed to fetch logs")
        const data = await res.json()
        const logsArray = Array.isArray(data) ? data : data.logs || []
        const normalizedLogs: TimeLog[] = logsArray.map((log: Record<string, unknown>) => {
          const timeIn = (log.time_in as string) ?? (log.timeIn as string) ?? null
          const timeOut = (log.time_out as string) ?? (log.timeOut as string) ?? null
          
          // Extract date from time_in or time_out, fallback to provided date
          let dateStr = ""
          if (timeIn) {
            // Use local date extraction to avoid timezone issues
            const date = new Date(timeIn)
            dateStr = date.getFullYear() + "-" + 
                     String(date.getMonth() + 1).padStart(2, "0") + "-" + 
                     String(date.getDate()).padStart(2, "0")
          } else if (timeOut) {
            const date = new Date(timeOut)
            dateStr = date.getFullYear() + "-" + 
                     String(date.getMonth() + 1).padStart(2, "0") + "-" + 
                     String(date.getDate()).padStart(2, "0")
          } else if (typeof log.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(log.date)) {
            dateStr = log.date.slice(0, 10)
          }

          return {
            ...log,
            time_in: timeIn,
            time_out: timeOut,
            log_type: (log.log_type as "regular" | "overtime") ?? "regular",
            date: dateStr,
          }
        })
        setLogs(normalizedLogs)
      } catch {
        setError("Failed to load logs")
      } finally {
        setLoading(false)
      }
    }
    fetchLogs()
  }, [internId])

  // Fetch profile for admin view
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (internId) {
          const res = await fetch(`/api/profile?userId=${internId}`)
          if (!res.ok) throw new Error("Failed to fetch profile")
          const data = await res.json()
          setProfile(data as UserShape)
        } else if (user) {
          // Map user to Profile type for compatibility
          const typedUser = user as UserShape
          setProfile({
            first_name: typedUser.first_name ?? "",
            last_name: typedUser.last_name ?? "",
            internship: typedUser.internship ?? {
              school: { name: "N/A" },
              department: { name: "N/A" },
              supervisor: "N/A",
              required_hours: 0,
              start_date: "",
              end_date: "",
              status: "",
            },
          })
        } else {
          setProfile(null)
        }
      } catch {
        setProfile(null)
      }
    }
    fetchProfile()
  }, [internId, user])

  // Use profile for display
  const internshipDetails: InternshipDetails = profile?.internship ?? {
    school: { name: "N/A" },
    department: { name: "N/A" },
    supervisor: "N/A",
    required_hours: 0,
    start_date: "",
    end_date: "",
    status: "",
  }

  /**
   * Calculate completed hours for the selected intern
   */
  const { completedHours, totalHoursWorked } = (() => {
    // Filter logs for the selected intern if internId is provided
    const filteredLogs = internId
      ? logs.filter(
          log =>
            log.user_id?.toString() === internId.toString() ||
            log.internId?.toString() === internId.toString()
        )
      : logs
    
    // Calculate total completed hours (all time worked)
    const total = filteredLogs
      .filter((log) => log.status === "completed" && log.time_in && log.time_out)
      .reduce((sum, log) => {
        if (!log.time_in || !log.time_out) return sum
        const result = calculateTimeWorked(log.time_in, log.time_out)
        return sum + result.hoursWorked
      }, 0)
    
    const totalWorked = Number(truncateTo2Decimals(total))
    
    // Cap completed hours at required hours for progress calculation
    const completed = Math.min(totalWorked, internshipDetails.required_hours)
    
    return { completedHours: completed, totalHoursWorked: totalWorked }
  })()

  const progressPercentage = internshipDetails.required_hours > 0
    ? Math.min((completedHours / internshipDetails.required_hours) * 100, 100)
    : 0

  return (
    <div>
      {/* Cards Row */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        {/* Intern Information Card */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Intern Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                <div>
                  <span className="font-medium text-base">Name:</span>
                  <div className="text-gray-600 text-base">
                    {profile?.first_name || ""} {profile?.last_name || ""}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-base">University:</span>
                  <div className="text-gray-600 text-base">
                    {internshipDetails.school?.name ?? "N/A"}
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <span className="font-medium text-base">Assigned Department:</span>
                <div className="text-gray-600 text-base">
                  {internshipDetails.department?.name ?? "N/A"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Internship Progress Card */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Internship Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium text-base">Completed</span>
                <span className="font-medium text-base">
                  {completedHours.toFixed(2)}h / {internshipDetails.required_hours}h
                  {totalHoursWorked > internshipDetails.required_hours && (
                    <span className="text-yellow-600 ml-2 text-sm">
                      (+{(totalHoursWorked - internshipDetails.required_hours).toFixed(2)}h overtime)
                    </span>
                  )}
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2 mb-6" />
              <div className="flex gap-8 mt-2">
                {/* Internship Duration Block */}
                <div>
                  <div className="font-medium">Internship Duration:</div>
                  <div className="text-gray-600">
                    {internshipDetails.start_date
                      ? new Date(internshipDetails.start_date).toLocaleDateString()
                      : "N/A"}
                    {" "}
                    -{" "}
                    {internshipDetails.end_date
                      ? new Date(internshipDetails.end_date).toLocaleDateString()
                      : "N/A"}
                  </div>
                </div>
                {/* Status Block */}
                <div className="flex flex-col items-center justify-center ml-auto">
                  <Badge
                    variant="outline"
                    className={
                      progressPercentage >= 100
                        ? "bg-green-100 text-green-700 border-green-300"
                        : "bg-yellow-100 text-yellow-700 border-yellow-300"
                    }
                  >
                    {progressPercentage >= 100 ? "Complete" : "In Progress"}
                  </Badge>
                  <span className="text-2xl font-bold text-blue-600 mt-1">
                    {progressPercentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading logs...</div>
      ) : error ? (
        <div className="text-center text-red-500 py-8">{error}</div>
      ) : logs.length === 0 ? (
        <div className="text-center text-gray-500 py-8">No logs found.</div>
      ) : (
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
              {groupLogsByDate(
                internId
                  ? logs.filter(
                      log =>
                        log.user_id?.toString() === internId.toString() ||
                        log.internId?.toString() === internId.toString()
                    )
                  : logs
              ).map(([key, logsForDate]) => {
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
      )}
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
      const date = new Date(log.time_in)
      dateKey = date.getFullYear() + "-" + 
               String(date.getMonth() + 1).padStart(2, "0") + "-" + 
               String(date.getDate()).padStart(2, "0")
    } else if (log.time_out) {
      const date = new Date(log.time_out)
      dateKey = date.getFullYear() + "-" + 
               String(date.getMonth() + 1).padStart(2, "0") + "-" + 
               String(date.getDate()).padStart(2, "0")
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