/**
 * Internship completion component for intern dashboard
 * Shows completion progress, allows submission of requests, and displays approved documents
 */
"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Award,
  FileText,
  Download,
  Send,
  AlertCircle
} from "lucide-react"
import { DocumentViewer } from "@/components/document-viewer"
import { calculateTimeStatistics } from "@/lib/time-utils"
import { DocumentGenerationService } from "@/lib/document-generation-service"

interface CompletionRequest {
  id: number
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_at?: string
  admin_notes?: string
  total_hours_completed: number
  required_hours: number
}

interface TimeLogEntry {
  date: string
  timeIn: string
  timeOut: string
  logType: "regular" | "overtime" | "extended_overtime"
  status: string
  overtimeStatus: string | null
}

interface DTRDocumentContent {
  documentNumber: string
  internName: string
  school: string
  department: string
  periodStart: string
  periodEnd: string
  totalHours: number
  regularHours: number
  overtimeHours: number
  requiredHours: number
  timeLogsDetails: {
    date: string
    timeIn: string
    timeOut: string
    logType: "regular" | "overtime" | "extended_overtime"
    status: string
    overtimeStatus: string | null
  }[]
  adminSignature: string
  adminTitle: string
  issueDate: string
  documentId: number
  [key: string]: unknown
}

interface CertificateDocumentContent {
  certificateNumber: string
  internName: string
  degree: string
  school: string
  department: string
  periodStart: string
  periodEnd: string
  completionDate: string
  totalHoursCompleted: number
  requiredHours: number
  adminSignature: string
  adminTitle: string
  issueDate: string
  certificateId: number
  [key: string]: unknown
}

interface GeneratedDocument {
  id: number
  type: 'dtr' | 'certificate'
  document_path: string
  created_at: string
  admin_signature_name: string
  admin_title: string
  document_number: string
  content: DTRDocumentContent | CertificateDocumentContent
}

export function InternshipCompletion() {
  const { user } = useAuth()
  const [completionRequest, setCompletionRequest] = useState<CompletionRequest | null>(null)
  const [documents, setDocuments] = useState<GeneratedDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [timeStats, setTimeStats] = useState({
    internshipProgress: 0,
    progressPercentage: 0,
    isCompleted: false
  })

  const fetchCompletionStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/intern/completion-status', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setCompletionRequest(data.request)
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Error fetching completion status:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTimeStats = useCallback(async () => {
    try {
      const response = await fetch('/api/time-logs', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        const logs = Array.isArray(data) ? data : data.logs || []
        
        const stats = await calculateTimeStatistics(logs, user?.id, {
          includeEditRequests: true,
          requiredHours: user?.internship?.required_hours || 0
        })
        
        setTimeStats(stats)
      }
    } catch (error) {
      console.error('Error fetching time stats:', error)
    }
  }, [user?.id, user?.internship?.required_hours])

  useEffect(() => {
    const loadData = async () => {
      await fetchCompletionStatus()
      await fetchTimeStats()
    }
    loadData()
  }, [fetchCompletionStatus, fetchTimeStats]) // Include both functions in dependency array

  const submitCompletionRequest = async () => {
    setSubmitting(true)
    try {
      const response = await fetch('/api/intern/completion-request', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setCompletionRequest(data.request)
        setShowConfirmDialog(false)
        setShowSuccessDialog(true)
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
        return <Clock className="w-5 h-5 text-yellow-600" />
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Pending Review</Badge>
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Approved</Badge>
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 border-red-300">Rejected</Badge>
      default:
        return null
    }
  }

  const downloadDocument = async (documentId: number, type: 'dtr' | 'certificate') => {
    try {
      // Import libraries dynamically
      const html2canvas = (await import('html2canvas')).default
      const jsPDFModule = await import('jspdf')
      const jsPDF = jsPDFModule.default
      
      // Find the document content
      const documentData = documents.find(doc => doc.id === documentId && doc.type === type)
      if (!documentData) {
        alert('Document not found')
        return
      }

      // Generate HTML content using the optimized service
      const htmlContent = type === 'dtr' 
        ? DocumentGenerationService.generateDTRHTML(documentData.content as DTRDocumentContent & { timeLogsDetails: TimeLogEntry[] })
        : DocumentGenerationService.generateCertificateHTML(documentData.content as CertificateDocumentContent)

      // Create an invisible iframe to render the HTML content
      const iframe = document.createElement('iframe')
      iframe.style.position = 'absolute'
      iframe.style.left = '-9999px'
      iframe.style.top = '-9999px'
      iframe.style.width = '1200px'
      iframe.style.height = '800px'
      iframe.style.border = 'none'
      document.body.appendChild(iframe)

      // Write content to iframe
      iframe.contentDocument?.open()
      iframe.contentDocument?.write(htmlContent)
      iframe.contentDocument?.close()

      // Wait for content to load
      await new Promise(resolve => {
        iframe.onload = resolve
        // Fallback timeout
        setTimeout(resolve, 2000)
      })

      try {
        // Convert HTML to canvas using the iframe's document body
        const canvas = await html2canvas(iframe.contentDocument!.body, {
          width: 1200,
          height: iframe.contentDocument!.body.scrollHeight,
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          foreignObjectRendering: true
        })

        // Auto-calculate optimal paper size based on content
        const contentWidth = canvas.width
        const contentHeight = canvas.height
        
        // Define paper size options (all in mm)
        const paperSizes = {
          'a4': { width: 210, height: 297, name: 'A4' },
          'a3': { width: 297, height: 420, name: 'A3' },
          'tabloid': { width: 279, height: 432, name: 'Tabloid' }, // 11x17
          'legal': { width: 216, height: 356, name: 'Legal' }, // 8.5x14
          'letter': { width: 216, height: 279, name: 'Letter' } // 8.5x11
        }
        
        // Calculate which paper size would work best
        let bestSize = paperSizes.a4
        let bestFit = 0
        
        for (const [, size] of Object.entries(paperSizes)) {
          // Calculate how well the content fits (prioritize fitting width)
          const widthRatio = size.width / (contentWidth / 3.78) // Convert pixels to mm roughly
          const heightRatio = size.height / (contentHeight / 3.78)
          const minRatio = Math.min(widthRatio, heightRatio)
          
          // Prefer sizes that can fit the content without too much scaling
          if (minRatio > bestFit && minRatio >= 0.8) {
            bestFit = minRatio
            bestSize = size
          }
        }
        
        // Use Tabloid for DTR (more data) and A4 for Certificate by default
        if (type === 'dtr' && bestSize.name === 'A4') {
          bestSize = paperSizes.tabloid
        }

        // Create PDF with optimal paper size
        const pdf = new jsPDF({
          orientation: bestSize.width > bestSize.height ? 'landscape' : 'portrait',
          unit: 'mm',
          format: [bestSize.width, bestSize.height]
        })

        const imgData = canvas.toDataURL('image/png')
        const imgWidth = bestSize.width
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        const pageHeight = bestSize.height
        
        let heightLeft = imgHeight
        let position = 0

        // Add first page
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight

        // Add additional pages if needed
        while (heightLeft >= 0) {
          position = heightLeft - imgHeight
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
          heightLeft -= pageHeight
        }

        // Download the PDF
        const fileName = type === 'dtr' 
          ? `${documentData.document_number}.pdf`
          : `${documentData.document_number}.pdf`
        
        pdf.save(fileName)
        
      } finally {
        // Clean up the invisible iframe
        document.body.removeChild(iframe)
      }
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const hasApprovedRequest = completionRequest?.status === 'approved'
  const dtrDocument = documents.find(doc => doc.type === 'dtr')
  const certificateDocument = documents.find(doc => doc.type === 'certificate')

  return (
    <div className="space-y-6">
      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completion request submitted successfully!</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-green-600 mb-2" />
            <div>Your completion request has been submitted and is awaiting review by the HR Manager.</div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSuccessDialog(false)} autoFocus>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Progress Overview + Completion Request Status/Request/Encouragement side by side */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Progress Overview (always left) */}
        <div className="flex-1 flex">
          <Card className="w-full flex flex-col h-full flex-grow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5" />
                Internship Completion
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Internship Progress</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {timeStats.progressPercentage.toFixed(1)}%
                  </span>
                </div>
                <Progress value={timeStats.progressPercentage} className="h-3" />
                <div className="flex justify-between font-medium text-gray-600">
                  <span>
                    {timeStats.internshipProgress.toFixed(2)}h completed
                  </span>
                  <span>
                    {user?.internship?.required_hours || 0}h required
                  </span>
                </div>
                {timeStats.progressPercentage >= 100 ? (
                  <Badge className="bg-green-100 text-green-800 border-green-300 mt-6 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium">Required hours reached!</span>
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800 border-red-300 mt-6 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    <span className="font-medium">Render more time to complete.</span>
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Right card: status/request/encouragement */}
        <div className="flex-1 flex">
          {completionRequest ? (
            <Card className="w-full flex flex-col h-full flex-grow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getStatusIcon(completionRequest.status)}
                  Completion Request Status
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Status:</span>
                    {getStatusBadge(completionRequest.status)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Submitted:</span>
                    <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-medium rounded-md">
                      {new Date(completionRequest.created_at).toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Badge>
                  </div>
                  {completionRequest.reviewed_at && (
                    <div className="flex items-center justify-between">
                      <span>Reviewed:</span>
                      <Badge className="bg-green-100 text-green-800 border-green-300 font-medium rounded-md">
                        {new Date(completionRequest.reviewed_at).toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </Badge>
                    </div>
                  )}
                  {completionRequest.admin_notes && (
                    <div className="flex items-center justify-between">
                      <span>Admin Note:</span>
                      <Badge className="bg-gray-100 text-gray-800 border-gray-300 font-medium rounded-md max-w-xs whitespace-pre-line break-words">
                        {completionRequest.admin_notes}
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Hours Completed:</span>
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-bold rounded-md">
                      {(parseFloat(String(completionRequest.total_hours_completed)) || 0).toFixed(2)}h
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : timeStats.progressPercentage >= 100 ? (
            <Card className="w-full flex flex-col h-full flex-grow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  Request Completion
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                    <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span>You have completed all required hours!</span>
                    </div>
                  <p className="text-sm text-center text-gray-600">
                    Submit a completion request to have your internship reviewed and approved by the HR Manager. Once approved, you will receive your official Daily Time Record (DTR) and Certificate of Completion.
                  </p>
                  <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                    <DialogTrigger asChild>
                      <Button className="w-full mt-4">
                        <Send className="w-4 h-4 mr-2" />
                        Submit Completion Request
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Confirm Completion Request</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to submit your internship completion request?
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <div className="flex items-center gap-2 text-blue-800">
                            <AlertCircle className="w-4 h-4" />
                            <span className="font-medium">Summary</span>
                          </div>
                          <div className="mt-2 text-sm text-blue-700">
                            <p>Hours Completed: {timeStats.internshipProgress.toFixed(2)}h</p>
                            <p>Required Hours: {user?.internship?.required_hours || 0}h</p>
                            <p>Progress: {timeStats.progressPercentage.toFixed(0)}%</p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">
                          Once submitted, the HR Manager will review your request. You will see the real-time status and official internship completion documents here.
                        </p>
                      </div>
                      <DialogFooter>
                        <Button 
                          variant="outline" 
                          onClick={() => setShowConfirmDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={submitCompletionRequest}
                          disabled={submitting}
                        >
                          {submitting ? 'Submitting...' : 'Submit Request'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="w-full flex flex-col h-full flex-grow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Complete Your Internship
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center">
                <div className="text-center py-4 space-y-4">
                  <div className="text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Continue working to complete your internship requirements.</p>
                    <p className="text-sm mb-2">
                      You need {((user?.internship?.required_hours || 0) - timeStats.internshipProgress).toFixed(1)} more hours.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      {/* Generated Documents */}
      {hasApprovedRequest && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Official Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {documents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No documents have been generated yet.</p>
                  <p className="text-sm">Please check back later or contact your manager.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {/* DTR Document */}
                  {dtrDocument && (
                    <div className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <h3 className="font-medium">Daily Time Record</h3>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>Document No: {dtrDocument.document_number}</p>
                        <p>Generated: {new Date(dtrDocument.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        <p>Signed by: {dtrDocument.admin_signature_name}</p>
                      </div>
                      <div className="flex gap-2">
                        <DocumentViewer 
                          type="dtr" 

                          dtrContent={dtrDocument.content as DTRDocumentContent}
                        />
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => downloadDocument(dtrDocument.id, 'dtr')}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download PDF
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Certificate Document */}
                  {certificateDocument && (
                    <div className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-green-600" />
                        <h3 className="font-medium">Certificate of Completion</h3>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>Certificate No: {certificateDocument.document_number}</p>
                        <p>Generated: {new Date(certificateDocument.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        <p>Signed by: {certificateDocument.admin_signature_name}</p>
                      </div>
                      <div className="flex gap-2">
                        <DocumentViewer 
                          type="certificate" 

                          certificateContent={certificateDocument.content as CertificateDocumentContent}
                        />
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => downloadDocument(certificateDocument.id, 'certificate')}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download PDF
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
