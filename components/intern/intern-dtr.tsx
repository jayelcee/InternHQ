/**
 * InternDTR - Displays intern dashboard with info cards and time record table
 * Supports both intern self-view and admin view of specific interns
 */

"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { GraduationCap } from "lucide-react"
import { 
  calculateTimeStatistics, 
  DEFAULT_INTERNSHIP_DETAILS,
  filterLogsByInternId
} from "@/lib/time-utils"
import { 
  TimeLogDisplay, 
  InternshipDetails
} from "@/lib/ui-utils"
import { DailyTimeRecord as TimeRecordTable } from "@/components/daily-time-record"

interface UserProfile {
  first_name?: string
  last_name?: string
  internship?: InternshipDetails
}

export function DailyTimeRecord({ internId, onRefresh }: { internId?: string; onRefresh?: () => Promise<void> }) {
  const { user } = useAuth()
  const [logs, setLogs] = useState<TimeLogDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  // Fetch time logs
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = `/api/time-logs${internId ? `?userId=${internId}` : ""}`
      const res = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errorText}`)
      }
      
      const data = await res.json()
      const logsArray = Array.isArray(data) ? data : data.logs || []
      
      const normalizedLogs: TimeLogDisplay[] = logsArray.map((log: Record<string, unknown>) => {
        const timeIn = (log.time_in as string) ?? (log.timeIn as string) ?? null
        const timeOut = (log.time_out as string) ?? (log.timeOut as string) ?? null
        const userId = log.user_id as number | undefined
        const internIdFromLog = log.internId as number | undefined

        return {
          id: log.id as number,
          time_in: timeIn,
          time_out: timeOut,
          log_type: (log.log_type as "regular" | "overtime" | "extended_overtime") ?? "regular",
          status: (log.status as "pending" | "completed") ?? "completed",
          overtime_status: (log.overtime_status as "pending" | "approved" | "rejected") ?? undefined,
          user_id: userId,
          internId: internIdFromLog ?? userId, // fallback to user_id if internId is not available
        }
      })
      
      setLogs(normalizedLogs)
      
      // Note: onRefresh is only called from edit/delete operations, not from normal fetch
    } catch (error) {
      console.error("Error fetching logs:", error)
      setError(`Failed to load logs: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }, [internId])

  // Function to handle refresh after edit/delete operations
  const handleDataRefresh = useCallback(async () => {
    // First refresh local data
    await fetchLogs()
    // Then call external refresh if provided
    if (onRefresh) {
      await onRefresh()
    }
  }, [fetchLogs, onRefresh])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

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

  // Calculate hours and progress using centralized function
  const [timeStats, setTimeStats] = useState({
    completedHours: 0,
    totalHoursWorked: 0,
    progressPercentage: 0
  })

  useEffect(() => {
    const updateStats = async () => {
      const filteredLogs = filterLogsByInternId(logs, internId)
      
      if (filteredLogs.length === 0) {
        setTimeStats({ completedHours: 0, totalHoursWorked: 0, progressPercentage: 0 })
        return
      }
      
      // Use centralized calculation with edit request support for consistent progress tracking
      const stats = await calculateTimeStatistics(filteredLogs, internId, {
        includeEditRequests: true,
        requiredHours: internshipDetails.required_hours || 0
      })
      
      setTimeStats({
        completedHours: Math.min(stats.internshipProgress, internshipDetails.required_hours),
        totalHoursWorked: stats.internshipProgress,
        progressPercentage: stats.progressPercentage
      })
    }
    
    updateStats()
  }, [logs, internId, internshipDetails])

  const { completedHours, totalHoursWorked } = timeStats
  const progressPercentage = timeStats.progressPercentage

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
        onTimeLogUpdate={handleDataRefresh}
      />
    </div>
  )
}