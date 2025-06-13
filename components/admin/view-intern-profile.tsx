"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { format } from "date-fns"
import { ArrowLeft, Download, FileText, Mail, Phone } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface InternProfileViewProps {
  internId: string
  onBack: () => void
}

interface InternProfileData {
  id: number
  first_name: string
  last_name: string
  email: string
  profile?: {
    phone?: string
    address?: string
    city?: string
    state?: string
    zip_code?: string
    date_of_birth?: string
    bio?: string
    degree?: string
    gpa?: number
    graduation_date?: string
    skills?: string[]
    interests?: string[]
    languages?: string[]
    emergency_contact_name?: string
    emergency_contact_relation?: string
    emergency_contact_phone?: string
  }
  internship?: {
    school: {
      name: string
      address?: string
    }
    department: {
      name: string
      description?: string
    }
    required_hours: number
    start_date: string
    end_date: string
    supervisor_id?: number
    status: string
    completedHours?: number
  }
  completedHours?: number
  attendanceRate?: number
  punctualityRate?: number
  lastEvaluation?: string
  evaluationDate?: string
}

export function ViewInternProfile({ internId, onBack }: InternProfileViewProps) {
  const [activeTab, setActiveTab] = useState("personal")
  const [internData, setInternData] = useState<InternProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [supervisorName, setSupervisorName] = useState<string | null>(null)
  const [supervisors, setSupervisors] = useState<{ id: number; name: string }[]>([])

  useEffect(() => {
    const fetchIntern = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/admin/interns/${internId}`)
        if (!res.ok) {
          throw new Error("Failed to fetch intern data")
        }
        const data = await res.json()
        setInternData(data.intern)
      } catch (err: any) {
        setError(err.message || "Failed to load intern data")
      } finally {
        setLoading(false)
      }
    }
    fetchIntern()
  }, [internId])

  // Fetch supervisor name if supervisor_id is present and name is not included
  useEffect(() => {
    const fetchSupervisorName = async () => {
      if (internData?.internship?.supervisor_id) {
        try {
          const res = await fetch(`/api/supervisors/${internData.internship.supervisor_id}`)
          if (res.ok) {
            const data = await res.json()
            setSupervisorName(data.name)
          } else {
            setSupervisorName(null)
          }
        } catch {
          setSupervisorName(null)
        }
      }
    }
    fetchSupervisorName()
  }, [internData?.internship?.supervisor_id])

  // Fetch supervisors for dropdown (even if not editing, for consistent display)
  useEffect(() => {
    fetch("/api/supervisors")
      .then(res => res.json())
      .then(data => {
        setSupervisors(
          data.map((sup: any) => ({
            id: sup.id,
            name: `${sup.first_name} ${sup.last_name}`,
          }))
        )
      })
      .catch(() => setSupervisors([]))
  }, [])

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading intern profile...</div>
  }
  if (error || !internData) {
    return (
      <div className="p-8 text-center text-red-500">
        {error || "Intern not found."}
        <div className="mt-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>
    )
  }

  const initials = `${internData.first_name[0]}${internData.last_name[0]}`.toUpperCase()
  const profile = internData.profile || {}
  const internship = internData.internship
  const completedHours =
    internship?.completedHours ??
    internData.completedHours ??
    0
  const requiredHours = internship?.required_hours ?? 0
  const progressPercentage =
    requiredHours > 0 ? (completedHours / requiredHours) * 100 : 0

  const handleGenerateReport = () => {
    alert(`Generating report for ${internData.first_name} ${internData.last_name}...`)
  }

  // Get supervisor name from list using supervisor_id
  const supervisorDisplayName =
    supervisors.find(s => s.id === internship?.supervisor_id)?.name || "N/A"

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Intern Profile</h1>
            <p className="text-gray-600">Viewing complete profile information</p>
          </div>
        </div>
      </div>

      {/* Profile Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-24 w-24">
                <AvatarImage
                  src="/placeholder.svg?height=96&width=96"
                  alt={`${internData.first_name} ${internData.last_name}`}
                />
                <AvatarFallback className="text-2xl bg-blue-100 text-blue-600">{initials}</AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 space-y-4 text-center md:text-left">
              <div>
                <h2 className="text-2xl font-bold">
                  {internData.first_name} {internData.last_name}
                </h2>
                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 mt-1">
                  <div className="flex items-center gap-1 text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span>{internData.email}</span>
                  </div>
                  {profile.phone && (
                    <div className="flex items-center gap-1 text-gray-600">
                      <Phone className="h-4 w-4" />
                      <span>{profile.phone}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                {internship?.department?.name && (
                  <Badge variant="outline">{internship.department.name}</Badge>
                )}
                {internship?.school?.name && (
                  <Badge variant="outline">{internship.school.name}</Badge>
                )}
                <Badge variant="secondary">Intern</Badge>
              </div>
              {internship && (
                <div className="space-y-1">
                  <div className="text-sm">
                    <span className="font-medium">Internship Progress:</span>{" "}
                    <span>
                      {typeof completedHours === "number"
                        ? completedHours.toFixed(2)
                        : "0.00"} of {requiredHours} hours ({progressPercentage.toFixed(1)}%)
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
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Details Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-5 mb-4">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="education">Education</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="emergency">Emergency</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* Personal Information Tab */}
        <TabsContent value="personal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Basic personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="font-medium text-sm text-gray-500" htmlFor="firstName">First Name</label>
                  <input
                    id="firstName"
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                    value={internData.first_name}
                    disabled
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-medium text-sm text-gray-500" htmlFor="lastName">Last Name</label>
                  <input
                    id="lastName"
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                    value={internData.last_name}
                    disabled
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-medium text-sm text-gray-500" htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                    value={internData.email}
                    disabled
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-medium text-sm text-gray-500" htmlFor="phone">Phone Number</label>
                  <input
                    id="phone"
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                    value={profile.phone || ""}
                    disabled
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-medium text-sm text-gray-500" htmlFor="address">Address</label>
                  <input
                    id="address"
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                    value={
                      [profile.address, profile.city, profile.state, profile.zip_code]
                        .filter(Boolean)
                        .join(", ")
                    }
                    disabled
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-medium text-sm text-gray-500">Date of Birth</label>
                  <input
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                    value={
                      profile.date_of_birth
                        ? format(new Date(profile.date_of_birth), "MMMM dd, yyyy")
                        : ""
                    }
                    disabled
                    readOnly
                  />
                </div>
              </div>
              {profile.bio && (
                <div className="space-y-2">
                  <label className="font-medium text-sm text-gray-500" htmlFor="bio">Bio</label>
                  <textarea
                    id="bio"
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700 min-h-32"
                    value={profile.bio}
                    disabled
                    readOnly
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Education Tab */}
        <TabsContent value="education" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Education Information</CardTitle>
              <CardDescription>Academic background and details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="font-medium text-sm text-gray-500" htmlFor="school">University</label>
                  <input
                    id="school"
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                    value={internship?.school?.name || ""}
                    disabled
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-medium text-sm text-gray-500" htmlFor="degree">Degree Program</label>
                  <input
                    id="degree"
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                    value={profile.degree || ""}
                    disabled
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-medium text-sm text-gray-500" htmlFor="gpa">GPA</label>
                  <input
                    id="gpa"
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                    value={profile.gpa ?? ""}
                    disabled
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-medium text-sm text-gray-500" htmlFor="graduationDate">Expected Graduation</label>
                  <input
                    id="graduationDate"
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                    value={
                      profile.graduation_date
                        ? format(new Date(profile.graduation_date), "MMMM dd, yyyy")
                        : ""
                    }
                    disabled
                    readOnly
                  />
                </div>
              </div>
              {/* Internship Details */}
              {internship && (
                <div className="pt-4 border-t">
                  <h3 className="text-lg font-medium mb-4">Internship Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="font-medium text-sm text-gray-500" htmlFor="department">Department</label>
                      <input
                        id="department"
                        className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                        value={internship.department?.name || ""}
                        disabled
                        readOnly
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="font-medium text-sm text-gray-500" htmlFor="supervisor">Supervisor</label>
                      <input
                        id="supervisor"
                        className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                        value={supervisorDisplayName}
                        disabled
                        readOnly
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="font-medium text-sm text-gray-500" htmlFor="startDate">Start Date</label>
                      <input
                        id="startDate"
                        className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                        value={
                          internship.start_date
                            ? format(new Date(internship.start_date), "MMMM dd, yyyy")
                            : ""
                        }
                        disabled
                        readOnly
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="font-medium text-sm text-gray-500" htmlFor="endDate">End Date</label>
                      <input
                        id="endDate"
                        className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                        value={
                          internship.end_date
                            ? format(new Date(internship.end_date), "MMMM dd, yyyy")
                            : ""
                        }
                        disabled
                        readOnly
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="font-medium text-sm text-gray-500" htmlFor="requiredHours">Required Hours</label>
                      <input
                        id="requiredHours"
                        className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                        value={internship.required_hours}
                        disabled
                        readOnly
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="font-medium text-sm text-gray-500" htmlFor="completedHours">Completed Hours</label>
                      <input
                        id="completedHours"
                        className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                        value={
                          typeof completedHours === "number"
                            ? completedHours.toFixed(2)
                            : "0.00"
                        }
                        disabled
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Skills Tab */}
        <TabsContent value="skills" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Skills & Interests</CardTitle>
              <CardDescription>Technical skills and personal interests</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-medium mb-2">Technical Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {(profile.skills ?? []).map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-sm py-1 px-3">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Interests</h3>
                <div className="flex flex-wrap gap-2">
                  {(profile.interests ?? []).map((interest, index) => (
                    <Badge key={index} variant="outline" className="text-sm py-1 px-3">
                      {interest}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Languages</h3>
                <div className="flex flex-wrap gap-2">
                  {(profile.languages ?? []).map((language, index) => (
                    <Badge key={index} className="bg-blue-100 text-blue-800 hover:bg-blue-200 text-sm py-1 px-3">
                      {language}
                    </Badge>
                  ))}
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
                  <label className="font-medium text-sm text-gray-500" htmlFor="emergencyContactName">Contact Name</label>
                  <input
                    id="emergencyContactName"
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                    value={profile.emergency_contact_name ?? ""}
                    disabled
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-medium text-sm text-gray-500" htmlFor="emergencyContactRelation">Relationship</label>
                  <input
                    id="emergencyContactRelation"
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                    value={profile.emergency_contact_relation ?? ""}
                    disabled
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-medium text-sm text-gray-500" htmlFor="emergencyContactPhone">Phone Number</label>
                  <input
                    id="emergencyContactPhone"
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                    value={profile.emergency_contact_phone ?? ""}
                    disabled
                    readOnly
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab (Admin Only) */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Evaluation</CardTitle>
              <CardDescription>Attendance and performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h3 className="font-medium">Attendance Rate</h3>
                  <div className="flex justify-between text-sm">
                    <span>Overall attendance</span>
                    <span className="font-medium">{internData.attendanceRate ?? "N/A"}%</span>
                  </div>
                  <Progress value={internData.attendanceRate ?? 0} className="h-2" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium">Punctuality Rate</h3>
                  <div className="flex justify-between text-sm">
                    <span>On-time check-ins</span>
                    <span className="font-medium">{internData.punctualityRate ?? "N/A"}%</span>
                  </div>
                  <Progress value={internData.punctualityRate ?? 0} className="h-2" />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t">
                <h3 className="font-medium mb-2">Latest Evaluation</h3>
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="italic">{internData.lastEvaluation ?? "No evaluation yet."}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Evaluation date:{" "}
                    {internData.evaluationDate
                      ? format(new Date(internData.evaluationDate), "MMMM dd, yyyy")
                      : "N/A"}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t">
                <h3 className="font-medium mb-4">Documents & Reports</h3>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" onClick={() => alert("Downloading...")}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Attendance Report
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => alert("Downloading...")}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Performance Evaluation
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => alert("Downloading...")}>
                    <Download className="mr-2 h-4 w-4" />
                    Download School Certification
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
