"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle, XCircle, Trash2, RotateCcw, Search, Calendar as CalendarIcon } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format } from "date-fns"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

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
  userRole?: string
  requestedBy?: string
  requestedById?: number
  requesterRole?: string
  reviewedBy?: string | null
  reviewedById?: number | null
  reviewedAt?: string | null
  [key: string]: unknown
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
  const [confirmAction, setConfirmAction] = useState<{
    action: "approve" | "reject" | "revert" | "delete" | null,
    req: EditLogRequest | null
  }>({ action: null, req: null })

  // Summary statistics for edit log requests
  const stats = {
    pending: requests.filter(r => r.status === "pending").length,
    approved: requests.filter(r => r.status === "approved").length,
    rejected: requests.filter(r => r.status === "rejected").length,
  }

  /**
   * Fetches all edit log requests from the API and updates state.
   */
  const fetchRequests = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/time-log-edit-requests")
      if (!res.ok) throw new Error("Failed to fetch edit requests")
      const data = await res.json()
      const requests = Array.isArray(data) ? data : data.requests
      setRequests(requests)
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

  /**
   * Handles actions (approve, reject, revert, delete) on an edit log request.
   * @param sessionId - The ID of the edit log request
   * @param action - The action to perform (approve, reject, revert, delete)
   */
  const handleAction = async (sessionId: string, action: "approve" | "reject" | "revert" | "delete") => {
    const session = requests.find(s => s.id === Number(sessionId))
    if (!session) return
    setActionLoading(session.id)
    if (action === "revert") {
      try {
        const res = await fetch(`/api/admin/time-log-edit-requests/${session.id}/revert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ 
            removeDuplicates: true,
            updateReferences: true
          }),
        })
        if (!res.ok) throw new Error("Failed to revert request")
      } catch (error) {
        console.error("Error reverting request:", error)
      }
    } else if (action === "delete") {
      try {
        const res = await fetch(`/api/admin/time-log-edit-requests/${session.id}`, {
          method: "DELETE",
          credentials: "include",
        })
        if (!res.ok) throw new Error("Failed to delete request")
      } catch (error) {
        console.error("Error deleting request:", error)
      }
    } else {
      try {
        const res = await fetch(`/api/admin/time-log-edit-requests/${session.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ 
            action,
            removeDuplicates: true,
            updateReferences: true
          }),
        })
        if (!res.ok) throw new Error(`Failed to update request with ${action}`)
      } catch (error) {
        console.error(`Error performing ${action} on request:`, error)
      }
    }
    await fetchRequests()
    setActionLoading(null)
  }

  const departments = Array.from(
    new Set(requests.map(r => r.department || ""))
  ).filter(Boolean)

  // Filters requests based on search, status, department, and date
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
      {/* Confirmation Dialog */}
      <Dialog open={!!confirmAction.action} onOpenChange={open => { if (!open) setConfirmAction({ action: null, req: null }) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction.action === "approve" && "Approve Edit Request"}
              {confirmAction.action === "reject" && "Reject Edit Request"}
              {confirmAction.action === "revert" && "Revert Edit Request"}
              {confirmAction.action === "delete" && "Delete Edit Request"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {confirmAction.action === "approve" && (
              <span>Are you sure you want to approve this edit request?</span>
            )}
            {confirmAction.action === "reject" && (
              <span>Are you sure you want to reject this edit request?</span>
            )}
            {confirmAction.action === "revert" && (
              <span>Are you sure you want to revert this request to pending status?</span>
            )}
            {confirmAction.action === "delete" && (
              <span>Are you sure you want to delete this edit request? This cannot be undone.</span>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmAction({ action: null, req: null })}
              disabled={actionLoading === confirmAction.req?.id}
            >
              Cancel
            </Button>
            <Button
              variant={
                confirmAction.action === "delete"
                  ? "destructive"
                  : confirmAction.action === "reject"
                  ? "destructive"
                  : "default"
              }
              className={
                confirmAction.action === "approve"
                  ? "bg-green-600 text-white"
                  : confirmAction.action === "reject"
                  ? "bg-red-600 text-white"
                  : confirmAction.action === "delete"
                  ? "bg-red-600 text-white"
                  : ""
              }
              onClick={async () => {
                if (confirmAction.req && confirmAction.action) {
                  await handleAction(confirmAction.req.id.toString(), confirmAction.action)
                  setConfirmAction({ action: null, req: null })
                }
              }}
              disabled={actionLoading === confirmAction.req?.id}
            >
              {actionLoading === confirmAction.req?.id ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <>
                  {confirmAction.action === "approve" && "Approve"}
                  {confirmAction.action === "reject" && "Reject"}
                  {confirmAction.action === "revert" && "Revert"}
                  {confirmAction.action === "delete" && "Delete"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary cards for edit log request statuses Pending, Approved, Rejected */}
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

      {/* Filter and search controls for edit log requests */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
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

      {/* Main table for displaying edit log requests */}
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
                  <TableHead>User</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Original Time In</TableHead>
                  <TableHead>Original Time Out</TableHead>
                  <TableHead>Requested Time In</TableHead>
                  <TableHead>Requested Time Out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reviewed By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((req) => {
                  const dateStr = req.originalTimeIn || req.requestedTimeIn
                  const date = dateStr ? new Date(dateStr) : null
                  let reviewedBy = req.reviewedBy;
                  let isDirectEdit = false;
                  if (req.status === "approved") {
                    if (req.requestedById && req.reviewedById && req.requestedById === req.reviewedById) {
                      isDirectEdit = true;
                    } else if (req.requestedBy && req.reviewedBy && req.requestedBy === req.reviewedBy) {
                      isDirectEdit = true;
                    }
                  }
                  if (req.status === "approved" && !reviewedBy && req.reviewedAt) {
                    if (req.requestedBy) {
                      reviewedBy = req.requestedBy;
                      isDirectEdit = true;
                    } else {
                      reviewedBy = "System";
                      isDirectEdit = true;
                    }
                  } else if (req.status === "approved" && !reviewedBy && req.userRole === "admin" && req.requestedBy) {
                    reviewedBy = req.requestedBy;
                    isDirectEdit = true;
                  }
                  return (
                    <TableRow key={req.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{req.internName}</span>
                          <span className="text-xs text-muted-foreground font-semibold">
                            {req.userRole === "admin" ? "Admin" : "Intern"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {date ? (
                          <div className="flex flex-col items-start leading-tight">
                            <span className="text-xs text-muted-foreground">
                              {date.toLocaleDateString("en-US", { weekday: "short" })}
                            </span>
                            <span>
                              {date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
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
                                ? "bg-blue-100 text-blue-700 border-blue-300"
                                : req.status === "approved"
                                  ? "bg-green-100 text-green-700 border-green-300"
                                  : "bg-gray-100 text-gray-700 border-gray-300"
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
                                ? "bg-blue-100 text-blue-700 border-blue-300"
                                : req.status === "approved"
                                  ? "bg-green-100 text-green-700 border-green-300"
                                  : "bg-gray-100 text-gray-700 border-gray-300"
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
                          variant={req.status === "pending" ? "default" : "outline"}
                          className={
                            req.status === "pending"
                              ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                              : req.status === "approved"
                                ? "bg-green-100 text-green-700 border-green-300"
                                : "bg-red-100 text-red-700 border-red-300"
                          }
                        >
                          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {reviewedBy ? (
                          <div className="text-sm">
                            <div>{reviewedBy}</div>
                            {req.reviewedAt && (
                              <div className="text-xs text-gray-500">
                                {new Date(req.reviewedAt).toLocaleDateString()}
                              </div>
                            )}
                            {isDirectEdit && (
                              <div className="text-xs text-blue-600 font-medium">
                                Direct Admin Edit
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {req.status === "pending" ? (
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 border-green-300 hover:bg-green-50"
                              // onClick={() => handleAction(req.id.toString(), "approve")}
                              onClick={() => setConfirmAction({ action: "approve", req })}
                              disabled={actionLoading === req.id}
                              title="Approve Edit Request"
                            >
                              {actionLoading === req.id && confirmAction.action === "approve" ? (
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                              ) : (
                                <>
                                  <CheckCircle className="h-3 w-3" />
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-300 hover:bg-red-50"
                              // onClick={() => handleAction(req.id.toString(), "reject")}
                              onClick={() => setConfirmAction({ action: "reject", req })}
                              disabled={actionLoading === req.id}
                              title="Reject Edit Request"
                            >
                              {actionLoading === req.id && confirmAction.action === "reject" ? (
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                              ) : (
                                <>
                                  <XCircle className="h-3 w-3" />
                                </>
                              )}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-gray-600 border-gray-300 hover:bg-gray-50"
                              disabled={actionLoading === req.id}
                              // onClick={() => handleAction(req.id.toString(), "revert")}
                              onClick={() => setConfirmAction({ action: "revert", req })}
                              title="Revert to pending status."
                            >
                              {actionLoading === req.id && confirmAction.action === "revert" ? (
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-600 border-t-transparent" />
                              ) : (
                                <>
                                  <RotateCcw className="h-3 w-3" />
                                </>
                              )}
                            </Button>
                            {req.status === "approved" ? (
                              <button
                                type="button"
                                className="inline-flex items-center justify-center h-8 px-2 py-2 rounded-md border border-red-300 bg-transparent opacity-40 cursor-not-allowed text-red-600 ml-2"
                                style={{ minWidth: 36 }}
                                tabIndex={-1}
                                title="Cannot delete an approved edit request."
                                disabled
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-300 hover:bg-red-50 ml-2"
                                disabled={actionLoading === req.id}
                                // onClick={() => handleAction(req.id.toString(), "delete")}
                                onClick={() => setConfirmAction({ action: "delete", req })}
                                title="Delete Request"
                              >
                                {actionLoading === req.id && confirmAction.action === "delete" ? (
                                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                                ) : (
                                  <>
                                    <Trash2 className="h-3 w-3" />
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
