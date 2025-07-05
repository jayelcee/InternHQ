"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
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
  User,
  Calendar,
  GraduationCap
} from "lucide-react"

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
}

export function ManageCompletionRequests() {
  const { user } = useAuth()
  const [completionRequests, setCompletionRequests] = useState<CompletionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)

  // Only show for admins
  if (user?.role !== 'admin') {
    return null
  }

  const fetchCompletionRequests = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/completion-requests', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        // Ensure numeric fields are properly typed
        const formattedData = data.map((request: any) => ({
          ...request,
          total_hours_completed: Number(request.total_hours_completed) || 0,
          required_hours: Number(request.required_hours) || 0
        }))
        setCompletionRequests(formattedData)
      } else {
        console.error('Failed to fetch completion requests')
      }
    } catch (error) {
      console.error('Error fetching completion requests:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCompletionRequests()
  }, [])

  const handleProcessRequest = async (id: number, action: 'approve' | 'reject', admin_notes?: string) => {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return null
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

  const pendingRequests = completionRequests.filter(req => req.status === 'pending')
  const processedRequests = completionRequests.filter(req => req.status !== 'pending')

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Internship Completion Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Loading requests...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Pending Completion Requests ({pendingRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No pending completion requests
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map(request => (
                <CompletionRequestCard
                  key={request.id}
                  request={request}
                  onProcess={handleProcessRequest}
                  processing={processingId === request.id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Requests History */}
      <Card>
        <CardHeader>
          <CardTitle>All Completion Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {completionRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No completion requests found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Intern</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completionRequests.map(request => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{request.first_name} {request.last_name}</div>
                          <div className="text-sm text-gray-500">{request.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>{request.school_name || 'N/A'}</TableCell>
                      <TableCell>{request.department_name || 'N/A'}</TableCell>
                      <TableCell>
                        {Number(request.total_hours_completed).toFixed(1)} / {Number(request.required_hours)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(request.status)}
                          {getStatusBadge(request.status)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(request.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {request.status === 'approved' && (
                          <DocumentActions requestId={request.id} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CompletionRequestCard({ 
  request, 
  onProcess, 
  processing 
}: { 
  request: CompletionRequest
  onProcess: (id: number, action: 'approve' | 'reject', admin_notes?: string) => void
  processing: boolean
}) {
  const [adminNotes, setAdminNotes] = useState('')
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-500" />
            <span className="font-medium">{request.first_name} {request.last_name}</span>
            <span className="text-sm text-gray-500">({request.email})</span>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <GraduationCap className="w-4 h-4" />
              {request.school_name || 'N/A'}
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
            </div>
          </div>

          <div className="text-sm">
            <span className="font-medium">Hours Completed:</span> {Number(request.total_hours_completed).toFixed(1)} / {Number(request.required_hours)}
            <span className="ml-2 text-green-600">
              ({((Number(request.total_hours_completed) / Number(request.required_hours)) * 100).toFixed(1)}%)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide' : 'Details'}
          </Button>
        </div>
      </div>

      {showDetails && (
        <div className="border-t pt-4 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Department:</span> {request.department_name || 'N/A'}
            </div>
            <div>
              <span className="font-medium">Submitted:</span> {new Date(request.created_at).toLocaleDateString()}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor={`notes-${request.id}`}>Admin Notes</Label>
            <Textarea
              id={`notes-${request.id}`}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add notes for this completion request..."
              className="min-h-[80px]"
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button
          variant="outline"
          onClick={() => onProcess(request.id, 'reject', adminNotes)}
          disabled={processing}
          className="text-red-600 hover:text-red-700"
        >
          <XCircle className="w-4 h-4 mr-2" />
          Reject
        </Button>
        <Button
          onClick={() => onProcess(request.id, 'approve', adminNotes)}
          disabled={processing}
          className="bg-green-600 hover:bg-green-700"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          {processing ? 'Processing...' : 'Approve'}
        </Button>
      </div>
    </div>
  )
}

function DocumentActions({ requestId }: { requestId: number }) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [showDocumentDialog, setShowDocumentDialog] = useState(false)
  const [adminSignature, setAdminSignature] = useState('')
  const [adminTitle, setAdminTitle] = useState('')
  const [documentType, setDocumentType] = useState<'dtr' | 'certificate'>('dtr')

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
        const data = await response.json()
        alert(`${type === 'dtr' ? 'DTR' : 'Certificate'} generated successfully!`)
        setShowDocumentDialog(false)
        setAdminSignature('')
        setAdminTitle('')
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
    <Dialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="w-4 h-4 mr-2" />
          Generate Documents
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
              disabled={isGenerating}
              className="flex-1"
            >
              <FileText className="w-4 h-4 mr-2" />
              {isGenerating && documentType === 'dtr' ? 'Generating...' : 'Generate DTR'}
            </Button>
            <Button
              onClick={() => generateDocument('certificate')}
              disabled={isGenerating}
              className="flex-1"
            >
              <Award className="w-4 h-4 mr-2" />
              {isGenerating && documentType === 'certificate' ? 'Generating...' : 'Generate Certificate'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
