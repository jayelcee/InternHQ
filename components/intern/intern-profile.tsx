/**
 * InternProfile
 *
 * Displays and manages intern profile information, including:
 * - Personal info, education, skills, emergency contact, internship details
 * - Profile editing, validation, and saving
 * - Progress calculation and time log history
 * - Admin and self-view support
 *
 * Props:
 * - internId?: string — (optional) user ID for admin view
 * - onBack?: () => void — (optional) callback for back navigation
 * - editable?: boolean — (optional) allow editing (default: true)
 */

"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import { format, isValid, parseISO } from "date-fns"
import { CalendarIcon, Pencil, Save, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { calculateTimeWorked, calculateInternshipProgress } from "@/lib/time-utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"

/**
 * Supervisor interface
 */
interface Supervisor {
  id: number
  name?: string
  first_name?: string
  last_name?: string
}

/**
 * Complete profile data interface
 */
interface ProfileData {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  country: string
  zipCode: string
  dateOfBirth: string
  bio: string
  school: string
  degree: string
  gpa: string
  graduationDate: string
  skills: string[]
  interests: string[]
  languages: string[]
  emergencyContactName: string
  emergencyContactRelation: string
  emergencyContactPhone: string
  department: string
  departmentId: string
  schoolId: string
  supervisor: string
  supervisorId: string
  supervisorEmail: string
  startDate: string
  endDate: string
  requiredHours: number
  completedHours: number
  internshipStatus: string
  internshipId: string
  todayStatus: string
  projects: unknown[]
}

/**
 * Time log entry interface
 */
interface LogEntry {
  id: number
  user_id?: number | string
  internId?: number | string
  time_in: string | null
  time_out: string | null
  [key: string]: unknown
  hoursWorked: number
}

/**
 * InternProfile component displays and allows editing of intern profile data.
 */
export function InternProfile({
  internId,
  onBack,
  editable = true,
}: {
  internId?: string
  onBack?: () => void
  editable?: boolean
}) {
  const { user, refreshUser } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState("personal")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [supervisors, setSupervisors] = useState<Supervisor[]>([])
  const [workSchedule, setWorkSchedule] = useState<{ start: string; end: string; days: number[] } | null>(null)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [successMessage, setSuccessMessage] = useState("Profile saved successfully!")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addDialogType, setAddDialogType] = useState<'school' | 'department' | 'supervisor'>('school')
  const [addDialogData, setAddDialogData] = useState({
    name: '',
    firstName: '',
    lastName: '',
    email: ''
  })

  const [departments, setDepartments] = useState<{ id: number | string; name: string }[]>([])
  const [schools, setSchools] = useState<{ id: number | string; name: string }[]>([])

  // Fetch profile data from API
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true)
      setError(null)
      try {
        const url = internId ? `/api/profile?userId=${internId}` : "/api/profile"
        const res = await fetch(url)
        if (!res.ok) throw new Error("Failed to fetch profile")
        const data = await res.json()
        
        // Set work schedule directly from user data
        if (data.work_schedule) {
          try {
            const schedule = typeof data.work_schedule === "string" 
              ? JSON.parse(data.work_schedule) 
              : data.work_schedule
            
            // Convert from database format (per-day) to frontend format
            const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
            const days: number[] = []
            let start = "09:00"
            let end = "18:00"
            
            dayNames.forEach((dayName, index) => {
              if (schedule[dayName] && schedule[dayName].start && schedule[dayName].end) {
                days.push(index + 1) // Convert 0-based to 1-based (Monday = 1)
                // Use the first found day's time as reference
                if (days.length === 1) {
                  start = schedule[dayName].start
                  end = schedule[dayName].end
                }
              }
            })
            
            setWorkSchedule({ start, end, days })
          } catch (error) {
            console.error("Error parsing work schedule:", error)
            setWorkSchedule(null)
          }
        } else {
          setWorkSchedule(null)
        }
        
        setProfileData({
          firstName: data.first_name || "",
          lastName: data.last_name || "",
          email: data.email || "",
          phone: data.profile?.phone || "",
          address: data.profile?.address || "",
          city: data.profile?.city || "",
          country: data.profile?.country || "",
          zipCode: data.profile?.zip_code || "",
          dateOfBirth: data.profile?.date_of_birth || "",
          bio: data.profile?.bio || "",
          school: data.internship?.school?.name || "",
          degree: data.profile?.degree || "",
          gpa: data.profile?.gpa?.toString() || "",
          graduationDate: data.profile?.graduation_date || "",
          skills: data.profile?.skills || [],
          interests: data.profile?.interests || [],
          languages: data.profile?.languages || [],
          emergencyContactName: data.profile?.emergency_contact_name || "",
          emergencyContactRelation: data.profile?.emergency_contact_relation || "",
          emergencyContactPhone: data.profile?.emergency_contact_phone || "",
          department: data.internship?.department?.name || "",
          departmentId: data.internship?.department_id?.toString() || "",
          schoolId: data.internship?.school_id?.toString() || "",
          supervisor: data.internship?.supervisor_name || "",
          supervisorId: data.internship?.supervisor_id?.toString() || "",
          supervisorEmail: "",
          startDate: data.internship?.start_date || "",
          endDate: data.internship?.end_date || "",
          requiredHours: data.internship?.required_hours || 0,
          completedHours: Number(data.completedHours) || 0,
          internshipStatus: data.internship?.status || "",
          internshipId: data.internship?.id?.toString() || "",
          todayStatus: data.todayStatus || "",
          projects: data.projects || [],
        })
      } catch (err) {
        setError((err as Error).message || "Failed to load profile")
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [internId])

  // Fetch logs for progress calculation
  useEffect(() => {
    const fetchLogs = async () => {
      setLogsLoading(true)
      try {
        const url = internId ? `/api/time-logs?userId=${internId}` : "/api/time-logs"
        const res = await fetch(url)
        if (!res.ok) {
          throw new Error("Failed to fetch time logs")
        }
        const data = await res.json()
        
        // Handle both array and object responses
        const logsArr: LogEntry[] = (Array.isArray(data) ? data : data.logs || []).map((log: Record<string, unknown>) => {
          const time_in = (log.time_in as string) || (log.timeIn as string) || null
          const time_out = (log.time_out as string) || (log.timeOut as string) || null
          let hoursWorked = 0
          
          if (time_in && time_out) {
            try {
              const result = calculateTimeWorked(time_in, time_out)
              hoursWorked = result.hoursWorked
            } catch (error) {
              console.warn("Error calculating hours for log:", log.id, error)
            }
          }
          
          return { 
            ...log, 
            id: Number(log.id), 
            time_in, 
            time_out, 
            hoursWorked,
            status: log.status as string || "pending"
          }
        })
        
        setLogs(logsArr)
      } catch (error) {
        console.error("Error fetching time logs:", error)
        setLogs([])
      } finally {
        setLogsLoading(false)
      }
    }
    fetchLogs()
  }, [internId])

  // Fetch supervisors for dropdown
  useEffect(() => {
    if (!isEditing) return
    
    const fetchSupervisors = async () => {
      try {
        const res = await fetch("/api/supervisors")
        if (!res.ok) {
          throw new Error("Failed to fetch supervisors")
        }
        const data: Supervisor[] = await res.json()
        
        setSupervisors(
          data.map((sup) => ({
            id: sup.id,
            name: sup.name || `${sup.first_name || ""} ${sup.last_name || ""}`.trim(),
            first_name: sup.first_name,
            last_name: sup.last_name
          }))
        )
      } catch (error) {
        console.error("Error fetching supervisors:", error)
        setSupervisors([])
      }
    }
    
    fetchSupervisors()
  }, [isEditing])

  // Fetch departments and schools for dropdowns
  useEffect(() => {
    if (!isEditing) return
    const fetchDepartmentsAndSchools = async () => {
      try {
        const [deptRes, schoolRes] = await Promise.all([
          fetch("/api/departments"),
          fetch("/api/schools"),
        ])
        // Defensive: ensure array, fallback to []
        const deptData = deptRes.ok ? await deptRes.json() : []
        const schoolData = schoolRes.ok ? await schoolRes.json() : []
        setDepartments(Array.isArray(deptData) ? deptData : [])
        setSchools(Array.isArray(schoolData) ? schoolData : [])
      } catch {
        setDepartments([])
        setSchools([])
      }
    }
    fetchDepartmentsAndSchools()
  }, [isEditing])

  // Helper for formatting date input value as yyyy-MM-dd or empty string
  const getDateInputValue = (dateString: string) => {
    if (!dateString) return ""
    const date = parseISO(dateString)
    return isValid(date) ? format(date, "yyyy-MM-dd") : ""
  }

  // Calculate completed hours from logs using centralized function
  const currentInternId = internId ?? user?.id
  const [timeStats, setTimeStats] = useState({
    completedHours: 0,
    progressPercentage: 0
  })

  useEffect(() => {
    const updateStats = async () => {
      if (logsLoading || !profileData) {
        setTimeStats({ 
          completedHours: profileData?.completedHours || 0, 
          progressPercentage: profileData?.requiredHours ? 
            ((profileData.completedHours || 0) / profileData.requiredHours) * 100 : 0
        })
        return
      }
      
      const requiredHours = profileData.requiredHours || 0
      
      // Use the centralized function to calculate hours
      const totalHours = calculateInternshipProgress(logs, currentInternId)
      const progressPercentage = requiredHours > 0 ? (totalHours / requiredHours) * 100 : 0
      
      setTimeStats({
        completedHours: totalHours,
        progressPercentage: Math.min(progressPercentage, 100)
      })
    }
    
    updateStats()
  }, [logs, logsLoading, profileData, currentInternId])

  const completedHours = timeStats.completedHours
  const requiredHours = profileData?.requiredHours || 0
  const progressPercentage = timeStats.progressPercentage

  // Handle input changes for profile fields
  const handleInputChange = (field: keyof ProfileData, value: string | string[] | number) => {
    setProfileData((prev) =>
      prev
        ? {
            ...prev,
            [field]: value,
          }
        : prev
    )
  }

  // Save profile changes
  const handleSave = async () => {
    if (!profileData) return
    
    setLoading(true)
    setError(null)
    
    try {
      // Save profile data first
      console.log("Saving profile data:", profileData)
      
      const profileUpdateData = {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
        phone: profileData.phone,
        address: profileData.address,
        city: profileData.city,
        country: profileData.country,
        zipCode: profileData.zipCode,
        dateOfBirth: profileData.dateOfBirth,
        bio: profileData.bio,
        degree: profileData.degree,
        gpa: profileData.gpa ? parseFloat(profileData.gpa) : undefined,
        graduationDate: profileData.graduationDate,
        skills: profileData.skills,
        interests: profileData.interests,
        languages: profileData.languages,
        emergencyContactName: profileData.emergencyContactName,
        emergencyContactRelation: profileData.emergencyContactRelation,
        emergencyContactPhone: profileData.emergencyContactPhone,
        startDate: profileData.startDate,
        endDate: profileData.endDate,
        requiredHours: profileData.requiredHours ? Number(profileData.requiredHours) : undefined,
        supervisorId: profileData.supervisorId?.toString().startsWith('temp_') ? profileData.supervisorId : (profileData.supervisorId ? Number(profileData.supervisorId) : undefined),
        supervisorEmail: profileData.supervisorEmail,
        supervisor: profileData.supervisor,
        schoolId: profileData.schoolId?.toString().startsWith('temp_') ? profileData.schoolId : (profileData.schoolId ? Number(profileData.schoolId) : undefined),
        school: profileData.school,
        departmentId: profileData.departmentId?.toString().startsWith('temp_') ? profileData.departmentId : (profileData.departmentId ? Number(profileData.departmentId) : undefined),
        department: profileData.department,
      }
      
      const res = await fetch(`/api/profile${internId ? `?userId=${internId}` : ""}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileUpdateData),
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || `Failed to save profile: ${res.statusText}`)
      }

      // Save work schedule if available
      if (workSchedule) {
        const scheduleRes = await fetch("/api/user/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentInternId, schedule: workSchedule }),
        })
        
        if (!scheduleRes.ok) {
          const errorData = await scheduleRes.json()
          console.warn("Failed to save work schedule:", errorData.error)
          // Don't throw here - profile was saved successfully
        }
      }

      // Refresh user data
      if (refreshUser) {
        await refreshUser()
      }
      setIsEditing(false)
      setSuccessMessage(
        internId && internId !== user?.id?.toString()
          ? "Intern profile saved successfully!"
          : "Profile saved successfully!"
      )
      setShowSuccessDialog(true)
    } catch (err) {
      console.error("Error saving profile:", err)
      setError((err as Error).message || "Failed to save profile")
    } finally {
      setLoading(false)
    }
  }

  // Cancel editing
  const handleCancel = () => {
    setIsEditing(false)
  }

  // Helper for safe date display
  const safeFormat = (dateString: string) => {
    if (!dateString) return "Select date"
    const date = parseISO(dateString)
    return isValid(date) ? format(date, "MMMM d, yyyy") : "Select date"
  }

  if (!user) return null
  
  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-gray-500">Loading profile...</p>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-500 mb-4">
          <p className="font-medium">Error loading profile</p>
          <p className="text-sm">{error}</p>
        </div>
        <Button onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    )
  }
  
  if (!profileData) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Profile not found</p>
      </div>
    )
  }

  const initials = `${profileData.firstName?.[0] || ""}${profileData.lastName?.[0] || ""}`.toUpperCase() || "??"

  return (
    <div className="space-y-6">
      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{successMessage}</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button onClick={() => setShowSuccessDialog(false)} autoFocus>
                OK
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add New {addDialogType === 'school' ? 'University' : 
                       addDialogType === 'department' ? 'Department' : 'Supervisor'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {addDialogType === 'supervisor' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="addFirstName">First Name</Label>
                  <Input
                    id="addFirstName"
                    value={addDialogData.firstName}
                    onChange={(e) => setAddDialogData(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="Enter first name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addLastName">Last Name</Label>
                  <Input
                    id="addLastName"
                    value={addDialogData.lastName}
                    onChange={(e) => setAddDialogData(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Enter last name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addEmail">Email</Label>
                  <Input
                    id="addEmail"
                    type="email"
                    value={addDialogData.email}
                    onChange={(e) => setAddDialogData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="addName">
                  {addDialogType === 'school' ? 'University' : 'Department'} Name
                </Label>
                <Input
                  id="addName"
                  value={addDialogData.name}
                  onChange={(e) => setAddDialogData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={`Enter ${addDialogType === 'school' ? 'university' : 'department'} name`}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddDialog(false)
                setAddDialogData({ name: '', firstName: '', lastName: '', email: '' })
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (addDialogType === 'supervisor') {
                  if (!addDialogData.firstName.trim() || !addDialogData.lastName.trim() || !addDialogData.email.trim()) {
                    return
                  }
                  const tempId = `temp_${Date.now()}`
                  const newSupervisor: Supervisor = { 
                    id: tempId as unknown as number, // Temp string ID
                    name: `${addDialogData.firstName.trim()} ${addDialogData.lastName.trim()}`,
                    first_name: addDialogData.firstName.trim(),
                    last_name: addDialogData.lastName.trim()
                  }
                  setSupervisors(prev => [...prev, newSupervisor])
                  handleInputChange("supervisor", newSupervisor.name ?? "")
                  handleInputChange("supervisorId", tempId)
                  handleInputChange("supervisorEmail", addDialogData.email.trim())
                } else if (addDialogType === 'school') {
                  if (!addDialogData.name.trim()) return
                  const tempId = `temp_${Date.now()}`
                  const newSchool = { id: tempId, name: addDialogData.name.trim() }
                  setSchools(prev => [...prev, newSchool])
                  handleInputChange("school", newSchool.name)
                  handleInputChange("schoolId", tempId)
                } else if (addDialogType === 'department') {
                  if (!addDialogData.name.trim()) return
                  const tempId = `temp_${Date.now()}`
                  const newDept = { id: tempId, name: addDialogData.name.trim() }
                  setDepartments(prev => [...prev, newDept])
                  handleInputChange("department", newDept.name)
                  handleInputChange("departmentId", tempId)
                }
                setShowAddDialog(false)
                setAddDialogData({ name: '', firstName: '', lastName: '', email: '' })
              }}
              disabled={
                addDialogType === 'supervisor' 
                  ? !addDialogData.firstName.trim() || !addDialogData.lastName.trim() || !addDialogData.email.trim()
                  : !addDialogData.name.trim()
              }
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {onBack && (
        <Button variant="outline" onClick={onBack} className="mb-4">
          ← Back to Dashboard
        </Button>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <X className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setError(null)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Profile Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-24 w-24">
                <AvatarImage src="/placeholder.svg?height=96&width=96" alt={`${profileData.firstName} ${profileData.lastName}`} />
                <AvatarFallback className="text-2xl bg-blue-100 text-blue-600">{initials}</AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 space-y-4 text-center md:text-left">
              <div>
                <h2 className="text-2xl font-bold">
                  {profileData.firstName} {profileData.lastName}
                </h2>
                <p className="text-gray-600">{profileData.email}</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <Badge variant="outline">{profileData.department}</Badge>
                <Badge variant="outline">{profileData.school}</Badge>
                <Badge variant="secondary">{profileData.internshipStatus || "Intern"}</Badge>
              </div>
              <div className="space-y-1">
                <div className="text-sm">
                  <span className="font-medium">Internship Progress:</span>{" "}
                  <span>
                    {logsLoading
                      ? "Loading..."
                      : `${completedHours.toFixed(2)} of ${requiredHours.toFixed(0)}h (${progressPercentage.toFixed(1)}%)`}
                  </span>
                </div>
                <div
                  className="bg-primary/20 relative w-full overflow-hidden rounded-full h-2"
                  role="progressbar"
                  aria-valuenow={progressPercentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="bg-primary h-full transition-all"
                    style={{ width: `${progressPercentage}%` }}
                    data-slot="progress-indicator"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Details Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="education">Education</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="emergency">Emergency</TabsTrigger>
          </TabsList>
          <div>
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} disabled={!editable}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Profile
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCancel}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={loading}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            )}
          </div>
        </div>

        <TabsContent value="personal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Your basic personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={profileData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    disabled={!isEditing}
                    placeholder="First Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={profileData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    disabled={!isEditing}
                    placeholder="Last Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    disabled={!isEditing}
                    placeholder="Email Address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={profileData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    disabled={!isEditing}
                    placeholder="Phone Number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={profileData.address}
                    onChange={(e) => handleInputChange("address", e.target.value)}
                    disabled={!isEditing}
                    placeholder="Address"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={profileData.city}
                      onChange={(e) => handleInputChange("city", e.target.value)}
                      disabled={!isEditing}
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={profileData.country}
                      onChange={(e) => handleInputChange("country", e.target.value)}
                      disabled={!isEditing}
                      placeholder="Country"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">Zip Code</Label>
                  <Input
                    id="zipCode"
                    value={profileData.zipCode}
                    onChange={(e) => handleInputChange("zipCode", e.target.value)}
                    disabled={!isEditing}
                    placeholder="Zip Code"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  {isEditing ? (
                    <Input
                      type="date"
                      value={getDateInputValue(profileData.dateOfBirth)}
                      onChange={e => handleInputChange("dateOfBirth", e.target.value)}
                      disabled={!isEditing}
                      className="w-full"
                    />
                  ) : (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !isEditing && "pointer-events-none opacity-50",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {safeFormat(profileData.dateOfBirth)}
                        </Button>
                      </PopoverTrigger>
                    </Popover>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <div className={!isEditing ? "pointer-events-none" : ""}>
                  <Textarea
                    id="bio"
                    value={profileData.bio}
                    onChange={(e) => handleInputChange("bio", e.target.value)}
                    disabled={!isEditing}
                    className="min-h-32"
                    placeholder="Tell us about yourself..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Education Tab */}
        <TabsContent value="education" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Education Information</CardTitle>
              <CardDescription>Your academic background and details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="school">University</Label>
                  {isEditing ? (
                    <Select
                      value={profileData.schoolId}
                      onValueChange={value => {
                        if (value === "add_new") {
                          setAddDialogType('school')
                          setShowAddDialog(true)
                        } else {
                          const selected = schools.find(s => s.id.toString() === value)
                          handleInputChange("school", selected?.name ?? "")
                          handleInputChange("schoolId", value)
                        }
                      }}
                    >
                      <SelectTrigger id="school">
                        <SelectValue placeholder="Select university" />
                      </SelectTrigger>
                      <SelectContent>
                        {schools.map(school => (
                          <SelectItem key={school.id} value={school.id.toString()}>
                            {school.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="add_new" className="text-blue-600 font-medium">
                          + Add New University
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="school"
                      value={profileData.school}
                      disabled
                      placeholder="School/University"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="degree">Degree Program</Label>
                  <Input
                    id="degree"
                    value={profileData.degree}
                    onChange={(e) => handleInputChange("degree", e.target.value)}
                    disabled={!isEditing}
                    placeholder="Degree Program"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gpa">GPA</Label>
                  <Input
                    id="gpa"
                    value={profileData.gpa}
                    onChange={(e) => handleInputChange("gpa", e.target.value)}
                    disabled={!isEditing}
                    placeholder="GPA"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expected Graduation</Label>
                  {isEditing ? (
                    <Input
                      type="date"
                      value={getDateInputValue(profileData.graduationDate)}
                      onChange={e => handleInputChange("graduationDate", e.target.value)}
                      className="w-full"
                    />
                  ) : (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !isEditing && "pointer-events-none opacity-50",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {safeFormat(profileData.graduationDate)}
                        </Button>
                      </PopoverTrigger>
                    </Popover>
                  )}
                </div>
              </div>

              {/* Internship Details */}
              <div className="pt-4 border-t">
                <h3 className="text-lg font-medium mb-4">Internship Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    {isEditing ? (
                      <Select
                        value={profileData.departmentId}
                        onValueChange={value => {
                          if (value === "add_new") {
                            setAddDialogType('department')
                            setShowAddDialog(true)
                          } else {
                            const selected = departments.find(d => d.id.toString() === value)
                            handleInputChange("department", selected?.name ?? "")
                            handleInputChange("departmentId", value)
                          }
                        }}
                      >
                        <SelectTrigger id="department">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map(dept => (
                            <SelectItem key={dept.id} value={dept.id.toString()}>
                              {dept.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="add_new" className="text-blue-600 font-medium">
                            + Add New Department
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="department"
                        value={profileData.department}
                        disabled
                        placeholder="Department"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supervisor">Supervisor</Label>
                    {isEditing ? (
                      <Select
                        value={profileData.supervisorId?.toString() || ""}
                        onValueChange={value => {
                          if (value === "add_new") {
                            setAddDialogType('supervisor')
                            setShowAddDialog(true)
                          } else {
                            const selected = supervisors.find(s => s.id.toString() === value)
                            handleInputChange("supervisor", selected?.name ?? "")
                            handleInputChange("supervisorId", value)
                            // Clear supervisor email when selecting existing supervisor
                            handleInputChange("supervisorEmail", "")
                          }
                        }}
                      >
                        <SelectTrigger id="supervisor">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {supervisors.map(sup => (
                            <SelectItem key={sup.id} value={sup.id.toString()}>
                              {sup.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="add_new" className="text-blue-600 font-medium">
                            + Add New Supervisor
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="supervisor"
                        value={profileData.supervisor}
                        disabled
                        placeholder="Supervisor"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    {isEditing ? (
                      <Input
                        type="date"
                        value={getDateInputValue(profileData.startDate)}
                        onChange={e => handleInputChange("startDate", e.target.value)}
                        className="w-full"
                      />
                    ) : (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !isEditing && "pointer-events-none opacity-50",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {safeFormat(profileData.startDate)}
                          </Button>
                        </PopoverTrigger>
                      </Popover>
                    )}
                  </div>
                    <div className="space-y-2">
                    <Label>End Date</Label>
                    {isEditing ? (
                      <Input
                      type="date"
                      value={getDateInputValue(profileData.endDate)}
                      onChange={e => handleInputChange("endDate", e.target.value)}
                      className="w-full"
                      />
                    ) : (
                      <Popover>
                      <PopoverTrigger asChild>
                        <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !isEditing && "pointer-events-none opacity-50",
                        )}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {safeFormat(profileData.endDate)}
                        </Button>
                      </PopoverTrigger>
                      </Popover>
                    )}
                    </div>
                  <div className="space-y-2">
                    <Label htmlFor="requiredHours">Required Hours</Label>
                    <div title={isEditing && !(user?.role === "admin") ? "Only admins can edit required hours." : ""}>
                      <Input
                        id="requiredHours"
                        type="number"
                        min={0}
                        value={profileData.requiredHours || ""}
                        onChange={(e) => handleInputChange("requiredHours", e.target.value ? Number(e.target.value) : 0)}
                        disabled={!isEditing || !(user?.role === "admin")}
                        placeholder="Required Hours"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="completedHours">Completed Hours</Label>
                    <div title={isEditing ? "Completed hours are automatically calculated in the system." : ""}>
                      <Input
                        id="completedHours"
                        value={completedHours.toFixed(2)}
                        disabled
                        readOnly
                      />
                    </div>
                  </div>
                </div>

                {/* Work Schedule removed as per requirements */}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Skills Tab */}
        <TabsContent value="skills" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Skills & Interests</CardTitle>
              <CardDescription>Your technical skills and personal interests</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-base">Technical Skills</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(profileData.skills || []).map((skill: string, index: number) => (
                      <Badge key={index} variant="secondary" className="text-sm py-1 px-3">
                        {skill}
                        {isEditing && (
                          <button
                            className="ml-1 text-gray-500 hover:text-gray-700"
                            onClick={() => {
                              const newSkills = [...(profileData.skills || [])]
                              newSkills.splice(index, 1)
                              handleInputChange("skills", newSkills)
                            }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    ))}
                    {isEditing && (
                      <div className="mt-2 w-full">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add a skill..."
                            id="newSkill"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                const input = e.currentTarget
                                if (input.value.trim()) {
                                  handleInputChange("skills", [...(profileData.skills || []), input.value.trim()])
                                  input.value = ""
                                }
                              }
                            }}
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById("newSkill") as HTMLInputElement
                              if (input?.value.trim()) {
                                handleInputChange("skills", [...(profileData.skills || []), input.value.trim()])
                                input.value = ""
                              }
                            }}
                          >
                            Add
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Press Enter to add a skill</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-base">Interests</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(profileData.interests || []).map((interest: string, index: number) => (
                      <Badge key={index} variant="outline" className="text-sm py-1 px-3">
                        {interest}
                        {isEditing && (
                          <button
                            className="ml-1 text-gray-500 hover:text-gray-700"
                            onClick={() => {
                              const newInterests = [...(profileData.interests || [])]
                              newInterests.splice(index, 1)
                              handleInputChange("interests", newInterests)
                            }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    ))}
                    {isEditing && (
                      <div className="mt-2 w-full">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add an interest..."
                            id="newInterest"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                const input = e.currentTarget
                                if (input.value.trim()) {
                                  handleInputChange("interests", [...(profileData.interests || []), input.value.trim()])
                                  input.value = ""
                                }
                              }
                            }}
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById("newInterest") as HTMLInputElement
                              if (input?.value.trim()) {
                                handleInputChange("interests", [...(profileData.interests || []), input.value.trim()])
                                input.value = ""
                              }
                            }}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-base">Languages</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(profileData.languages || []).map((language: string, index: number) => (
                      <Badge key={index} className="bg-blue-100 text-blue-800 hover:bg-blue-200 text-sm py-1 px-3">
                        {language}
                        {isEditing && (
                          <button
                            className="ml-1 text-blue-600 hover:text-blue-800"
                            onClick={() => {
                              const newLanguages = [...(profileData.languages || [])]
                              newLanguages.splice(index, 1)
                              handleInputChange("languages", newLanguages)
                            }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    ))}
                    {isEditing && (
                      <div className="mt-2 w-full">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add a language..."
                            id="newLanguage"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                const input = e.currentTarget
                                if (input.value.trim()) {
                                  handleInputChange("languages", [...(profileData.languages || []), input.value.trim()])
                                  input.value = ""
                                }
                              }
                            }}
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById("newLanguage") as HTMLInputElement
                              if (input?.value.trim()) {
                                handleInputChange("languages", [...(profileData.languages || []), input.value.trim()])
                                input.value = ""
                              }
                            }}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Emergency Contact Tab */}
        <TabsContent value="emergency" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Emergency Contact</CardTitle>
              <CardDescription>Contact information in case of emergency</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactName">Contact Name</Label>
                  <Input
                    id="emergencyContactName"
                    value={profileData.emergencyContactName}
                    onChange={(e) => handleInputChange("emergencyContactName", e.target.value)}
                    disabled={!isEditing}
                    placeholder="Contact Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactRelation">Relationship</Label>
                  <div className={!isEditing ? "pointer-events-none" : ""}>
                    <Select
                      value={profileData.emergencyContactRelation}
                      onValueChange={(value) => handleInputChange("emergencyContactRelation", value)}
                      disabled={!isEditing}
                    >
                      <SelectTrigger id="emergencyContactRelation">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mother">Mother</SelectItem>
                        <SelectItem value="Father">Father</SelectItem>
                        <SelectItem value="Sibling">Sibling</SelectItem>
                        <SelectItem value="Spouse">Spouse</SelectItem>
                        <SelectItem value="Relative">Relative</SelectItem>
                        <SelectItem value="Friend">Friend</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactPhone">Phone Number</Label>
                  <Input
                    id="emergencyContactPhone"
                    value={profileData.emergencyContactPhone}
                    onChange={(e) => handleInputChange("emergencyContactPhone", e.target.value)}
                    disabled={!isEditing}
                    placeholder="Phone Number"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-gray-50 border-t">
              <p className="text-sm text-gray-600">
                This information will only be used in case of emergency and is kept confidential.
              </p>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
