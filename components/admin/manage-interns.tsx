"use client"

import { useState, useEffect } from "react"
import { Search, UserPlus, Trash2, UserCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { InternProfile } from "@/components/intern/intern-profile"
import { calculateTimeStatistics } from "@/lib/time-utils"
import { Progress } from "@/components/ui/progress"

/**
 * Types for time logs and interns
 */
interface TimeLog {
  id: number
  user_id: number
  internId?: number
  timeIn?: string
  timeOut?: string
  time_in?: string
  time_out?: string
  status: string
  hoursWorked?: number
}

interface Intern {
  id: string
  name: string
  email: string
  department: string
  school: string
  internshipDetails: {
    requiredHours: number
    completedHours: number
    startDate: string
    endDate: string
  }
}

type InternshipDetailsShape = {
  requiredHours?: number
  startDate?: string
  endDate?: string
}
type InternshipShape = {
  required_hours?: number
  start_date?: string
  end_date?: string
  department?: { name?: string }
  school?: { name?: string }
}

/**
 * ManageInternsDashboard
 * Admin dashboard for managing interns: add, delete, filter, and view profiles.
 */
export function ManageInternsDashboard() {
  const [searchTerm, setSearchTerm] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [selectedInternId, setSelectedInternId] = useState<string | null>(null)
  const [isAddInternDialogOpen, setIsAddInternDialogOpen] = useState(false)
  const [interns, setInterns] = useState<Intern[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [internToDelete, setInternToDelete] = useState<string | null>(null)
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false)
  const [alertContent, setAlertContent] = useState({ title: "", description: "" })

  // States for dropdown data
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([])
  const [schools, setSchools] = useState<{ id: number; name: string }[]>([])
  const [supervisors, setSupervisors] = useState<{ id: number | string; name: string; first_name?: string; last_name?: string; email?: string }[]>([])

  // States for add new dialog
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addDialogType, setAddDialogType] = useState<'school' | 'department' | 'supervisor'>('school')
  const [addDialogData, setAddDialogData] = useState({
    name: '',
    firstName: '',
    lastName: '',
    email: ''
  })

  // Form states for adding new intern
  const [newIntern, setNewIntern] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "intern123",
    school: "",
    schoolId: "",
    degree: "",
    department: "",
    departmentId: "",
    supervisor: "",
    supervisorId: "",
    supervisorEmail: "",
    requiredHours: "",
    startDate: "",
    endDate: "",
    workSchedule: "none",
  })

  /**
   * Fetch all interns and calculate their completed hours from logs
   */
  const fetchAll = async () => {
    setIsLoading(true)
    try {
      // 1. Fetch logs first
      const logsRes = await fetch("/api/time-logs")
      const logsData = await logsRes.json()
      const logsArr: TimeLog[] = Array.isArray(logsData) ? logsData : logsData.logs

      // 2. Fetch interns
      const internsRes = await fetch("/api/interns")
      const internsData = await internsRes.json()

      // 3. Map interns and calculate completedHours using logs
      const mapped: Intern[] = await Promise.all(internsData.map(async (intern: Record<string, unknown>) => {
        const internId = Number(intern.id)
        // Find all completed logs for this intern
        const internLogs = logsArr.filter(
          (log) =>
            (log.user_id === internId || log.internId === internId) &&
            log.status === "completed"
        )
        
        const requiredHours = (intern.internshipDetails as InternshipDetailsShape)?.requiredHours ||
          (intern.internship as InternshipShape)?.required_hours ||
          0
        
        // Use centralized calculation with edit request support for consistent progress tracking
        const stats = await calculateTimeStatistics(internLogs, internId, {
          includeEditRequests: true,
          requiredHours
        })

        return {
          id: intern.id?.toString() ?? "",
          name: `${intern.first_name ?? ""} ${intern.last_name ?? ""}`.trim(),
          email: (intern.email as string) ?? "",
          department:
            (intern.department as string) ||
            (intern.internship as InternshipShape)?.department?.name ||
            "",
          school:
            (intern.school as string) ||
            (intern.internship as InternshipShape)?.school?.name ||
            "",
          internshipDetails: {
            requiredHours,
            completedHours: stats.internshipProgress,
            startDate:
              (intern.internshipDetails as InternshipDetailsShape)?.startDate ||
              (intern.internship as InternshipShape)?.start_date ||
              "",
            endDate:
              (intern.internshipDetails as InternshipDetailsShape)?.endDate ||
              (intern.internship as InternshipShape)?.end_date ||
              "",
          },
        }
      }))
      
      setInterns(mapped)
    } catch {
      setInterns([])
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch logs and interns in sequence on mount
  useEffect(() => {
    fetchAll()
  }, [])

  // Fetch dropdown data
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [deptRes, schoolRes, supervisorRes] = await Promise.all([
          fetch("/api/departments"),
          fetch("/api/schools"),
          fetch("/api/supervisors")
        ])
        
        const deptData = deptRes.ok ? await deptRes.json() : []
        const schoolData = schoolRes.ok ? await schoolRes.json() : []
        const supervisorData = supervisorRes.ok ? await supervisorRes.json() : []
        
        setDepartments(Array.isArray(deptData) ? deptData : [])
        setSchools(Array.isArray(schoolData) ? schoolData : [])
        setSupervisors(Array.isArray(supervisorData) ? supervisorData.map((sup: { id: number; name?: string; first_name?: string; last_name?: string; email?: string }) => ({
          id: sup.id,
          name: sup.name || `${sup.first_name || ""} ${sup.last_name || ""}`.trim(),
          first_name: sup.first_name,
          last_name: sup.last_name,
          email: sup.email
        })) : [])
      } catch (error) {
        console.error("Error fetching dropdown data:", error)
        setDepartments([])
        setSchools([])
        setSupervisors([])
      }
    }
    fetchDropdownData()
  }, [])

  // Build department filter list from fetched departments
  const departmentFilterOptions = departments.map(d => ({
    id: d.id,
    name: d.name,
  }))

  /**
   * Add a new intern
   */
  const handleAddIntern = async () => {
    try {
      setIsLoading(true)
      if (!newIntern.firstName || !newIntern.lastName || !newIntern.email || !newIntern.school || !newIntern.degree || !newIntern.department || !newIntern.supervisor) {
        setAlertContent({
          title: "Error",
          description: "Please fill all required fields",
        })
        setIsAlertDialogOpen(true)
        return
      }
      const res = await fetch("/api/admin/interns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newIntern),
      })
      if (!res.ok) throw new Error("Failed to add intern")
      setAlertContent({
        title: "Success",
        description: "Intern added successfully",
      })
      setIsAlertDialogOpen(true)
      setIsAddInternDialogOpen(false)
      setNewIntern({
        firstName: "",
        lastName: "",
        email: "",
        password: "intern123",
        school: "",
        schoolId: "",
        degree: "",
        department: "",
        departmentId: "",
        supervisor: "",
        supervisorId: "",
        supervisorEmail: "",
        requiredHours: "",
        startDate: "",
        endDate: "",
        workSchedule: "none",
      })
      fetchAll()
    } catch {
      setAlertContent({
        title: "Error",
        description: "Failed to add intern",
      })
      setIsAlertDialogOpen(true)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handle adding new entities (school, department, supervisor)
   */
  const handleAddNewEntity = () => {
    if (addDialogType === 'supervisor') {
      if (!addDialogData.firstName.trim() || !addDialogData.lastName.trim() || !addDialogData.email.trim()) {
        return
      }
      const tempId = `temp_${Date.now()}`
      const newSupervisor = { 
        id: tempId, 
        name: `${addDialogData.firstName.trim()} ${addDialogData.lastName.trim()}`,
        first_name: addDialogData.firstName.trim(),
        last_name: addDialogData.lastName.trim(),
        email: addDialogData.email.trim()
      }
      setSupervisors(prev => [...prev, newSupervisor])
      setNewIntern({ 
        ...newIntern, 
        supervisor: newSupervisor.name,
        supervisorId: tempId,
        supervisorEmail: addDialogData.email.trim()
      })
    } else if (addDialogType === 'school') {
      if (!addDialogData.name.trim()) return
      const tempId = `temp_${Date.now()}`
      const newSchool = { id: tempId as unknown as number, name: addDialogData.name.trim() }
      setSchools(prev => [...prev, newSchool])
      setNewIntern({ 
        ...newIntern, 
        school: newSchool.name,
        schoolId: tempId
      })
    } else if (addDialogType === 'department') {
      if (!addDialogData.name.trim()) return
      const tempId = `temp_${Date.now()}`
      const newDept = { id: tempId as unknown as number, name: addDialogData.name.trim() }
      setDepartments(prev => [...prev, newDept])
      setNewIntern({ 
        ...newIntern, 
        department: newDept.name,
        departmentId: tempId
      })
    }
    setShowAddDialog(false)
    setAddDialogData({ name: '', firstName: '', lastName: '', email: '' })
  }

  /**
   * Delete an intern by ID
   */
  const handleDeleteRequest = (internId: string) => {
    setInternToDelete(internId)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!internToDelete) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/interns/${internToDelete}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete intern")
      setAlertContent({
        title: "Success",
        description: "Intern deleted successfully",
      })
      setIsAlertDialogOpen(true)
      fetchAll()
    } catch {
      setAlertContent({
        title: "Error",
        description: "Failed to delete intern",
      })
      setIsAlertDialogOpen(true)
    } finally {
      setIsLoading(false)
      setIsDeleteDialogOpen(false)
      setInternToDelete(null)
    }
  }

  // Filter interns by search and department
  const filteredInterns = interns.filter((intern) => {
    const matchesSearch =
      intern.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      intern.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      intern.school.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDepartment = departmentFilter === "all" || intern.department === departmentFilter
    return matchesSearch && matchesDepartment
  })

  // If an intern is selected, show their profile using the reusable InternProfile component
  if (selectedInternId) {
    return (
      <InternProfile
        internId={selectedInternId}
        onBack={() => setSelectedInternId(null)}
        editable={true}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
        <div className="flex gap-2">
          <Button onClick={() => setIsAddInternDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Intern
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by name, email, or school..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departmentFilterOptions.map((dept) => (
                  <SelectItem key={dept.id} value={dept.name}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Interns Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Interns List</CardTitle>
          <p className="text-sm text-gray-600">
            Showing {filteredInterns.length} of {interns.length} interns
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Intern Details</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="pl-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInterns.map((intern) => {
                  // Calculate progress and format completed hours to 2 decimals
                  const completed = Number(intern.internshipDetails.completedHours || 0)
                  const required = Number(intern.internshipDetails.requiredHours || 0)
                  const progressPercentage = required > 0 ? (completed / required) * 100 : 0
                  return (
                    <TableRow key={intern.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{intern.name}</div>
                          <Badge variant="outline" className="text-xs">
                            {intern.school}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{intern.department}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2 min-w-48">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">
                              {completed < required ? "Ongoing" : "Completed"}
                            </span>
                            <span>
                              {completed.toFixed(2)}h / {required}h
                            </span>
                          </div>
                          <Progress value={progressPercentage} className="h-2" />
                          <div className="text-xs text-gray-500">{progressPercentage.toFixed(1)}%</div>
                        </div>
                      </TableCell>
                      <TableCell className="pl-20">
                        <div className="flex gap-2">
                          <Button size="icon" variant="outline" title="View Profile" onClick={() => setSelectedInternId(intern.id)}>
                            <UserCircle className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="destructive" title="Remove Intern" onClick={() => handleDeleteRequest(intern.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {filteredInterns.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No interns found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Intern Dialog */}
      <Dialog open={isAddInternDialogOpen} onOpenChange={setIsAddInternDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Intern</DialogTitle>
            <DialogDescription>Create a new intern account and set up their internship details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="firstName" className="text-left">
                First Name
              </Label>
              <Input
                id="firstName"
                value={newIntern.firstName}
                onChange={(e) => setNewIntern({ ...newIntern, firstName: e.target.value })}
                className="col-span-3"
                placeholder="First Name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lastName" className="text-left">
                Last Name
              </Label>
              <Input
                id="lastName"
                value={newIntern.lastName}
                onChange={(e) => setNewIntern({ ...newIntern, lastName: e.target.value })}
                className="col-span-3"
                placeholder="Last Name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-left">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={newIntern.email}
                onChange={(e) => setNewIntern({ ...newIntern, email: e.target.value })}
                className="col-span-3"
                placeholder="first.last@cybersoftbpo.com"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="school" className="text-left">
                School
              </Label>
              <Select
                value={newIntern.schoolId}
                onValueChange={(value) => {
                  if (value === "add_new") {
                    setAddDialogType('school')
                    setShowAddDialog(true)
                  } else {
                    const selected = schools.find(s => s.id.toString() === value)
                    setNewIntern({ 
                      ...newIntern, 
                      school: selected?.name || "",
                      schoolId: value
                    })
                  }
                }}
              >
                <SelectTrigger className="col-span-3">
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
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="degree" className="text-left">
                Degree
              </Label>
              <Input
                id="degree"
                value={newIntern.degree}
                onChange={(e) => setNewIntern({ ...newIntern, degree: e.target.value })}
                className="col-span-3"
                placeholder="Degree Program (e.g. Computer Science)"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="requiredHours" className="text-left">
                Required Hours
              </Label>
              <Input
                id="requiredHours"
                type="number"
                value={newIntern.requiredHours}
                onChange={(e) =>
                  setNewIntern({ ...newIntern, requiredHours: e.target.value })
                }
                className="col-span-3"
                placeholder="Hours required (e.g. 520)"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="department" className="text-left">
                Department
              </Label>
              <Select
                value={newIntern.departmentId}
                onValueChange={(value) => {
                  if (value === "add_new") {
                    setAddDialogType('department')
                    setShowAddDialog(true)
                  } else {
                    const selected = departments.find(d => d.id.toString() === value)
                    setNewIntern({ 
                      ...newIntern, 
                      department: selected?.name || "",
                      departmentId: value
                    })
                  }
                }}
              >
                <SelectTrigger className="col-span-3">
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
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="supervisor" className="text-left">
                Supervisor
              </Label>
              <Select
                value={newIntern.supervisorId}
                onValueChange={(value) => {
                  if (value === "add_new") {
                    setAddDialogType('supervisor')
                    setShowAddDialog(true)
                  } else {
                    const selected = supervisors.find(s => s.id.toString() === value)
                    setNewIntern({ 
                      ...newIntern, 
                      supervisor: selected?.name || "",
                      supervisorId: value,
                      supervisorEmail: selected?.email || ""
                    })
                  }
                }}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select supervisor" />
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
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="startDate" className="text-left">
                Start Date
              </Label>
              <Input
                id="startDate"
                type="date"
                value={newIntern.startDate}
                onChange={(e) => setNewIntern({ ...newIntern, startDate: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="endDate" className="text-left">
                End Date
              </Label>
              <Input
                id="endDate"
                type="date"
                value={newIntern.endDate}
                onChange={(e) => setNewIntern({ ...newIntern, endDate: e.target.value })}
                className="col-span-3"
              />
            </div>
            {/* <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="workSchedule" className="text-left">
                Work Schedule
              </Label>
              <Select
                value={newIntern.workSchedule}
                onValueChange={(value) => setNewIntern({ ...newIntern, workSchedule: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select work schedule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific schedule</SelectItem>
                  <SelectItem value="Monday-Friday, 9AM-6PM">Monday-Friday, 9AM-6PM</SelectItem>
                  <SelectItem value="Monday-Friday, 8AM-5PM">Monday-Friday, 8AM-5PM</SelectItem>
                  <SelectItem value="Monday-Friday, 10AM-7PM">Monday-Friday, 10AM-7PM</SelectItem>
                  <SelectItem value="Monday-Saturday, 9AM-6PM">Monday-Saturday, 9AM-6PM</SelectItem>
                  <SelectItem value="Flexible hours">Flexible hours</SelectItem>
                </SelectContent>
              </Select>
            </div> */}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsAddInternDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddIntern} disabled={isLoading}>
              {isLoading ? "Adding..." : "Add Intern"}
            </Button>
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
              onClick={handleAddNewEntity}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this intern? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isLoading}>
              {isLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog */}
      <Dialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{alertContent.title}</DialogTitle>
            <DialogDescription>{alertContent.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button onClick={() => setIsAlertDialogOpen(false)}>OK</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
