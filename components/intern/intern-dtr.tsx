/**
 * InternDTR - Displays intern dashboard with info cards and time record table
 * Supports both intern self-view and admin view of specific interns
 */

"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { GraduationCap } from "lucide-react"
import { calculateTimeWorked, truncateTo2Decimals, extractDateString, DEFAULT_INTERNSHIP_DETAILS, filterLogsByInternId } from "@/lib/time-utils"
import { DailyTimeRecord as TimeRecordTable, type TimeLog } from "@/components/daily-time-record"

interface InternshipDetails {
  school?: { name: string }
  department?: { name: string }
  supervisor?: string
  required_hours: number
  start_date: string
  end_date: string
  status?: string
}

interface UserProfile {
  first_name?: string
  last_name?: string
  internship?: InternshipDetails
}

export function DailyTimeRecord({ internId }: { internId?: string }) {
  const { user } = useAuth()
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  // Fetch time logs
  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true)
      setError(null)
      try {
        const url = `/api/time-logs${internId ? `?userId=${internId}` : ""}`
        const res = await fetch(url)
        if (!res.ok) throw new Error("Failed to fetch logs")
        
        const data = await res.json()
        const logsArray = Array.isArray(data) ? data : data.logs || []
        
        const normalizedLogs: TimeLog[] = logsArray.map((log: Record<string, unknown>) => {
          const timeIn = (log.time_in as string) ?? (log.timeIn as string) ?? null
          const timeOut = (log.time_out as string) ?? (log.timeOut as string) ?? null
          
          let dateStr = ""
          if (timeIn) {
            dateStr = extractDateString(timeIn)
          } else if (timeOut) {
            dateStr = extractDateString(timeOut)
          } else if (typeof log.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(log.date)) {
            dateStr = log.date.slice(0, 10)
          }

          return {
            ...log,
            time_in: timeIn,
            time_out: timeOut,
            log_type: (log.log_type as "regular" | "overtime") ?? "regular",
            date: dateStr,
          } as TimeLog
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

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (internId) {
          const res = await fetch(`/api/profile?userId=${internId}`)
          if (!res.ok) throw new Error("Failed to fetch profile")
          const data = await res.json()
          setProfile(data as UserProfile)
        } else if (user) {
          const typedUser = user as UserProfile
          setProfile({
            first_name: typedUser.first_name ?? "",
            last_name: typedUser.last_name ?? "",
            internship: typedUser.internship ?? DEFAULT_INTERNSHIP_DETAILS,
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

  const internshipDetails: InternshipDetails = profile?.internship ?? DEFAULT_INTERNSHIP_DETAILS

  // Calculate hours and progress
  const { completedHours, totalHoursWorked } = (() => {
    const filteredLogs = filterLogsByInternId(logs, internId)
    
    const total = filteredLogs
      .filter(log => log.status === "completed" && log.time_in && log.time_out)
      .reduce((sum, log) => {
        if (!log.time_in || !log.time_out) return sum
        const result = calculateTimeWorked(log.time_in, log.time_out)
        return sum + result.hoursWorked
      }, 0)
    
    const totalWorked = Number(truncateTo2Decimals(total))
    const completed = Math.min(totalWorked, internshipDetails.required_hours)
    
    return { completedHours: completed, totalHoursWorked: totalWorked }
  })()

  const progressPercentage = internshipDetails.required_hours > 0
    ? Math.min((completedHours / internshipDetails.required_hours) * 100, 100)
    : 0

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2 mb-6">
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
                <div>
                  <div className="font-medium">Internship Duration:</div>
                  <div className="text-gray-600">
                    {internshipDetails.start_date
                      ? new Date(internshipDetails.start_date).toLocaleDateString()
                      : "N/A"}
                    {" - "}
                    {internshipDetails.end_date
                      ? new Date(internshipDetails.end_date).toLocaleDateString()
                      : "N/A"}
                  </div>
                </div>
                
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

      <TimeRecordTable 
        logs={logs}
        internId={internId}
        loading={loading}
        error={error}
      />
    </div>
  )
}