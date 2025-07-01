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
import { groupEditRequestsByContinuousSessions } from "@/lib/session-utils"

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

  const handleAction = async (sessionId: string, action: "approve" | "reject" | "revert") => {
    const session = groupedRequests.find(s => s.sessionId === sessionId)
    if (!session) return

    setActionLoading(session.allRequestIds[0]) // Use first request ID for loading state
    try {
      // For continuous sessions with multiple requests, use batch API
      if (session.allRequestIds.length > 1) {
        const res = await fetch("/api/admin/time-log-edit-requests/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ 
            requestIds: session.allRequestIds, 
            action 
          }),
        })
        if (!res.ok) throw new Error(`Failed to ${action} continuous session`)
      } else {
        // For single requests, use existing individual API
        const requestId = session.allRequestIds[0]
        if (action === "revert") {
          const res = await fetch(`/api/admin/time-log-edit-requests/${requestId}/revert`, {
            method: "POST",
            credentials: "include",
          })
          if (!res.ok) throw new Error("Failed to revert request")
        } else {
          const res = await fetch(`/api/admin/time-log-edit-requests/${requestId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ action }),
          })
          if (!res.ok) throw new Error("Failed to update request")
        }
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

  // Group edit requests by continuous sessions using centralized logic
  const groupedRequests = (() => {
    // First group by intern and date
    const groups: Record<string, EditLogRequest[]> = {}
    for (const req of filteredRequests) {
      const dateStr = req.originalTimeIn || req.requestedTimeIn
      if (!dateStr) continue
      const dateKey = new Date(dateStr).toISOString().slice(0, 10)
      const groupKey = `${req.internName}-${dateKey}`
      if (!groups[groupKey]) groups[groupKey] = []
      groups[groupKey].push(req)
    }

    // Then process each group with the centralized session logic
    const result: Array<{
      sessionId: string
      requests: EditLogRequest[]
      originalTimeIn: string | null
      originalTimeOut: string | null
      requestedTimeIn: string | null
      requestedTimeOut: string | null
      status: "pending" | "approved" | "rejected"
      internName: string
      allRequestIds: number[]
      date: string
    }> = []

    for (const [groupKey, reqs] of Object.entries(groups)) {
      const sessions = groupEditRequestsByContinuousSessions(reqs)
      for (const session of sessions) {
        result.push({
          sessionId: session.sessionId,
          requests: session.requests as EditLogRequest[], // Type assertion since we know the structure matches
          originalTimeIn: session.originalTimeIn,
          originalTimeOut: session.originalTimeOut,
          requestedTimeIn: session.requestedTimeIn,
          requestedTimeOut: session.requestedTimeOut,
          status: session.status,
          internName: session.internName,
          allRequestIds: session.allRequestIds,
          date: groupKey.split("-").slice(-3).join("-") // Extract date from groupKey
        })
      }
    }

    return result
  })()

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
          ) : groupedRequests.length === 0 ? (
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
                {groupedRequests.map((session) => (
                  <TableRow key={session.sessionId}>
                    <TableCell>{session.internName}</TableCell>
                    <TableCell>
                      {(() => {
                        const dateStr = session.originalTimeIn || session.requestedTimeIn
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
                      })()}
                    </TableCell>
                    <TableCell>
                      {session.originalTimeIn ? (
                        <Badge
                          variant="outline"
                          className={
                            session.status === "approved"
                              ? "bg-gray-100 text-gray-700 border-gray-300"
                              : "bg-green-100 text-green-700 border-green-300"
                          }
                        >
                          {new Date(session.originalTimeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {session.originalTimeOut ? (
                        <Badge
                          variant="outline"
                          className={
                            session.status === "approved"
                              ? "bg-gray-100 text-gray-700 border-gray-300"
                              : "bg-red-100 text-red-700 border-red-300"
                          }
                        >
                          {new Date(session.originalTimeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {session.requestedTimeIn ? (
                        <Badge
                          variant="outline"
                          className={
                            session.status === "pending"
                              ? "bg-blue-100 text-blue-700 border-blue-300"
                              : session.status === "approved"
                                ? "bg-green-100 text-green-700 border-green-300"
                                : "bg-gray-100 text-gray-700 border-gray-300"
                          }
                        >
                          {new Date(session.requestedTimeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {session.requestedTimeOut ? (
                        <Badge
                          variant="outline"
                          className={
                            session.status === "pending"
                              ? "bg-blue-100 text-blue-700 border-blue-300"
                              : session.status === "approved"
                                ? "bg-green-100 text-green-700 border-green-300"
                                : "bg-gray-100 text-gray-700 border-gray-300"
                          }
                        >
                          {new Date(session.requestedTimeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={session.status === "pending" ? "default" : "outline"}
                        className={
                          session.status === "pending"
                            ? "bg-yellow-500 text-white"
                            : session.status === "approved"
                              ? "bg-green-100 text-green-700 border-green-300"
                              : "bg-red-100 text-red-700 border-red-300"
                        }
                      >
                        {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                      </Badge>
                      {session.allRequestIds.length > 1 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {session.allRequestIds.length} requests
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {session.status === "pending" ? (
                        <div className="flex gap-2 justify-end">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            disabled={actionLoading === session.allRequestIds[0]} 
                            onClick={() => handleAction(session.sessionId, "approve")}
                          >
                            Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            disabled={actionLoading === session.allRequestIds[0]} 
                            onClick={() => handleAction(session.sessionId, "reject")}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionLoading === session.allRequestIds[0]}
                          onClick={() => handleAction(session.sessionId, "revert")}
                          title="Revert to pending"
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
