"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Clock, AlertCircle, Award } from "lucide-react"

interface CompletionRequest {
  id: number
  status: 'pending' | 'approved' | 'rejected'
  total_hours_completed: number
  completion_date: string
  created_at: string
  reviewed_at?: string
  admin_notes?: string
  required_hours: number
}

interface CompletionRequestButtonProps {
  internId?: string
  onRefresh?: () => Promise<void>
}

export function CompletionRequestButton({ internId, onRefresh }: CompletionRequestButtonProps) {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [completionRequests, setCompletionRequests] = useState<CompletionRequest[]>([])

  // Only show for interns viewing their own DTR
  const isOwnDTR = user?.role === 'intern' && (!internId || String(user.id) === internId)
  
  if (!isOwnDTR) {
    return null
  }

  const fetchCompletionRequests = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/interns/completion-request', {
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

  const handleOpenDialog = () => {
    setIsOpen(true)
    fetchCompletionRequests()
  }

  const handleSubmitRequest = async () => {
    setSubmitting(true)
    try {
      const response = await fetch('/api/interns/completion-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })

      if (response.ok) {
        await fetchCompletionRequests()
        if (onRefresh) {
          await onRefresh()
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to submit completion request')
      }
    } catch (error) {
      console.error('Error submitting completion request:', error)
      alert('Failed to submit completion request')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'rejected':
        return <AlertCircle className="w-4 h-4 text-red-600" />
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

  const hasPendingRequest = completionRequests.some(req => req.status === 'pending')
  const hasApprovedRequest = completionRequests.some(req => req.status === 'approved')

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          onClick={handleOpenDialog}
          size="sm" 
          className="mt-2"
          disabled={hasApprovedRequest}
        >
          <Award className="w-4 h-4 mr-2" />
          {hasApprovedRequest ? 'Completed' : 'Request Completion'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Internship Completion Request</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="text-sm text-gray-600">
            Request completion of your internship program and receive official documentation.
          </div>

          {loading ? (
            <div className="text-center py-4">Loading requests...</div>
          ) : (
            <div className="space-y-4">
              {completionRequests.length > 0 ? (
                <div>
                  <h3 className="font-medium mb-3">Previous Requests</h3>
                  <div className="space-y-3">
                    {completionRequests.map(request => (
                      <div key={request.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(request.status)}
                            <span className="font-medium">
                              Request #{request.id}
                            </span>
                          </div>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>Hours Completed: {Number(request.total_hours_completed).toFixed(2)} / {Number(request.required_hours)}</div>
                          <div>Submitted: {new Date(request.created_at).toLocaleDateString()}</div>
                          {request.reviewed_at && (
                            <div>Reviewed: {new Date(request.reviewed_at).toLocaleDateString()}</div>
                          )}
                          {request.admin_notes && (
                            <div className="mt-2 p-2 bg-gray-50 rounded">
                              <span className="font-medium">Admin Notes:</span> {request.admin_notes}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  No completion requests found
                </div>
              )}

              {!hasPendingRequest && !hasApprovedRequest && (
                <div className="pt-4 border-t">
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm text-blue-700">
                      <strong>Ready to submit completion request?</strong>
                      <br />
                      This will notify administrators that you have completed your required hours and are ready for final approval.
                    </div>
                  </div>
                  <Button 
                    onClick={handleSubmitRequest}
                    disabled={submitting}
                    className="w-full"
                  >
                    {submitting ? 'Submitting...' : 'Submit Completion Request'}
                  </Button>
                </div>
              )}

              {hasPendingRequest && (
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <div className="text-sm text-yellow-700">
                    <strong>Request Pending</strong>
                    <br />
                    Your completion request is being reviewed by an administrator.
                  </div>
                </div>
              )}

              {hasApprovedRequest && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="text-sm text-green-700">
                    <strong>Congratulations!</strong>
                    <br />
                    Your internship has been completed and approved. Official documents will be provided by the administrator.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
