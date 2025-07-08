/**
 * Manages internship completion requests for administrators
 * Allows admins to review, approve, or reject completion requests and generate documents
 */
"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText, 
  Award,
  Calendar,
  RotateCcw,
  Trash2
} from "lucide-react"
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format } from "date-fns"
import { Search } from "lucide-react"

interface CompletionRequest {
  id: number
  user_id: number
  internship_program_id: number
  total_hours_completed: number
  completion_date: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_at?: string
  reviewed_by?: number
  admin_notes?: string
  required_hours: number
  start_date: string
  end_date: string
  first_name: string
  last_name: string
  email: string
  school_name?: string
  department_name?: string
  reviewer_first_name?: string
  reviewer_last_name?: string
  has_dtr?: boolean
  has_certificate?: boolean
}

export function ManageCompletionRequests() {
  const { user } = useAuth()
  const [completionRequests, setCompletionRequests] = useState<CompletionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showActionDialog, setShowActionDialog] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)
  const [actionRequestId, setActionRequestId] = useState<number | null>(null)
  const [adminNotes, setAdminNotes] = useState("")
  const notesInputRef = useRef<HTMLInputElement | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmActionType, setConfirmActionType] = useState<'revert' | 'delete' | null>(null)
  const [confirmRequestId, setConfirmRequestId] = useState<number | null>(null)

  // Summary statistics
  const stats = {
    pending: completionRequests.filter(r => r.status === "pending").length,
    approved: completionRequests.filter(r => r.status === "approved").length,
    rejected: completionRequests.filter(r => r.status === "rejected").length,
  }

  // Departments for filter
  const departments = Array.from(new Set(completionRequests.map(r => r.department_name || ""))).filter(Boolean)

  // Filtered requests
  const filteredRequests = completionRequests.filter(req => {
    const matchesSearch =
      `${req.first_name} ${req.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.school_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.department_name || "").toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || req.status === statusFilter
    const matchesDept = departmentFilter === "all" || (req.department_name || "") === departmentFilter
    const matchesDate = !selectedDate || (new Date(req.created_at).toDateString() === selectedDate.toDateString())
    return matchesSearch && matchesStatus && matchesDept && matchesDate
  })

  const fetchCompletionRequests = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/completion-requests', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        // Handle both array and empty responses
        const requestArray = Array.isArray(data) ? data : []
        const formattedData = requestArray.map((request: CompletionRequest) => ({
          ...request,
          total_hours_completed: Number(request.total_hours_completed) || 0,
          required_hours: Number(request.required_hours) || 0
        }))
        setCompletionRequests(formattedData)
      } else {
        console.error('Failed to fetch completion requests:', response.status, response.statusText)
        // Set empty array on error
        setCompletionRequests([])
      }
    } catch (error) {
      console.error('Error fetching completion requests:', error)
      // Set empty array on error
      setCompletionRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchCompletionRequests()
    }
  }, [user?.role])

  const handleProcessRequest = async (id: number, action: 'approve' | 'reject' | 'revert' | 'delete', admin_notes?: string) => {
    setProcessingId(id)
    try {
      const response = await fetch(`/api/admin/completion-requests/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ action, admin_notes })
      })

      if (response.ok) {
        await fetchCompletionRequests()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to process request')
      }
    } catch (error) {
      console.error('Error processing request:', error)
      alert('Failed to process request')
    } finally {
      setProcessingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">Pending</Badge>
      case 'approved':
        return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">Approved</Badge>
      case 'rejected':
        return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">Rejected</Badge>
      default:
        return null
    }
  }

  const openActionDialog = (id: number, type: 'approve' | 'reject') => {
    setActionRequestId(id)
    setActionType(type)
    setAdminNotes("")
    setShowActionDialog(true)
    setTimeout(() => notesInputRef.current?.focus(), 100)
  }

  const confirmAction = async () => {
    if (!adminNotes.trim()) {
      notesInputRef.current?.focus()
      return
    }
    if (actionRequestId && actionType) {
      await handleProcessRequest(actionRequestId, actionType, adminNotes)
      setShowActionDialog(false)
      setActionRequestId(null)
      setActionType(null)
      setAdminNotes("")
    }
  }

  const openConfirmDialog = (id: number, type: 'revert' | 'delete') => {
    setConfirmRequestId(id)
    setConfirmActionType(type)
    setShowConfirmDialog(true)
  }

  const executeConfirmedAction = async () => {
    if (confirmRequestId && confirmActionType) {
      await handleProcessRequest(confirmRequestId, confirmActionType)
      setShowConfirmDialog(false)
      setConfirmRequestId(null)
      setConfirmActionType(null)
    }
  }

  if (user?.role !== 'admin') {
    return null
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-600">Loading completion requests...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Completion requests awaiting review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">Approved completion requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <p className="text-xs text-muted-foreground">Rejected completion requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search input */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by name, email, school, or department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {/* Department filter */}
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
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
                <Button variant="outline" className="w-full sm:w-48">
                  <Calendar className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "MMM dd, yyyy") : "All Dates"}
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
                  <Button variant="ghost" className="w-full" onClick={() => setSelectedDate(null)}>
                    All Dates
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* All Completion Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Completion Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">No Completion Requests</h3>
              <p className="text-sm">
                No internship completion requests have been submitted yet.<br />
                Completion requests will appear here when interns submit them.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Intern</TableHead>
                    <TableHead>Hours Completed</TableHead>
                    <TableHead>Required Hours</TableHead>
                    <TableHead>Request Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reviewed By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map(request => {
                    const reviewedBy = request.reviewer_first_name || request.reviewer_last_name
                      ? `${request.reviewer_first_name || ''} ${request.reviewer_last_name || ''}`.trim()
                      : null
                    return (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div className="font-medium">{request.first_name} {request.last_name}</div>
                          <div className="text-xs text-gray-500">{request.department_name || 'N/A'} • {request.school_name || 'N/A'}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                            {Number(request.total_hours_completed).toFixed(2)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">
                            {Number(request.required_hours)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-indigo-300">
                            {format(new Date(request.created_at), "MMM d, yyyy")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(request.status)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {reviewedBy ? (
                            <div className="text-sm">
                              {reviewedBy}
                              {request.reviewed_at && (
                                <div className="text-xs text-gray-400">
                                  {format(new Date(request.reviewed_at), "M/d/yyyy")}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {request.status === 'pending' ? (
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-300 hover:bg-green-50"
                                onClick={() => openActionDialog(request.id, 'approve')}
                                disabled={processingId === request.id}
                                title="Approve Completion Request"
                              >
                                {processingId === request.id ? (
                                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                                ) : (
                                  <CheckCircle className="h-3 w-3" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-300 hover:bg-red-50"
                                onClick={() => openActionDialog(request.id, 'reject')}
                                disabled={processingId === request.id}
                                title="Reject Completion Request"
                              >
                                {processingId === request.id ? (
                                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                                ) : (
                                  <XCircle className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-end items-center">
                              {request.status === 'approved' && (
                                <DocumentActions 
                                  requestId={request.id}
                                  has_dtr={request.has_dtr}
                                  has_certificate={request.has_certificate}
                                  onDocumentGenerated={() => fetchCompletionRequests()}
                                />
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-gray-600 border-gray-300 hover:bg-gray-50"
                                onClick={() => openConfirmDialog(request.id, 'revert')}
                                disabled={processingId === request.id}
                                title="Revert to pending status"
                              >
                                {processingId === request.id ? (
                                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-600 border-t-transparent" />
                                ) : (
                                  <RotateCcw className="h-3 w-3" />
                                )}
                              </Button>
                              {request.status !== 'approved' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-300 hover:bg-red-50"
                                  onClick={() => openConfirmDialog(request.id, 'delete')}
                                  disabled={processingId === request.id}
                                  title="Delete Request"
                                >
                                  {processingId === request.id ? (
                                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Confirmation Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{actionType === 'approve' ? 'Approve Completion Request' : 'Reject Completion Request'}</DialogTitle>
            <DialogDescription>
              Please provide a reason/note for this action. This will be visible to the intern.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Label htmlFor="admin-notes">Admin Note <span className="text-red-500">*</span></Label>
            <Input
              id="admin-notes"
              ref={notesInputRef}
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              placeholder="Enter your notes or reason"
              required
              className={adminNotes.trim() ? "" : "border-red-500"}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmAction}
              disabled={!adminNotes.trim() || processingId === actionRequestId}
              className={`${actionType === 'approve' ? 'bg-green-600 text-white hover:bg-green-600' : 'bg-red-600 text-white hover:bg-red-600'}`}
            >
              {processingId === actionRequestId ? 'Processing...' : (actionType === 'approve' ? 'Approve' : 'Reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revert/Delete Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              {confirmActionType === 'revert' && 'This will revert the request to pending status.'}
              {confirmActionType === 'delete' && 'This will permanently delete the request. This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={executeConfirmedAction}
              disabled={processingId === confirmRequestId}
              variant={confirmActionType === 'delete' ? 'destructive' : 'default'}
            >
              {processingId === confirmRequestId ? 'Processing...' : (confirmActionType === 'revert' ? 'Revert' : 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface DocumentActionsProps {
  requestId: number
  has_dtr?: boolean
  has_certificate?: boolean
  onDocumentGenerated?: () => void
}

function DocumentActions({ requestId, has_dtr, has_certificate, onDocumentGenerated }: DocumentActionsProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [showDocumentDialog, setShowDocumentDialog] = useState(false)
  const [adminSignature, setAdminSignature] = useState('')
  const [adminTitle, setAdminTitle] = useState('')
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const generateDocument = async (type: 'dtr' | 'certificate') => {
    if (!adminSignature || !adminTitle) {
      alert('Please provide admin signature name and title')
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch(`/api/admin/completion-requests/${requestId}/generate-${type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          admin_signature_name: adminSignature,
          admin_title: adminTitle
        })
      })

      if (response.ok) {
        const message = `${type === 'dtr' ? 'DTR' : 'Certificate'} generated successfully!`
        setSuccessMessage(message)
        setShowSuccessDialog(true)
        setShowDocumentDialog(false)
        setAdminSignature('')
        setAdminTitle('')
        // Refresh parent component to update button states
        onDocumentGenerated?.()
      } else {
        const error = await response.json()
        alert(error.error || `Failed to generate ${type}`)
      }
    } catch (error) {
      console.error(`Error generating ${type}:`, error)
      alert(`Failed to generate ${type}`)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <>
      <Dialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <FileText className="w-4 h-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Generate Official Documents</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-signature">Admin Signature Name</Label>
              <Input
                id="admin-signature"
                value={adminSignature}
                onChange={(e) => setAdminSignature(e.target.value)}
                placeholder="Enter your full name for signature"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="admin-title">Admin Title</Label>
              <Input
                id="admin-title"
                value={adminTitle}
                onChange={(e) => setAdminTitle(e.target.value)}
                placeholder="Enter your title (e.g., HR Manager, Director)"
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => generateDocument('dtr')}
                disabled={isGenerating || has_dtr}
                className="flex-1"
                title={has_dtr ? "DTR already exists" : "Generate DTR"}
              >
                <FileText className="w-4 h-4 mr-2" />
                {isGenerating ? 'Generating...' : has_dtr ? 'DTR Generated' : 'Generate DTR'}
              </Button>
              <Button
                onClick={() => generateDocument('certificate')}
                disabled={isGenerating || has_certificate}
                className="flex-1"
                title={has_certificate ? "Certificate already exists" : "Generate Certificate"}
              >
                <Award className="w-4 h-4 mr-2" />
                {isGenerating ? 'Generating...' : has_certificate ? 'Certificate Generated' : 'Generate Certificate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Document Generated</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-green-600 mb-2" />
            <div>{successMessage}</div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSuccessDialog(false)} autoFocus>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
