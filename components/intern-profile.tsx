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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, isValid, parseISO } from "date-fns"
import { CalendarIcon, Pencil, Save, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"

export function InternProfile() {
  const { user, refreshUser } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState("personal")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profileData, setProfileData] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [supervisors, setSupervisors] = useState<{ id: number; name: string }[]>([])

  // Fetch real profile data from API
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/profile")
        if (!res.ok) throw new Error("Failed to fetch profile")
        const data = await res.json()
        setProfileData({
          // Personal
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
          // Education
          school: data.internship?.school?.name || "",
          degree: data.profile?.degree || "",
          gpa: data.profile?.gpa?.toString() || "",
          graduationDate: data.profile?.graduation_date || "",
          // Skills & Interests
          skills: data.profile?.skills || [],
          interests: data.profile?.interests || [],
          languages: data.profile?.languages || [],
          // Emergency Contact
          emergencyContactName: data.profile?.emergency_contact_name || "",
          emergencyContactRelation: data.profile?.emergency_contact_relation || "",
          emergencyContactPhone: data.profile?.emergency_contact_phone || "",
          // Internship Details
          department: data.internship?.department?.name || "",
          supervisor: data.internship?.supervisor_name || "",
          supervisorId: data.internship?.supervisor_id || "",
          startDate: data.internship?.start_date || "",
          endDate: data.internship?.end_date || "",
          requiredHours: data.internship?.required_hours || 0,
          completedHours: data.internship?.completedHours || 0,
        })
      } catch (err: any) {
        setError(err.message || "Failed to load profile")
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  // Fetch logs for progress calculation
  useEffect(() => {
    const fetchLogs = async () => {
      setLogsLoading(true)
      try {
        const res = await fetch("/api/time-logs")
        const data = await res.json()
        const logsArr = (Array.isArray(data) ? data : data.logs || []).map((log: any) => {
          let hoursWorked = 0
          if (log.time_in && log.time_out) {
            const inDate = new Date(log.time_in)
            const outDate = new Date(log.time_out)
            const diffMs = outDate.getTime() - inDate.getTime() - (log.break_duration || 0) * 60 * 1000
            hoursWorked = diffMs > 0 ? Number((diffMs / (1000 * 60 * 60)).toFixed(2)) : 0
          }
          return { ...log, hoursWorked }
        })
        setLogs(logsArr)
      } finally {
        setLogsLoading(false)
      }
    }
    fetchLogs()
  }, [])

  // Fetch supervisors for dropdown
  useEffect(() => {
    if (!isEditing) return
    fetch("/api/supervisors")
      .then(res => res.json())
      .then(data => {
        // Assume API returns [{ id, first_name, last_name }]
        setSupervisors(
          data.map((sup: any) => ({
            id: sup.id,
            name: `${sup.first_name} ${sup.last_name}`,
          }))
        )
      })
      .catch(() => setSupervisors([]))
  }, [isEditing])

  // Helper for truncating to 2 decimals (same as dashboard/DTR)
  function truncateTo2Decimals(val: number) {
    const [int, dec = ""] = val.toString().split(".")
    return dec.length > 0 ? `${int}.${dec.slice(0, 2).padEnd(2, "0")}` : `${int}.00`
  }

  // Helper for log hours (same as dashboard/DTR)
  function getTruncatedDecimalHours(log: any) {
    if (!log.time_in || !log.time_out) return 0
    const inDate = new Date(log.time_in)
    const outDate = new Date(log.time_out)
    const diffMs = outDate.getTime() - inDate.getTime() - (log.break_duration || 0) * 60 * 1000
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    const decimal = hours + minutes / 60
    return Number(truncateTo2Decimals(decimal))
  }

  // Calculate completed hours from logs (match dashboard/DTR)
  const completedHours = (() => {
    const total = logs
      .filter((log) => log.status === "completed" && log.time_in && log.time_out)
      .reduce((sum, log) => sum + getTruncatedDecimalHours(log), 0)
    return Number(truncateTo2Decimals(total))
  })()

  const requiredHours = profileData?.requiredHours || 0
  const progressPercentage =
    requiredHours > 0 ? Math.min((completedHours / requiredHours) * 100, 100) : 0

  // For all date fields, store as "YYYY-MM-DD" string in state
  const handleInputChange = (field: string, value: string | string[]) => {
    setProfileData((prev: any) => ({
      ...prev,
      [field]: value,
    }))
  }

  // For calendar popovers, always store as "YYYY-MM-DD" string
  const handleCalendarChange = (field: string, date: Date | undefined) => {
    setProfileData((prev: any) => ({
      ...prev,
      [field]: date ? format(date, "yyyy-MM-dd") : "",
    }))
  }

  const handleSave = async () => {
    setIsEditing(false)
    setLoading(true)
    setError(null)
    try {
      // Save to backend, all date fields as "YYYY-MM-DD" strings
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData),
      })
      if (!res.ok) throw new Error("Failed to save profile")
      await refreshUser()
      alert("Profile saved successfully!")
    } catch (err: any) {
      setError(err.message || "Failed to save profile")
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    // Optionally refetch to reset
  }

  // Helper for safe date display
  const safeFormat = (dateString: string) => {
    if (!dateString) return "Select date"
    const date = parseISO(dateString)
    return isValid(date) ? format(date, "MMMM dd, yyyy") : "Select date"
  }

  if (!user) return null
  if (loading) return <div className="p-8 text-center text-gray-500">Loading profile...</div>
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>
  if (!profileData) return null

  const initials = `${profileData.firstName[0] ?? ""}${profileData.lastName[0] ?? ""}`.toUpperCase()

  return (
    <div className="space-y-6">
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
                <Badge variant="secondary">Intern</Badge>
              </div>
              <div className="space-y-1">
                <div className="text-sm">
                  <span className="font-medium">Internship Progress:</span>{" "}
                  <span>
                    {logsLoading
                      ? "Loading..."
                      : `${completedHours} of ${requiredHours} hours (${progressPercentage.toFixed(1)}%)`}
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
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="education">Education</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="emergency">Emergency</TabsTrigger>
        </TabsList>

        {/* Personal Information Tab */}
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={profileData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    disabled={!isEditing}
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={profileData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={profileData.address}
                    onChange={(e) => handleInputChange("address", e.target.value)}
                    disabled={!isEditing}
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={profileData.country}
                      onChange={(e) => handleInputChange("country", e.target.value)}
                      disabled={!isEditing}
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
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
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
                    {isEditing && (
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={
                            profileData.dateOfBirth && isValid(parseISO(profileData.dateOfBirth))
                              ? parseISO(profileData.dateOfBirth)
                              : undefined
                          }
                          onSelect={date =>
                            handleCalendarChange(
                              "dateOfBirth",
                              date
                            )
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    )}
                  </Popover>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={profileData.bio}
                  onChange={(e) => handleInputChange("bio", e.target.value)}
                  disabled={!isEditing}
                  className="min-h-32"
                />
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
                  <Input
                    id="school"
                    value={profileData.school}
                    onChange={(e) => handleInputChange("school", e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="degree">Degree</Label>
                  <Input
                    id="degree"
                    value={profileData.degree}
                    onChange={(e) => handleInputChange("degree", e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gpa">GPA</Label>
                  <Input
                    id="gpa"
                    value={profileData.gpa}
                    onChange={(e) => handleInputChange("gpa", e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expected Graduation</Label>
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
                    {isEditing && (
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={
                            profileData.graduationDate && isValid(parseISO(profileData.graduationDate))
                              ? parseISO(profileData.graduationDate)
                              : undefined
                          }
                          onSelect={date => handleCalendarChange("graduationDate", date)}
                          initialFocus
                        />
                      </PopoverContent>
                    )}
                  </Popover>
                </div>
              </div>

              {/* Internship Details */}
              <div className="pt-4 border-t">
                <h3 className="text-lg font-medium mb-4">Internship Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={profileData.department}
                      onChange={(e) => handleInputChange("department", e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supervisor">Supervisor</Label>
                    {isEditing ? (
                      <Select
                        value={profileData.supervisorId?.toString() || ""}
                        onValueChange={value => {
                          const selected = supervisors.find(s => s.id.toString() === value)
                          handleInputChange("supervisor", selected ? selected.name : "")
                          handleInputChange("supervisorId", value)
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
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="supervisor"
                        value={profileData.supervisor}
                        disabled
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
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
                      {isEditing && (
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={
                              profileData.startDate && isValid(parseISO(profileData.startDate))
                                ? parseISO(profileData.startDate)
                                : undefined
                            }
                            onSelect={date =>
                              handleCalendarChange(
                                "startDate",
                                date
                              )
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      )}
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
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
                      {isEditing && (
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={
                              profileData.endDate && isValid(parseISO(profileData.endDate))
                                ? parseISO(profileData.endDate)
                                : undefined
                            }
                            onSelect={date =>
                              handleCalendarChange(
                                "endDate",
                                date
                              )
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      )}
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requiredHours">Required Hours</Label>
                    <Input
                      id="requiredHours"
                      type="number"
                      min={0}
                      value={profileData.requiredHours}
                      onChange={(e) => handleInputChange("requiredHours", e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
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
                              const newSkills = [...profileData.skills]
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
                                  handleInputChange("skills", [...profileData.skills, input.value.trim()])
                                  input.value = ""
                                }
                              }
                            }}
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById("newSkill") as HTMLInputElement
                              if (input.value.trim()) {
                                handleInputChange("skills", [...profileData.skills, input.value.trim()])
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
                              const newInterests = [...profileData.interests]
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
                                  handleInputChange("interests", [...profileData.interests, input.value.trim()])
                                  input.value = ""
                                }
                              }
                            }}
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById("newInterest") as HTMLInputElement
                              if (input.value.trim()) {
                                handleInputChange("interests", [...profileData.interests, input.value.trim()])
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
                              const newLanguages = [...profileData.languages]
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
                                  handleInputChange("languages", [...profileData.languages, input.value.trim()])
                                  input.value = ""
                                }
                              }
                            }}
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById("newLanguage") as HTMLInputElement
                              if (input.value.trim()) {
                                handleInputChange("languages", [...profileData.languages, input.value.trim()])
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactRelation">Relationship</Label>
                  <Select
                    value={profileData.emergencyContactRelation}
                    onValueChange={(value) => handleInputChange("emergencyContactRelation", value)}
                    disabled={!isEditing}
                  >
                    <SelectTrigger id="emergencyContactRelation">
                      <SelectValue placeholder="Select relationship" />
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
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactPhone">Phone Number</Label>
                  <Input
                    id="emergencyContactPhone"
                    value={profileData.emergencyContactPhone}
                    onChange={(e) => handleInputChange("emergencyContactPhone", e.target.value)}
                    disabled={!isEditing}
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)}>
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
  )
}
