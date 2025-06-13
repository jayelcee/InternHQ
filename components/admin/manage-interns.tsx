"use client"

import { useState, useEffect } from "react"
import { Search, UserPlus, Trash2, Eye, Plus, X } from "lucide-react"
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
} from "@/components/ui/dialog"
import { InternProfile } from "@/components/intern/intern-profile"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"

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
  projects?: {
    id: string
    name: string
    role?: string
  }[]
}

interface Department {
  id: string
  name: string
}

interface Project {
  id: string
  name: string
}

export function ManageInternsDashboard() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [selectedInternId, setSelectedInternId] = useState<string | null>(null)
  const [isAddInternDialogOpen, setIsAddInternDialogOpen] = useState(false)
  const [isAssignProjectDialogOpen, setIsAssignProjectDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [interns, setInterns] = useState<Intern[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [availableProjects, setAvailableProjects] = useState<Project[]>([])
  const [selectedInternForProject, setSelectedInternForProject] = useState<string | null>(null)
  const [projectName, setProjectName] = useState("")
  const [internRole, setInternRole] = useState("")

  // Form states for adding new intern
  const [newIntern, setNewIntern] = useState({
    name: "",
    email: "",
    password: "intern123", // Default password
    school: "",
    department: "",
    requiredHours: 480,
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
  })

  useEffect(() => {
    fetchDepartments()
    fetchProjects()
    fetchInterns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchDepartments = async () => {
    try {
      const res = await fetch("/api/departments")
      if (!res.ok) throw new Error("Failed to fetch departments")
      const data = await res.json()
      setDepartments(data)
    } catch {
      setDepartments([])
    }
  }

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects")
      if (!res.ok) throw new Error("Failed to fetch projects")
      const data = await res.json()
      setAvailableProjects(data)
    } catch {
      setAvailableProjects([])
    }
  }

  const fetchInterns = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/interns")
      if (!res.ok) throw new Error("Failed to fetch interns")
      const data = await res.json()
      // Map API data to Intern[]
      const mapped: Intern[] = data.map((intern: any) => ({
        id: intern.id.toString(),
        name: `${intern.first_name} ${intern.last_name}`,
        email: intern.email,
        department: intern.internship?.department?.name || "",
        school: intern.internship?.school?.name || "",
        internshipDetails: {
          requiredHours: intern.internship?.required_hours || 0,
          completedHours: intern.completedHours || 0,
          startDate: intern.internship?.start_date || "",
          endDate: intern.internship?.end_date || "",
        },
        projects: intern.projects?.map((p: any) => ({
          id: p.id.toString(),
          name: p.name,
          role: p.role,
        })) || [],
      }))
      setInterns(mapped)
    } catch {
      toast({
        title: "Error",
        description: "Failed to fetch interns",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddIntern = async () => {
    try {
      setIsLoading(true)
      if (!newIntern.name || !newIntern.email || !newIntern.school || !newIntern.department) {
        toast({
          title: "Error",
          description: "Please fill all required fields",
          variant: "destructive",
        })
        return
      }
      const res = await fetch("/api/interns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newIntern),
      })
      if (!res.ok) throw new Error("Failed to add intern")
      toast({
        title: "Success",
        description: "Intern added successfully",
      })
      setIsAddInternDialogOpen(false)
      setNewIntern({
        name: "",
        email: "",
        password: "intern123",
        school: "",
        department: "",
        requiredHours: 480,
        startDate: format(new Date(), "yyyy-MM-dd"),
        endDate: format(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
      })
      fetchInterns()
    } catch {
      toast({
        title: "Error",
        description: "Failed to add intern",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteIntern = async (internId: string) => {
    if (!confirm("Are you sure you want to delete this intern? This action cannot be undone.")) {
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch(`/api/interns/${internId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete intern")
      toast({
        title: "Success",
        description: "Intern deleted successfully",
      })
      fetchInterns()
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete intern",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAssignProject = async () => {
    try {
      setIsLoading(true)
      if (!selectedInternForProject || !projectName) {
        toast({
          title: "Error",
          description: "Please select an intern and enter a project name",
          variant: "destructive",
        })
        return
      }
      const res = await fetch("/api/intern-project-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedInternForProject,
          project_name: projectName,
          role: internRole,
        }),
      })
      if (!res.ok) throw new Error("Failed to assign project")
      toast({
        title: "Success",
        description: "Project assigned successfully",
      })
      setSelectedInternForProject(null)
      setProjectName("")
      setInternRole("")
      setIsAssignProjectDialogOpen(false)
      fetchInterns()
    } catch {
      toast({
        title: "Error",
        description: "Failed to assign project",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveProjectAssignment = async (internId: string, projectId: string) => {
    if (!confirm("Are you sure you want to remove this project assignment?")) {
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch(`/api/intern-project-assignments/${internId}/${projectId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to remove project assignment")
      toast({
        title: "Success",
        description: "Project assignment removed successfully",
      })
      fetchInterns()
    } catch {
      toast({
        title: "Error",
        description: "Failed to remove project assignment",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

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
          <Button onClick={() => setIsAssignProjectDialogOpen(true)} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Assign Project
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
                {departments.map((dept) => (
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
                  <TableHead>Assigned Projects</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInterns.map((intern) => {
                  const progressPercentage =
                    (intern.internshipDetails.completedHours / intern.internshipDetails.requiredHours) * 100
                  return (
                    <TableRow key={intern.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{intern.name}</div>
                          <div className="text-sm text-gray-500">{intern.email}</div>
                          <Badge variant="outline" className="text-xs">
                            {intern.school}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{intern.department}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {intern.projects && intern.projects.length > 0 ? (
                            intern.projects.map((project) => (
                              <div key={project.id} className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {project.name}
                                </Badge>
                                {project.role && <span className="text-xs text-gray-500">({project.role})</span>}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-4 w-4 p-0 text-red-500 hover:text-red-700"
                                  onClick={() => handleRemoveProjectAssignment(intern.id, project.id)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))
                          ) : (
                            <span className="text-sm text-gray-400">No projects assigned</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">
                            {intern.internshipDetails.completedHours}h / {intern.internshipDetails.requiredHours}h
                          </div>
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                            ></div>
                          </div>
                          <div className="text-xs text-gray-500">{progressPercentage.toFixed(1)}%</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setSelectedInternId(intern.id)}>
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteIntern(intern.id)}>
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Intern</DialogTitle>
            <DialogDescription>Create a new intern account and set up their internship details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newIntern.name}
                onChange={(e) => setNewIntern({ ...newIntern, name: e.target.value })}
                className="col-span-3"
                placeholder="Full name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={newIntern.email}
                onChange={(e) => setNewIntern({ ...newIntern, email: e.target.value })}
                className="col-span-3"
                placeholder="email@example.com"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="school" className="text-right">
                School
              </Label>
              <Input
                id="school"
                value={newIntern.school}
                onChange={(e) => setNewIntern({ ...newIntern, school: e.target.value })}
                className="col-span-3"
                placeholder="University name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="department" className="text-right">
                Department
              </Label>
              <Select
                value={newIntern.department}
                onValueChange={(value) => setNewIntern({ ...newIntern, department: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.name}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="requiredHours" className="text-right">
                Required Hours
              </Label>
              <Input
                id="requiredHours"
                type="number"
                value={newIntern.requiredHours}
                onChange={(e) => setNewIntern({ ...newIntern, requiredHours: Number.parseInt(e.target.value) || 0 })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="startDate" className="text-right">
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
              <Label htmlFor="endDate" className="text-right">
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

      {/* Assign Project Dialog */}
      <Dialog open={isAssignProjectDialogOpen} onOpenChange={setIsAssignProjectDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Assign Project to Intern</DialogTitle>
            <DialogDescription>
              Select an intern and enter project details to create a new assignment.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="intern" className="text-right">
                Intern
              </Label>
              <Select value={selectedInternForProject || ""} onValueChange={setSelectedInternForProject}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select intern" />
                </SelectTrigger>
                <SelectContent>
                  {interns.map((intern) => (
                    <SelectItem key={intern.id} value={intern.id}>
                      {intern.name} - {intern.department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="project" className="text-right">
                Project
              </Label>
              <Select value={projectName} onValueChange={setProjectName}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {availableProjects.map((project) => (
                    <SelectItem key={project.id} value={project.name}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Role
              </Label>
              <Input
                id="role"
                value={internRole}
                onChange={(e) => setInternRole(e.target.value)}
                className="col-span-3"
                placeholder="e.g., Frontend Developer"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsAssignProjectDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAssignProject} disabled={isLoading}>
              {isLoading ? "Assigning..." : "Assign Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
