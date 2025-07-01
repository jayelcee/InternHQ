"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle, XCircle, Search, Calendar as CalendarIcon } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format } from "date-fns"

interface EditLogRequest {
  id: number
  logId: number
  internName: string
  requestedTimeIn: string | null
  requestedTimeOut: string | null
  originalTimeIn: string | null
  originalTimeOut: string | null
  status: "pending" | "approved" | "rejected"
  requestedAt: string
  email?: string
  school?: string
  department?: string
}

export function EditLogRequestsAdmin() {
  const [requests, setRequests] = useState<EditLogRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // --- Summary stats for cards ---
  const stats = {
    pending: requests.filter(r => r.status === "pending").length,
    approved: requests.filter(r => r.status === "approved").length,
    rejected: requests.filter(r => r.status === "rejected").length,
  }

  const fetchRequests = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/time-log-edit-requests")
      if (!res.ok) throw new Error("Failed to fetch edit requests")
      const data = await res.json()
      setRequests(Array.isArray(data) ? data : data.requests)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load requests"
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  const handleAction = async (id: number, action: "approve" | "reject" | "revert") => {
    setActionLoading(id)
    try {
      // For "revert", call only the revert endpoint, not the generic update endpoint
      if (action === "revert") {
        const res = await fetch(`/api/admin/time-log-edit-requests/${id}/revert`, {
          method: "POST",
          credentials: "include",
        })
        if (!res.ok) throw new Error("Failed to revert request")
      } else {
        const res = await fetch(`/api/admin/time-log-edit-requests/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action }),
        })
        if (!res.ok) throw new Error("Failed to update request")
      }
      await fetchRequests()
    } catch (error) {
      console.error("Error performing action:", error)
      // Optionally show toast
    } finally {
      setActionLoading(null)
    }
  }

  // Get unique departments from requests
  const departments = Array.from(
    new Set(requests.map(r => r.department || ""))
  ).filter(Boolean)

  // Filtered requests based on search, status, department, and date
  const filteredRequests = requests.filter(req => {
    const matchesSearch =
      req.internName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.school || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.department || "").toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus =
      statusFilter === "all" || req.status === statusFilter
    const matchesDept =
      departmentFilter === "all" || (req.department || "") === departmentFilter
    const matchesDate =
      !selectedDate ||
      (
        (() => {
          const dateStr = req.originalTimeIn || req.requestedTimeIn
          if (!dateStr) return false
          const date = new Date(dateStr)
          return (
            date.toDateString() === selectedDate.toDateString()
          )
        })()
      )
    return matchesSearch && matchesStatus && matchesDept && matchesDate
  })

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Edit requests awaiting review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">Approved edit requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <p className="text-xs text-muted-foreground">Rejected edit requests</p>
          </CardContent>
        </Card>
      </div>
      {/* Filter & Search Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search input */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search by name, email, school, or department..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full border rounded px-10 py-2 text-sm"
                />
              </div>
            </div>
            {/* Department filter */}
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            {/* Date filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-48"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate
                    ? format(selectedDate, "MMM dd, yyyy")
                    : "All Dates"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate ?? undefined}
                  onSelect={(date) => setSelectedDate(date ?? null)}
                  initialFocus
                />
                <div className="p-2">
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setSelectedDate(null)}
                  >
                    All Dates
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Edit Log Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-gray-500">Loading requests...</div>
          ) : error ? (
            <div className="py-8 text-center text-red-500">{error}</div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No edit requests found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Intern</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Original Time In</TableHead>
                  <TableHead>Original Time Out</TableHead>
                  <TableHead>Requested Time In</TableHead>
                  <TableHead>Requested Time Out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map(req => (
                  <TableRow key={req.id}>
                    <TableCell>{req.internName}</TableCell>
                    <TableCell>
                      {
                        // Prefer originalTimeIn, fallback to requestedTimeIn, else "-"
                        (() => {
                          const dateStr = req.originalTimeIn || req.requestedTimeIn
                          if (!dateStr) return "-"
                          const date = new Date(dateStr)
                          return (
                            <div className="flex flex-col items-start leading-tight">
                              <span className="text-xs text-muted-foreground">
                                {date.toLocaleDateString("en-US", { weekday: "short" })}
                              </span>
                              <span>
                                {date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
                              </span>
                            </div>
                          )
                        })()
                      }
                    </TableCell>
                    <TableCell>
                      {req.originalTimeIn ? (
                        <Badge
                          variant="outline"
                          className={
                            req.status === "approved"
                              ? "bg-gray-100 text-gray-700 border-gray-300"
                              : "bg-green-100 text-green-700 border-green-300"
                          }
                        >
                          {new Date(req.originalTimeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {req.originalTimeOut ? (
                        <Badge
                          variant="outline"
                          className={
                            req.status === "approved"
                              ? "bg-gray-100 text-gray-700 border-gray-300"
                              : "bg-red-100 text-red-700 border-red-300"
                          }
                        >
                          {new Date(req.originalTimeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {req.requestedTimeIn ? (
                        <Badge
                          variant="outline"
                          className={
                            req.status === "pending"
                              ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                              : req.status === "rejected"
                              ? "bg-gray-100 text-gray-700 border-gray-300"
                              : "bg-green-100 text-green-700 border-green-300"
                          }
                        >
                          {new Date(req.requestedTimeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {req.requestedTimeOut ? (
                        <Badge
                          variant="outline"
                          className={
                            req.status === "pending"
                              ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                              : req.status === "rejected"
                              ? "bg-gray-100 text-gray-700 border-gray-300"
                              : "bg-red-100 text-red-700 border-red-300"
                          }
                        >
                          {new Date(req.requestedTimeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          req.status === "pending"
                            ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                            : req.status === "approved"
                            ? "bg-green-100 text-green-700 border-green-300"
                            : "bg-gray-100 text-gray-700 border-gray-300"
                        }
                      >
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {req.status === "pending" && (
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" disabled={actionLoading === req.id} onClick={() => handleAction(req.id, "approve")}>Approve</Button>
                          <Button size="sm" variant="destructive" disabled={actionLoading === req.id} onClick={() => handleAction(req.id, "reject")}>Reject</Button>
                        </div>
                      )}
                      {(req.status === "approved" || req.status === "rejected") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-gray-600 border-gray-300 hover:bg-gray-50"
                          disabled={actionLoading === req.id}
                          onClick={() => handleAction(req.id, "revert")}
                        >
                          Revert
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
