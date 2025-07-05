"use client"

import { useState, useEffect } from "react"
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
import { TimeLogDisplay, groupLogsByDate, formatLogDate, sortGroupedLogsByDate } from "@/lib/ui-utils"
import { processTimeLogSessions, getTimeBadgeProps } from "@/lib/session-utils"
import { filterLogsByInternId, calculateAccurateSessionDuration, formatAccurateHours, calculateRawSessionDuration, extractDateString, truncateTo2Decimals } from "@/lib/time-utils"

// Helper function to safely parse date and time strings
function parseDateTime(dateStr: string, timeStr: string): Date {
  try {
    // Handle different date formats
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date')
    }
    
    // Parse time string (e.g., "9:00 AM" or "9:00am")
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i)
    if (!timeMatch) {
      throw new Error('Invalid time format')
    }
    
    let hours = parseInt(timeMatch[1], 10)
    const minutes = parseInt(timeMatch[2], 10)
    const ampm = timeMatch[3].toUpperCase()
    
    // Convert to 24-hour format
    if (ampm === 'PM' && hours !== 12) {
      hours += 12
    } else if (ampm === 'AM' && hours === 12) {
      hours = 0
    }
    
    // Create new date with the parsed time
    const result = new Date(date)
    result.setHours(hours, minutes, 0, 0)
    
    return result
  } catch (error) {
    console.error('Error parsing date/time:', { dateStr, timeStr, error })
    // Return current date as fallback
    return new Date()
  }
}

interface CompletionRequest {
  id: number
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_at?: string
  admin_notes?: string
  total_hours_completed: number
  required_hours: number
}

interface GeneratedDocument {
  id: number
  type: 'dtr' | 'certificate'
  document_path: string
  created_at: string
  admin_signature_name: string
  admin_title: string
  document_number: string
  content: any
}

export function InternshipCompletion() {
  const { user } = useAuth()
  const [completionRequest, setCompletionRequest] = useState<CompletionRequest | null>(null)
  const [documents, setDocuments] = useState<GeneratedDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [timeStats, setTimeStats] = useState({
    internshipProgress: 0,
    progressPercentage: 0,
    isCompleted: false
  })

  useEffect(() => {
    fetchCompletionStatus()
    fetchTimeStats()
  }, [])

  const fetchCompletionStatus = async () => {
    try {
      const response = await fetch('/api/intern/completion-status', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('Completion status data:', data)
        console.log('Documents:', data.documents)
        if (data.documents && data.documents.length > 0) {
          console.log('First document content:', data.documents[0].content)
          if (data.documents[0].content && data.documents[0].content.timeLogsDetails) {
            console.log('Time logs details:', data.documents[0].content.timeLogsDetails)
          }
        }
        setCompletionRequest(data.request)
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Error fetching completion status:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTimeStats = async () => {
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
  }

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
        alert('Completion request submitted successfully!')
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

      // Generate HTML content using the same sophisticated functions as DocumentViewer
      const htmlContent = type === 'dtr' 
        ? generateDTRHTML(documentData.content)
        : generateCertificateHTML(documentData.content)

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
        const aspectRatio = contentWidth / contentHeight
        
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
        
        for (const [key, size] of Object.entries(paperSizes)) {
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
        
        console.log(`Using ${bestSize.name} paper size for ${type} document`)

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
          ? `DTR-${documentData.document_number}-${bestSize.name}.pdf`
          : `Certificate-${documentData.document_number}-${bestSize.name}.pdf`
        
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

  // Helper functions to generate HTML content (same as DocumentViewer)
  const generateDTRHTML = (content: any): string => {
    const completedHours = Math.min(content.totalHours, content.requiredHours)
    const progressPercentage = (completedHours / content.requiredHours) * 100
    
    // Transform timeLogsDetails to TimeLogDisplay format for session processing
    const transformedLogs: TimeLogDisplay[] = content.timeLogsDetails.map((log: any, index: number) => {
      // Parse the AM/PM time format and convert to ISO string for calculations
      const timeInDate = parseDateTime(log.date, log.timeIn)
      const timeOutDate = parseDateTime(log.date, log.timeOut)
      
      return {
        id: index + 1, // Generate an ID
        time_in: timeInDate.toISOString(), // ISO string for calculations
        time_out: timeOutDate.toISOString(), // ISO string for calculations
        log_type: log.logType as "regular" | "overtime",
        status: log.status as "pending" | "completed",
        overtime_status: log.overtimeStatus as "pending" | "approved" | "rejected" | undefined,
        user_id: 1, // Default user ID
        internId: 1 // Default intern ID
      }
    })

    // Calculate accurate hours summary from time logs
    const calculateHoursSummary = () => {
      let totalRegularHours = 0
      let totalApprovedOvertimeHours = 0
      
      try {
        // Process each log entry directly without complex session processing
        content.timeLogsDetails.forEach((log: any) => {
          // Parse times
          const timeIn = parseDateTime(log.date, log.timeIn)
          const timeOut = parseDateTime(log.date, log.timeOut)
          
          // Calculate duration in hours
          const durationMs = timeOut.getTime() - timeIn.getTime()
          const durationHours = durationMs / (1000 * 60 * 60)
          
          if (log.logType === "regular") {
            // Add all regular hours directly
            totalRegularHours += durationHours
          } else if (log.logType === "overtime" && log.overtimeStatus === "approved") {
            // Only add approved overtime hours
            totalApprovedOvertimeHours += durationHours
          }
          // Skip rejected or pending overtime
        })
      } catch (error) {
        console.error('Error calculating hours summary:', error)
        // Fallback to content values if calculation fails
        return {
          regularHours: content.regularHours,
          approvedOvertimeHours: content.overtimeHours,
          totalHoursRendered: content.totalHours
        }
      }
      
      // Format final values with proper decimal precision
      const regularHoursFormatted = Number(truncateTo2Decimals(totalRegularHours))
      const approvedOvertimeHoursFormatted = Number(truncateTo2Decimals(totalApprovedOvertimeHours))
      const totalRendered = Number(truncateTo2Decimals(regularHoursFormatted + approvedOvertimeHoursFormatted))
      
      return {
        regularHours: regularHoursFormatted,
        approvedOvertimeHours: approvedOvertimeHoursFormatted,
        totalHoursRendered: totalRendered
      }
    }

    const hoursSummary = calculateHoursSummary()
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Official Daily Time Record</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background-color: #f9f9f9; }
          .container { max-width: 1200px; margin: 0 auto; }
          .card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 24px; }
          .card-header { padding: 16px 24px; border-bottom: 1px solid #e5e7eb; }
          .card-content { padding: 24px; }
          .card-title { font-size: 18px; font-weight: 600; margin: 0; display: flex; align-items: center; }
          .grid { display: grid; gap: 16px; }
          .grid-2 { grid-template-columns: 1fr 1fr; }
          .grid-4 { grid-template-columns: repeat(4, 1fr); }
          .progress-bar { width: 100%; height: 8px; background-color: #e5e7eb; border-radius: 4px; margin: 8px 0 24px 0; }
          .progress-fill { height: 100%; background-color: #2563eb; border-radius: 4px; transition: width 0.3s ease; }
          .badge { display: inline-flex; align-items: center; justify-content: center; border-radius: 9999px; padding: 4px 10px; font-size: 12px; font-weight: 600; white-space: nowrap; width: fit-content; min-width: auto; }
          .badge-complete { background-color: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
          .badge-progress { background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
          .badge-regular { background-color: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
          .badge-overtime { background-color: #fed7aa; color: #c2410c; border: 1px solid #fdba74; }
          .badge-overtime-approved { background-color: #e9d5ff; color: #7c3aed; border: 1px solid #ddd6fe; }
          .badge-overtime-pending { background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
          .badge-gray { background-color: #f3f4f6; color: #6b7280; border: 1px solid #e5e7eb; }
          .badge-green { background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
          .badge-red { background-color: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
          .badge-yellow { background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
          .table { width: 100%; border-collapse: collapse; }
          .table th { background-color: #f9fafb; padding: 12px 24px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; }
          .table td { padding: 16px 24px; border-bottom: 1px solid #e5e7eb; }
          .table tr:hover { background-color: #f9fafb; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-medium { font-weight: 500; }
          .font-bold { font-weight: 700; }
          .text-gray-600 { color: #6b7280; }
          .text-blue-600 { color: #2563eb; }
          .text-green-600 { color: #16a34a; }
          .text-orange-600 { color: #ea580c; }
          .text-purple-600 { color: #9333ea; }
          .signature-line { border-bottom: 2px solid #6b7280; width: 256px; margin: 0 auto; }
          .mt-4 { margin-top: 16px; }
          .mb-4 { margin-bottom: 16px; }
          .mb-2 { margin-bottom: 8px; }
          .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
          .stat-card { text-align: center; }
          .stat-value { font-size: 32px; font-weight: 700; }
          .stat-label { font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="grid grid-2">
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">🎓 Intern Information</h3>
              </div>
              <div class="card-content">
                <div class="grid grid-2" style="margin-bottom: 16px;">
                  <div>
                    <span class="font-medium">Name:</span>
                    <div class="text-gray-600">${content.internName}</div>
                  </div>
                  <div>
                    <span class="font-medium">University:</span>
                    <div class="text-gray-600">${content.school}</div>
                  </div>
                </div>
                <div>
                  <span class="font-medium">Assigned Department:</span>
                  <div class="text-gray-600">${content.department}</div>
                </div>
              </div>
            </div>
            
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">📈 Internship Progress</h3>
              </div>
              <div class="card-content">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span class="font-medium">Completed</span>
                  <span class="font-medium">
                    ${completedHours.toFixed(2)}h / ${content.requiredHours}h
                    ${content.totalHours > content.requiredHours ? 
                      `<span style="color: #d97706; margin-left: 8px; font-size: 14px;">
                        (+${(content.totalHours - content.requiredHours).toFixed(2)}h overtime)
                      </span>` : ''
                    }
                  </span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${Math.min(progressPercentage, 100)}%;"></div>
                </div>
                <div style="display: flex; gap: 32px; margin-top: 8px;">
                  <div>
                    <div class="font-medium">Internship Duration:</div>
                    <div class="text-gray-600">
                      ${new Date(content.periodStart).toLocaleDateString()} - ${new Date(content.periodEnd).toLocaleDateString()}
                    </div>
                  </div>
                  <div style="margin-left: auto; text-align: center;">
                    <div class="badge ${progressPercentage >= 100 ? 'badge-complete' : 'badge-progress'}">
                      ${progressPercentage >= 100 ? 'Complete' : 'In Progress'}
                    </div>
                    <div style="font-size: 24px; font-weight: 700; color: #2563eb; margin-top: 4px;">
                      ${progressPercentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Daily Time Record</h3>
              <p style="font-size: 14px; color: #6b7280; margin: 4px 0 0 0;">
                Document No: ${content.documentNumber} • Showing ${content.timeLogsDetails?.length || 0} time records
              </p>
            </div>
            <div style="overflow-x: auto;">
              <table class="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time In</th>
                    <th>Time Out</th>
                    <th>Regular Shift</th>
                    <th>Overtime</th>
                  </tr>
                </thead>
                <tbody>
                  ${(() => {
                    try {
                      // Process logs using the same session processing as daily-time-record
                      const groupedLogs = groupLogsByDate(transformedLogs)
                      
                      return sortGroupedLogsByDate(groupedLogs, "asc")
                        .map(([key, logsForDate]) => {
                          const datePart = key.split("-").slice(-3).join("-")
                          
                          // Use centralized session processing
                          const { sessions } = processTimeLogSessions(logsForDate)
                          
                          return `
                            <tr>
                              <td class="font-medium">
                                <div style="display: flex; flex-direction: column; align-items: flex-start;">
                                  <span style="font-size: 12px; color: #6b7280;">
                                    ${new Date(datePart).toLocaleDateString("en-US", { weekday: "short" })}
                                  </span>
                                  <span>${new Date(datePart).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })}</span>
                                </div>
                              </td>
                              
                              <td>
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                  ${sessions.map((session, i) => {
                                    if (!session.timeIn) return ''
                                    const badgeProps = getTimeBadgeProps(
                                      session.timeIn,
                                      session.sessionType,
                                      "in",
                                      session.overtimeStatus === "none" ? undefined : session.overtimeStatus,
                                      session.isContinuousSession
                                    )
                                    // Map the badge class names to our PDF CSS classes
                                    const cssClass = mapBadgeClassToPDF(badgeProps.className)
                                    return `<span class="badge ${cssClass}">${badgeProps.text}</span>`
                                  }).join('')}
                                </div>
                              </td>
                              
                              <td>
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                  ${sessions.map((session, i) => {
                                    const badgeProps = session.isActive
                                      ? getTimeBadgeProps(null, session.sessionType, "active")
                                      : getTimeBadgeProps(
                                          session.timeOut,
                                          session.sessionType,
                                          "out",
                                          session.overtimeStatus === "none" ? undefined : session.overtimeStatus,
                                          session.isContinuousSession
                                        )
                                    // Map the badge class names to our PDF CSS classes
                                    const cssClass = mapBadgeClassToPDF(badgeProps.className)
                                    return `<span class="badge ${cssClass}">${badgeProps.text}</span>`
                                  }).join('')}
                                </div>
                              </td>
                              
                              <td>
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                  ${(() => {
                                    let previousRegularHours = 0
                                    return sessions.map((session, i) => {
                                      const accurateCalc = calculateAccurateSessionDuration(
                                        session.logs,
                                        new Date(),
                                        previousRegularHours
                                      )
                                      
                                      const displayText = formatAccurateHours(accurateCalc.regularHours)
                                      const className = accurateCalc.regularHours > 0 ? 'badge-regular' : 'badge-gray'
                                      
                                      previousRegularHours += accurateCalc.regularHours
                                      
                                      return `<span class="badge ${className}">${displayText}</span>`
                                    }).join('')
                                  })()}
                                </div>
                              </td>
                              
                              <td>
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                  ${(() => {
                                    let previousRegularHours = 0
                                    return sessions.map((session, i) => {
                                      const rawCalc = calculateRawSessionDuration(
                                        session.logs,
                                        new Date(),
                                        previousRegularHours
                                      )
                                      
                                      const displayText = formatAccurateHours(rawCalc.overtimeHours)
                                      let className = 'badge-gray'
                                      if (rawCalc.overtimeHours > 0) {
                                        className = rawCalc.overtimeStatus === "approved" ? 'badge-overtime-approved' :
                                                   rawCalc.overtimeStatus === "rejected" ? 'badge-gray' :
                                                   'badge-overtime-pending'
                                      }
                                      
                                      previousRegularHours += rawCalc.regularHours
                                      
                                      return `<span class="badge ${className}">${displayText}</span>`
                                    }).join('')
                                  })()}
                                </div>
                              </td>
                            </tr>
                          `
                        }).join('')
                    } catch (error) {
                      console.error('Error processing sessions:', error)
                      // Fallback: show raw data if grouping fails
                      return content.timeLogsDetails?.map((log: any, index: number) => {
                        return `
                          <tr>
                            <td class="font-medium">
                              ${new Date(log.date).toLocaleDateString()}
                            </td>
                            <td><span class="badge badge-green">${log.timeIn}</span></td>
                            <td><span class="badge badge-red">${log.timeOut}</span></td>
                            <td><span class="badge ${log.logType === 'regular' ? 'badge-regular' : 'badge-gray'}">${log.logType === 'regular' ? '8h' : '0h'}</span></td>
                            <td><span class="badge ${log.logType === 'overtime' ? 'badge-overtime-approved' : 'badge-gray'}">${log.logType === 'overtime' ? '2h' : '0h'}</span></td>
                          </tr>
                        `
                      }).join('') || '<tr><td colspan="5" class="text-center">No records found</td></tr>'
                    }
                  })()}
                </tbody>
              </table>
            </div>
          </div>
          
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Hours Summary</h3>
            </div>
            <div class="card-content">
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-value text-blue-600">${hoursSummary.regularHours.toFixed(2)}</div>
                  <div class="stat-label">Regular Hours</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value text-purple-600">${hoursSummary.approvedOvertimeHours.toFixed(2)}</div>
                  <div class="stat-label">Approved Overtime</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value text-green-600">${hoursSummary.totalHoursRendered.toFixed(2)}</div>
                  <div class="stat-label">Total Hours Rendered</div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Official Verification</h3>
            </div>
            <div class="card-content">
              <div class="text-center">
                <p class="text-gray-600 mb-4">This document has been officially verified and approved by:</p>
                <div class="signature-line mb-2"></div>
                <p class="font-medium" style="font-size: 18px;">${content.adminSignature}</p>
                <p class="text-gray-600">${content.adminTitle}</p>
                <p class="text-gray-600 mt-4">
                  Date Issued: ${new Date(content.issueDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }

  const generateCertificateHTML = (content: any): string => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Certificate of Completion</title>
        <style>
          body { font-family: Georgia, serif; margin: 20px; text-align: center; background-color: white; }
          .certificate { border: 5px solid #000; padding: 40px; margin: 20px; background-color: white; }
          .header { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
          .title { font-size: 32px; font-weight: bold; color: #000080; margin-bottom: 30px; }
          .content { font-size: 18px; line-height: 1.6; margin-bottom: 30px; }
          .intern-name { font-size: 28px; font-weight: bold; color: #000080; margin: 20px 0; }
          .details { font-size: 16px; margin-bottom: 20px; }
          .signature-section { margin-top: 50px; }
          .signature-line { border-bottom: 2px solid #000; width: 300px; margin: 0 auto; }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="header">InternHQ</div>
          <div class="title">CERTIFICATE OF COMPLETION</div>
          <div class="content">
            This is to certify that
            <div class="intern-name">${content.internName}</div>
            has successfully completed the internship program at<br>
            <strong>${content.department}</strong><br>
            from <strong>${new Date(content.periodStart).toLocaleDateString()}</strong> 
            to <strong>${new Date(content.periodEnd).toLocaleDateString()}</strong>
          </div>
          
          <div class="details">
            <p><strong>Total Hours Completed:</strong> ${content.totalHoursCompleted?.toFixed(2) || '0.00'} hours</p>
            <p><strong>Required Hours:</strong> ${content.requiredHours || 0} hours</p>
            <p><strong>Institution:</strong> ${content.school}</p>
            <p><strong>Completion Date:</strong> ${new Date(content.completionDate).toLocaleDateString()}</p>
          </div>
          
          <div class="signature-section">
            <p><strong>Issued by:</strong></p>
            <div class="signature-line" style="margin: 20px auto;"></div>
            <p style="margin-top: 10px;">
              <strong>${content.adminSignature}</strong><br>
              ${content.adminTitle}
            </p>
            <p style="margin-top: 30px;">
              Certificate No: ${content.certificateNumber}<br>
              Date Issued: ${content.issueDate}
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  // Helper function to map badge class names from the session utils to PDF CSS classes
  const mapBadgeClassToPDF = (className: string): string => {
    if (className.includes('bg-green-100')) return 'badge-green'
    if (className.includes('bg-red-100')) return 'badge-red'
    if (className.includes('bg-yellow-100')) return 'badge-yellow'
    if (className.includes('bg-purple-100')) return 'badge-overtime-approved'
    if (className.includes('bg-gray-100')) return 'badge-gray'
    return 'badge-gray' // fallback
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const canRequestCompletion = timeStats.progressPercentage >= 100 && !completionRequest
  const hasApprovedRequest = completionRequest?.status === 'approved'
  const dtrDocument = documents.find(doc => doc.type === 'dtr')
  const certificateDocument = documents.find(doc => doc.type === 'certificate')

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            Internship Completion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Internship Progress</span>
              <span className="text-2xl font-bold text-blue-600">
                {timeStats.progressPercentage.toFixed(1)}%
              </span>
            </div>
            
            <Progress value={timeStats.progressPercentage} className="h-3" />
            
            <div className="flex justify-between text-sm text-gray-600">
              <span>
                {timeStats.internshipProgress.toFixed(1)}h completed
              </span>
              <span>
                {user?.internship?.required_hours || 0}h required
              </span>
            </div>

            {timeStats.progressPercentage >= 100 && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span className="font-medium">Requirements completed!</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Completion Request Status */}
      {completionRequest && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(completionRequest.status)}
              Completion Request Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Status:</span>
                {getStatusBadge(completionRequest.status)}
              </div>
              
              <div className="flex items-center justify-between">
                <span>Submitted:</span>
                <span>{new Date(completionRequest.created_at).toLocaleDateString()}</span>
              </div>

              {completionRequest.reviewed_at && (
                <div className="flex items-center justify-between">
                  <span>Reviewed:</span>
                  <span>{new Date(completionRequest.reviewed_at).toLocaleDateString()}</span>
                </div>
              )}

              {completionRequest.admin_notes && (
                <div className="space-y-2">
                  <span className="font-medium">Admin Notes:</span>
                  <div className="bg-gray-50 p-3 rounded-lg text-sm">
                    {completionRequest.admin_notes}
                  </div>
                </div>
              )}

              <div className="text-sm text-gray-600">
                <span className="font-medium">Hours Completed:</span> {(parseFloat(String(completionRequest.total_hours_completed)) || 0).toFixed(1)}h
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Request Completion Button */}
      {canRequestCompletion && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Request Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span>You have completed all required hours!</span>
              </div>
              
              <p className="text-sm text-gray-600">
                Submit a completion request to have your internship reviewed and approved by an administrator.
              </p>

              <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogTrigger asChild>
                  <Button className="w-full">
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
                        <p>Hours Completed: {timeStats.internshipProgress.toFixed(1)}h</p>
                        <p>Required Hours: {user?.internship?.required_hours || 0}h</p>
                        <p>Progress: {timeStats.progressPercentage.toFixed(1)}%</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">
                      Once submitted, an administrator will review your request. You will be notified of the decision.
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
      )}

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
                  <p>Documents are being generated...</p>
                  <p className="text-sm">Please check back later or contact your administrator.</p>
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
                        <p>Generated: {new Date(dtrDocument.created_at).toLocaleDateString()}</p>
                        <p>Signed by: {dtrDocument.admin_signature_name}</p>
                      </div>
                      <div className="flex gap-2">
                        <DocumentViewer 
                          type="dtr" 
                          dtrContent={dtrDocument.content}
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
                        <p>Generated: {new Date(certificateDocument.created_at).toLocaleDateString()}</p>
                        <p>Signed by: {certificateDocument.admin_signature_name}</p>
                      </div>
                      <div className="flex gap-2">
                        <DocumentViewer 
                          type="certificate" 
                          certificateContent={certificateDocument.content}
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

      {/* Progress Not Complete */}
      {!canRequestCompletion && !completionRequest && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Complete Your Internship
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 space-y-4">
              <div className="text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Continue working to complete your internship requirements.</p>
                <p className="text-sm">
                  You need {((user?.internship?.required_hours || 0) - timeStats.internshipProgress).toFixed(1)} more hours.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
