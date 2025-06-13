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
} from "@/components/ui/dialog"
import { InternProfile } from "@/components/intern/intern-profile"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"
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

/**
 * ManageInternsDashboard
 * Admin dashboard for managing interns: add, delete, filter, and view profiles.
 */
export function ManageInternsDashboard() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [selectedInternId, setSelectedInternId] = useState<string | null>(null)
  const [isAddInternDialogOpen, setIsAddInternDialogOpen] = useState(false)
  const [interns, setInterns] = useState<Intern[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Form states for adding new intern
  const [newIntern, setNewIntern] = useState({
    name: "",
    email: "",
    password: "intern123",
    school: "",
    department: "",
    requiredHours: 480,
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
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
      const truncateTo2Decimals = (val: number) => {
        const [int, dec = ""] = val.toString().split(".")
        return dec.length > 0 ? `${int}.${dec.slice(0, 2).padEnd(2, "0")}` : `${int}.00`
      }

      const getTruncatedDecimalHours = (log: TimeLog) => {
        const timeIn = log.timeIn || log.time_in
        const timeOut = log.timeOut || log.time_out
        if (!timeIn || !timeOut) return 0
        const inDate = new Date(timeIn)
        const outDate = new Date(timeOut)
        const diffMs = outDate.getTime() - inDate.getTime()
        const hours = Math.floor(diffMs / (1000 * 60 * 60))
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
        const decimal = hours + minutes / 60
        return Number(truncateTo2Decimals(decimal))
      }

      const mapped: Intern[] = internsData.map((intern: Record<string, unknown>) => {
        const internId = Number(intern.id)
        // Find all completed logs for this intern
        const internLogs = logsArr.filter(
          (log) =>
            (log.user_id === internId || log.internId === internId) &&
            log.status === "completed"
        )
        // Sum using getTruncatedDecimalHours
        const completedHours = internLogs
          .filter((log) => (log.timeIn || log.time_in) && (log.timeOut || log.time_out))
          .reduce((sum, log) => sum + getTruncatedDecimalHours(log), 0)

        return {
          id: intern.id?.toString() ?? "",
          name: `${intern.first_name ?? ""} ${intern.last_name ?? ""}`.trim(),
          email: (intern.email as string) ?? "",
          department: (intern.department as string) || (intern.internship as any)?.department?.name || "",
          school: (intern.school as string) || (intern.internship as any)?.school?.name || "",
          internshipDetails: {
            requiredHours:
              (intern.internshipDetails as any)?.requiredHours ||
              (intern.internship as any)?.required_hours ||
              0,
            completedHours: Number(completedHours.toFixed(2)),
            startDate:
              (intern.internshipDetails as any)?.startDate ||
              (intern.internship as any)?.start_date ||
              "",
            endDate:
              (intern.internshipDetails as any)?.endDate ||
              (intern.internship as any)?.end_date ||
              "",
          },
        }
      })
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

  // Build department list from intern data
  const departments = Array.from(new Set(interns.map(i => i.department).filter(Boolean))).map(d => ({
    id: d,
    name: d,
  }))

  /**
   * Add a new intern
   */
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
      const res = await fetch("/api/admin/interns", {
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
      fetchAll()
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

  /**
   * Delete an intern by ID
   */
  const handleDeleteIntern = async (internId: string) => {
    if (!confirm("Are you sure you want to delete this intern? This action cannot be undone.")) {
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/interns/${internId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete intern")
      toast({
        title: "Success",
        description: "Intern deleted successfully",
      })
      fetchAll()
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
                          <Button size="icon" variant="destructive" title="Remove Intern" onClick={() => handleDeleteIntern(intern.id)}>
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
    </div>
  )
}
