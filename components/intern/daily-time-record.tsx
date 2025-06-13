"use client"

import { useEffect, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { GraduationCap } from "lucide-react"

interface TimeLog {
  id: number
  date: string
  time_in: string | null
  time_out: string | null
  status: "pending" | "completed"
  notes?: string
}

function getTruncatedDecimalHours(log: TimeLog) {
  if (!log.time_in || !log.time_out) return 0
  const inDate = new Date(log.time_in)
  const outDate = new Date(log.time_out)
  const diffMs = outDate.getTime() - inDate.getTime()
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  const decimal = hours + minutes / 60
  return Number(truncateTo2Decimals(decimal))
}

const STANDARD_SHIFT_HOURS = 9

function truncateTo2Decimals(val: number) {
  const [int, dec = ""] = val.toString().split(".")
  return dec.length > 0 ? `${int}.${dec.slice(0, 2).padEnd(2, "0")}` : `${int}.00`
}

export function DailyTimeRecord() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/time-logs")
        if (!res.ok) throw new Error("Failed to fetch logs")
        const data = await res.json()
        setLogs(Array.isArray(data) ? data : data.logs || [])
      } catch (err: any) {
        setError(err.message || "Failed to load logs")
      } finally {
        setLoading(false)
      }
    }
    fetchLogs()
  }, [])

  // Helper for MM-DD-YYYY format
  const formatLogDate = (dateString: string) => {
    const date = new Date(dateString)
    return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}-${date.getFullYear()}`
  }

  // Internship details from user object
  const internshipDetails = user?.internship ?? {
    school: { name: "N/A" },
    department: { name: "N/A" },
    supervisor: "N/A",
    required_hours: 0,
    start_date: "",
    end_date: "",
    status: "",
  }

  // Internship Progress calculation (sum of Hours Worked from the table, each truncated, then sum truncated)
  const completedHours = (() => {
    const total = logs
      .filter((log) => log.status === "completed" && log.time_in && log.time_out)
      .reduce((sum, log) => sum + getTruncatedDecimalHours(log), 0)
    return Number(truncateTo2Decimals(total))
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
                    {user?.first_name || ""} {user?.last_name || ""}
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
              {groupLogsByDate(logs).map(([date, logsForDate]) => {
                // Calculate total hours for the day (sum all logs)
                const rawTotalHours = logsForDate.reduce((sum, log) => sum + getTruncatedDecimalHours(log), 0)
                // Hours worked is max 9
                const hoursWorked = Math.min(rawTotalHours, STANDARD_SHIFT_HOURS)
                // Overtime is total hours - 9, never less than 0
                const overtime = Math.max(0, rawTotalHours - STANDARD_SHIFT_HOURS)
                return (
                  <TableRow key={date}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col items-start">
                        <span className="text-xs text-gray-500">
                          {new Date(date).toLocaleDateString("en-US", { weekday: "short" })}
                        </span>
                        <span>{formatLogDate(date)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {logsForDate.map((log, idx) =>
                          log.time_in ? (
                            <Badge key={idx} variant="outline" className="bg-green-50 text-green-700">
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
                            <Badge key={idx} variant="outline" className="bg-red-50 text-red-700">
                              {new Date(log.time_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </Badge>
                          ) : log.time_in && log.status === "pending" ? (
                            <Badge key={idx} variant="outline" className="bg-yellow-50 text-yellow-700">
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
                        {truncateTo2Decimals(hoursWorked)}h
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(truncateTo2Decimals(overtime)) > 0 ? (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                          {truncateTo2Decimals(overtime)}h
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

function groupLogsByDate(logs: TimeLog[]) {
  const map = new Map<string, TimeLog[]>()
  logs.forEach(log => {
    const dateKey = log.time_in
      ? log.time_in.slice(0, 10)
      : log.date?.slice(0, 10)
    if (!dateKey) return
    if (!map.has(dateKey)) map.set(dateKey, [])
    map.get(dateKey)!.push(log)
  })
  // Sort logs within each date by time_in
  map.forEach(arr => arr.sort((a, b) =>
    new Date(a.time_in ?? a.date).getTime() - new Date(b.time_in ?? b.date).getTime()
  ))
  // Return as array of [date, logs[]], sorted by date ascending
  return Array.from(map.entries()).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
}