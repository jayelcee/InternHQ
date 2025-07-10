/**
 * DocumentViewer Component
 * 
 * Displays and generates PDF for Daily Time Record (DTR) and Certificate documents.
 * - Handles PDF generation and formatting for both DTR and Certificate.
 * - Renders previews in dialogs.
 * - Uses centralized time/session processing for accurate reporting.
 * 
 * Props:
 *   - dtrContent?: DTRContent
 *   - certificateContent?: CertificateContent
 *   - type: 'dtr' | 'certificate'
 */

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Download, FileText, Award } from "lucide-react"
import { TimeLogDisplay, groupLogsByDate, formatLogDate, sortGroupedLogsByDate } from "@/lib/ui-utils"
import { processTimeLogSessions, getTimeBadgeProps } from "@/lib/session-utils"
import { calculateAccurateSessionDuration, formatAccurateHours, calculateRawSessionDuration, truncateTo2Decimals } from "@/lib/time-utils"

/**
 * Safely parse date and time strings into a Date object
 */
function parseDateTime(dateStr: string, timeStr: string): Date {
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date')
    }
    
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i)
    if (!timeMatch) {
      throw new Error('Invalid time format')
    }
    
    let hours = parseInt(timeMatch[1], 10)
    const minutes = parseInt(timeMatch[2], 10)
    const ampm = timeMatch[3].toUpperCase()
    
    if (ampm === 'PM' && hours !== 12) {
      hours += 12
    } else if (ampm === 'AM' && hours === 12) {
      hours = 0
    }
    
    const result = new Date(date)
    result.setHours(hours, minutes, 0, 0)
    
    return result
  } catch (error) {
    console.error('Error parsing date/time:', { dateStr, timeStr, error })
    return new Date()
  }
}

interface DTRContent {
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
}

interface CertificateContent {
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
}

interface DocumentViewerProps {
  dtrContent?: DTRContent
  certificateContent?: CertificateContent
  type: 'dtr' | 'certificate'
}

// Helper function to map badge class names to PDF CSS classes
const mapBadgeClassToPDF = (className: string): string => {
  if (className.includes('bg-green-100')) return 'badge-green'
  if (className.includes('bg-red-100')) return 'badge-red'
  if (className.includes('bg-yellow-100')) return 'badge-yellow'
  if (className.includes('bg-purple-100')) return 'badge-overtime-approved'
  if (className.includes('bg-gray-100')) return 'badge-gray'
  return 'badge-gray' // fallback
}

export function DocumentViewer({ dtrContent, certificateContent, type }: DocumentViewerProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleDownload = async () => {
    const content = type === 'dtr' ? dtrContent : certificateContent
    if (!content) return

    try {
      // Import libraries dynamically
      const html2canvas = (await import('html2canvas')).default
      const jsPDFModule = await import('jspdf')
      const jsPDF = jsPDFModule.default

      // Generate HTML content
      const htmlContent = type === 'dtr' ? generateDTRHTML(dtrContent!) : generateCertificateHTML(certificateContent!)
      
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
          const widthRatio = size.width / (contentWidth / 3.78)
          const heightRatio = size.height / (contentHeight / 3.78)
          const minRatio = Math.min(widthRatio, heightRatio)
          
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
          ? `${(content as DTRContent).documentNumber || 'document'}.pdf`
          : `${(content as CertificateContent).certificateNumber || 'document'}.pdf`
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

  const generateDTRHTML = (content: DTRContent): string => {
    // Safely handle numeric values that might be strings
    const totalHours = typeof content.totalHours === 'number' ? content.totalHours : parseFloat(String(content.totalHours)) || 0
    const requiredHours = typeof content.requiredHours === 'number' ? content.requiredHours : parseFloat(String(content.requiredHours)) || 0
    
    const completedHours = Math.min(totalHours, requiredHours)
    const progressPercentage = requiredHours > 0 ? (completedHours / requiredHours) * 100 : 0
    
    // Transform timeLogsDetails to TimeLogDisplay format for session processing
    const transformedLogs: TimeLogDisplay[] = content.timeLogsDetails.map((log, index) => {
      const timeInDate = parseDateTime(log.date, log.timeIn)
      const timeOutDate = parseDateTime(log.date, log.timeOut)
      return {
        id: index + 1,
        time_in: timeInDate.toISOString(),
        time_out: timeOutDate.toISOString(),
        log_type: log.logType as "regular" | "overtime" | "extended_overtime",
        status: log.status as "pending" | "completed",
        overtime_status: log.overtimeStatus as "pending" | "approved" | "rejected" | undefined,
        user_id: 1,
        internId: 1
      }
    })

    // Group logs by intern and date for display count (like daily-time-record and admin dashboard)
    const groupedLogs = groupLogsByDate(transformedLogs);

    // Calculate accurate hours summary from time logs - simplified approach
    const calculateHoursSummary = () => {
      let totalRegularHours = 0
      try {
        // Only sum up regular hours from logs
        content.timeLogsDetails.forEach(log => {
          if (log.logType === "regular") {
            const timeIn = parseDateTime(log.date, log.timeIn)
            const timeOut = parseDateTime(log.date, log.timeOut)
            const durationMs = timeOut.getTime() - timeIn.getTime()
            const durationHours = durationMs / (1000 * 60 * 60)
            totalRegularHours += durationHours
          }
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

      // The "total hours rendered" is the internship progress (completed hours)
      const totalRendered = typeof content.totalHours === 'number' ? content.totalHours : parseFloat(String(content.totalHours)) || 0
      const regularHoursFormatted = Number(truncateTo2Decimals(totalRegularHours))
      // Approved overtime is the difference between total rendered and regular hours
      const approvedOvertimeHours = Math.max(0, totalRendered - regularHoursFormatted)
      const approvedOvertimeHoursFormatted = Number(truncateTo2Decimals(approvedOvertimeHours))

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
                    ${completedHours.toFixed(2)}h / ${requiredHours}h
                    ${totalHours > requiredHours ? 
                      `<span style="color: #d97706; margin-left: 8px; font-size: 14px;">
                        (+${(totalHours - requiredHours).toFixed(2)}h overtime)
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
                Showing ${groupedLogs.length} of ${groupedLogs.length} time records
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
                                ${sessions.map((session) => {
                                  if (!session.timeIn) return ''
                                  const badgeProps = getTimeBadgeProps(
                                    session.timeIn,
                                    session.sessionType,
                                    "in",
                                    session.overtimeStatus === "none" ? undefined : session.overtimeStatus,
                                    session.isContinuousSession
                                  )
                                  return `<span class="badge ${mapBadgeClassToPDF(badgeProps.className)}">${badgeProps.text}</span>`
                                }).join('')}
                              </div>
                            </td>
                            
                            <td>
                              <div style="display: flex; flex-direction: column; gap: 4px;">
                                ${sessions.map((session) => {
                                  const badgeProps = session.isActive
                                    ? getTimeBadgeProps(null, session.sessionType, "active")
                                    : getTimeBadgeProps(
                                        session.timeOut,
                                        session.sessionType,
                                        "out",
                                        session.overtimeStatus === "none" ? undefined : session.overtimeStatus,
                                        session.isContinuousSession
                                      )
                                  return `<span class="badge ${mapBadgeClassToPDF(badgeProps.className)}">${badgeProps.text}</span>`
                                }).join('')}
                              </div>
                            </td>
                            
                            <td>
                              <div style="display: flex; flex-direction: column; gap: 4px;">
                                ${(() => {
                                  let previousRegularHours = 0
                                  return sessions.map((session) => {
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
                                  return sessions.map((session) => {
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
                <p class="text-gray-600 mb-4">This document has been officially verified and approved by:</p><br>
                <p class="font-medium" style="font-size: 18px;">${content.adminSignature}</p>
                <p class="text-gray-600">${content.adminTitle}</p>
                <p class="text-gray-600 mt-10">
                  Date Issued: ${new Date(content.issueDate).toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
                <p class="text-gray-600">
                  Document No: ${content.documentNumber}
                </p>                
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }

  const generateCertificateHTML = (content: CertificateContent): string => {
    const requiredHours = typeof content.requiredHours === 'number' 
      ? content.requiredHours 
      : parseFloat(String(content.requiredHours)) || 0

    // Format the issue date as "6th day of July 2025"
    const formatIssueDate = (dateStr: string): string => {
      const date = new Date(dateStr)
      const day = date.getDate()
      const month = date.toLocaleDateString('en-US', { month: 'long' })
      const year = date.getFullYear()
      
      // Add ordinal suffix to day
      const getDayWithSuffix = (day: number): string => {
        if (day >= 11 && day <= 13) return `${day}th`
        switch (day % 10) {
          case 1: return `${day}st`
          case 2: return `${day}nd`
          case 3: return `${day}rd`
          default: return `${day}th`
        }
      }
      
      return `${getDayWithSuffix(day)} day of ${month} ${year}`
    }

    // Format date in user-friendly format (e.g., "January 15, 2025")
    const formatUserFriendlyDate = (dateStr: string): string => {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Certificate of Completion</title>
        <style>
          @page { size: letter; margin: 0.75in; }
          body { 
            font-family: Arial, serif; 
            margin: 0; 
            padding: 40px; 
            text-align: center; 
            line-height: 1.8;
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .certificate { 
            padding: 60px 40px; 
            background: white; 
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .logo { 
            margin-bottom: 40px; 
            height: 120px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .logo img { 
            max-height: 100px; 
            width: auto; 
          }
          .title { 
            font-size: 42px; 
            font-weight: bold; 
            color: #1e40af; 
            margin-bottom: 50px; 
            text-decoration: underline;
            letter-spacing: 2px;
          }
          .content { 
            font-size: 22px; 
            line-height: 2; 
            margin-bottom: 60px; 
            text-align: justify;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .content p { 
            margin-bottom: 24px; 
          }
          .intern-name { 
            font-size: 32px; 
            font-weight: bold; 
            color: #1e40af; 
            text-decoration: underline;
            margin: 0 4px;
            display: inline;
          }
          .signature-section { 
            margin-top: 80px; 
            text-align: left;
            font-size: 20px;
          }
          .signature-line { 
            border-bottom: 2px solid #000; 
            width: 300px; 
            margin: 30px 0 20px 0; 
          }
          .certified-by { 
            font-size: 18px; 
            margin-bottom: 30px; 
            font-weight: bold;
          }
          .signature-name { 
            font-size: 20px; 
            font-weight: bold; 
            margin-bottom: 5px;
          }
          .signature-title { 
            font-size: 18px; 
            color: #666;
          }
          .date-signed { 
            font-size: 18px; 
            margin-bottom: 40px; 
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="logo">
            <img src="/cybersoft%20logo.png" alt="Cybersoft Logo" style="max-height: 100px; width: auto;" />
          </div>
          
          <div class="title">Certificate of Completion</div>
          
          <div class="content">
            <p>
              This is to certify that <span class="intern-name">${content.internName}</span>, <strong>${content.degree || 'Unknown'}</strong> student from <strong>${content.school}</strong>, has satisfactorily completed <strong>${requiredHours.toFixed(0)} hours</strong> of On-The-Job Training in this company, and has been assigned to the <strong>${content.department}</strong> Department from <strong>${formatUserFriendlyDate(content.periodStart)}</strong> until <strong>${formatUserFriendlyDate(content.periodEnd)}</strong>.
            </p>
            <p>
              This certification is issued upon the request of the above mentioned name for whatever legal purpose it may serve them best.
            </p>
            <p>
              Signed this <strong>${formatIssueDate(new Date().toISOString())}</strong>.
            </p>            
          </div>
          
          <div class="signature-section">
            <div class="certified-by">Certified by:</div>
            <div class="signature-name">${content.adminSignature}</div>
            <div class="signature-title">${content.adminTitle}</div>
          </div>
        </div>
      </body>
      </html>
    `
  }

  const content = type === 'dtr' ? dtrContent : certificateContent
  if (!content) return null

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {type === 'dtr' ? <FileText className="w-4 h-4 mr-2" /> : <Award className="w-4 h-4 mr-2" />}
          View {type === 'dtr' ? 'DTR' : 'Certificate'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {type === 'dtr' ? 'Official Daily Time Record' : 'Certificate of Completion'}
            <Button onClick={handleDownload} size="sm">
              <Download className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {type === 'dtr' && dtrContent && (
            <DTRPreview content={dtrContent} />
          )}
          {type === 'certificate' && certificateContent && (
            <CertificatePreview content={certificateContent} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DTRPreview({ content }: { content: DTRContent }) {
  // Safely handle numeric values that might be strings
  const totalHours = typeof content.totalHours === 'number' ? content.totalHours : parseFloat(String(content.totalHours)) || 0
  const requiredHours = typeof content.requiredHours === 'number' ? content.requiredHours : parseFloat(String(content.requiredHours)) || 0
  
  const completedHours = Math.min(totalHours, requiredHours)
  const progressPercentage = requiredHours > 0 ? (completedHours / requiredHours) * 100 : 0

  // Transform timeLogsDetails to TimeLogDisplay format for session processing
  const transformedLogs: TimeLogDisplay[] = content.timeLogsDetails.map((log, index) => {
    // Parse the AM/PM time format and convert to 24-hour format for calculations
    const timeInDate = parseDateTime(log.date, log.timeIn)
    const timeOutDate = parseDateTime(log.date, log.timeOut)
    
    const timeInString = timeInDate.toISOString()
    const timeOutString = timeOutDate.toISOString()
    
    return {
      id: index + 1, // Generate an ID
      time_in: timeInString, // ISO string for calculations
      time_out: timeOutString, // ISO string for calculations
      log_type: log.logType as "regular" | "overtime" | "extended_overtime",
      status: log.status as "pending" | "completed",
      overtime_status: log.overtimeStatus as "pending" | "approved" | "rejected" | undefined,
      user_id: 1, // Default user ID
      internId: 1 // Default intern ID
    }
  })

  // Group logs by intern and date for display count (like daily-time-record and admin dashboard)
  const groupedLogs = groupLogsByDate(transformedLogs);

  // Use centralized calculation for summary (matches dashboard/DTR logic)
  // Regular hours calculation remains the same
  const regularHours = Number(truncateTo2Decimals(
    transformedLogs.reduce((acc, log) => {
      // Only count regular logs, capped per day
      if (log.log_type === "regular" && log.time_in && log.time_out) {
        const dateStr = log.time_in.slice(0, 10);
        acc.byDate[dateStr] = (acc.byDate[dateStr] || 0) + (new Date(log.time_out).getTime() - new Date(log.time_in).getTime()) / (1000 * 60 * 60);
      }
      return acc;
    }, { byDate: {} } as { byDate: Record<string, number> }).byDate
      ? Object.values(
          transformedLogs.reduce((acc, log) => {
            if (log.log_type === "regular" && log.time_in && log.time_out) {
              const dateStr = log.time_in.slice(0, 10);
              acc[dateStr] = (acc[dateStr] || 0) + (new Date(log.time_out).getTime() - new Date(log.time_in).getTime()) / (1000 * 60 * 60);
            }
            return acc;
          }, {} as Record<string, number>)
        ).reduce((sum, h) => sum + Math.min(h, 9), 0)
      : 0
  ));

  // Total hours rendered is the internship progress (hours completed/submitted)
  const totalHoursRendered = Number(truncateTo2Decimals(totalHours));

  // Approved overtime is the difference between total hours rendered and regular hours
  const approvedOvertimeHours = Number(truncateTo2Decimals(totalHoursRendered - regularHours));

  const timeStats = {
    regularHours,
    approvedOvertimeHours,
    totalHoursRendered,
  };

  return (
    <div className="bg-white">
      {/* Header Section - Same as intern-dtr */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
              Intern Information
            </h3>
          </div>
          <div className="px-6 py-4">
            <div className="text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                <div>
                  <span className="font-medium text-base">Name:</span>
                  <div className="text-gray-600 text-base">{content.internName}</div>
                </div>
                <div>
                  <span className="font-medium text-base">University:</span>
                  <div className="text-gray-600 text-base">{content.school}</div>
                </div>
              </div>
              <div className="mt-4">
                <span className="font-medium text-base">Assigned Department:</span>
                <div className="text-gray-600 text-base">{content.department}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
              Internship Progress
            </h3>
          </div>
          <div className="px-6 py-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium text-base">Completed</span>
                <span className="font-medium text-base">
                  {completedHours.toFixed(2)}h / {requiredHours}h
                  {totalHours > requiredHours && (
                    <span className="text-yellow-600 ml-2 text-sm">
                      (+{(totalHours - requiredHours).toFixed(2)}h overtime)
                    </span>
                  )}
                </span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out" 
                  style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                ></div>
              </div>
              
              <div className="flex gap-8 mt-2">                  <div>
                    <div className="font-medium">Internship Duration:</div>
                    <div className="text-gray-600">
                      {new Date(content.periodStart).toLocaleDateString()} - {new Date(content.periodEnd).toLocaleDateString()}
                    </div>
                  </div>
                
                <div className="flex flex-col items-center justify-center ml-auto">
                  <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                    progressPercentage >= 100
                      ? "bg-green-100 text-green-700 border-green-300"
                      : "bg-yellow-100 text-yellow-700 border-yellow-300"
                  }`}>
                    {progressPercentage >= 100 ? "Complete" : "In Progress"}
                  </div>
                  <span className="text-2xl font-bold text-blue-600 mt-1">
                    {progressPercentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Time Logs Table - Exact same format as daily-time-record.tsx */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-lg font-medium">Daily Time Record</h3>
              <p className="text-sm text-gray-600">
                Showing {groupedLogs.length} of {groupedLogs.length} time records
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left py-2 px-4 font-medium text-gray-700">Date</th>
                  <th className="text-left py-2 px-4 font-medium text-gray-700">Time In</th>
                  <th className="text-left py-2 px-4 font-medium text-gray-700">Time Out</th>
                  <th className="text-left py-2 px-4 font-medium text-gray-700">Regular Shift</th>
                  <th className="text-left py-2 px-4 font-medium text-gray-700">Overtime</th>
                </tr>
              </thead>
              <tbody>
                {content.timeLogsDetails && content.timeLogsDetails.length > 0 ? (
                  sortGroupedLogsByDate(
                    groupLogsByDate(transformedLogs), 
                    "asc"
                  ).length > 0 ? (
                    sortGroupedLogsByDate(
                      groupLogsByDate(transformedLogs), 
                      "asc"
                    ).map(([key, logsForDate]) => {
                      const datePart = key.split("-").slice(-3).join("-")
                      
                      // Use centralized session processing with transformed logs
                      const { sessions } = processTimeLogSessions(logsForDate)

                      return (
                        <tr key={key} className="border-b border-gray-100">
                          <td className="py-3 px-4">
                            <div className="flex flex-col items-start">
                              <span className="text-xs text-gray-500">
                                {new Date(datePart).toLocaleDateString("en-US", { weekday: "short" })}
                              </span>
                              <span className="font-medium">
                                {formatLogDate(datePart)}
                              </span>
                            </div>
                          </td>
                          
                          {/* Time In Column */}
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1">
                              {sessions.map((session, i) => {
                                if (!session.timeIn) return null
                                const badgeProps = getTimeBadgeProps(
                                  session.timeIn,
                                  session.sessionType,
                                  "in",
                                  session.overtimeStatus === "none" ? undefined : session.overtimeStatus,
                                  session.isContinuousSession
                                )
                                
                                return (
                                  <Badge key={i} variant={badgeProps.variant} className={badgeProps.className}>
                                    {badgeProps.text}
                                  </Badge>
                                )
                              })}
                            </div>
                          </td>
                          
                          {/* Time Out Column */}
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1">
                              {sessions.map((session, i) => {
                                const badgeProps = session.isActive
                                  ? getTimeBadgeProps(null, session.sessionType, "active")
                                  : getTimeBadgeProps(
                                      session.timeOut,
                                      session.sessionType,
                                      "out",
                                      session.overtimeStatus === "none" ? undefined : session.overtimeStatus,
                                      session.isContinuousSession
                                    )
                                
                                return (
                                  <Badge key={i} variant={badgeProps.variant} className={badgeProps.className}>
                                    {badgeProps.text}
                                  </Badge>
                                )
                              })}
                            </div>
                          </td>
                          
                          {/* Regular Shift Column */}
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1">
                              {(() => {
                                let previousRegularHours = 0
                                return sessions.map((session, i) => {
                                  // Use accurate calculation instead of centralized truncation
                                  const accurateCalc = calculateAccurateSessionDuration(
                                    session.logs,
                                    new Date(),
                                    previousRegularHours
                                  )
                                  
                                  const displayText = formatAccurateHours(accurateCalc.regularHours)
                                  const badgeProps = {
                                    variant: "outline" as const,
                                    className: accurateCalc.regularHours > 0 ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-gray-100 text-gray-700 border-gray-300",
                                    text: displayText
                                  }
                                  
                                  // Update tracking variables for next iteration
                                  previousRegularHours += accurateCalc.regularHours
                                  
                                  return (
                                    <Badge key={i} variant={badgeProps.variant} className={badgeProps.className}>
                                      {badgeProps.text}
                                    </Badge>
                                  )
                                })
                              })()}
                            </div>
                          </td>
                          
                          {/* Overtime Column */}
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1">
                              {(() => {
                                let previousRegularHours = 0
                                return sessions.map((session, i) => {
                                  // Use raw calculation for overtime display (shows actual time worked)
                                  const rawCalc = calculateRawSessionDuration(
                                    session.logs,
                                    new Date(),
                                    previousRegularHours
                                  )
                                  
                                  const displayText = formatAccurateHours(rawCalc.overtimeHours)
                                  const badgeProps = {
                                    variant: "outline" as const,
                                    className: rawCalc.overtimeHours > 0 ? 
                                      (rawCalc.overtimeStatus === "approved" ? "bg-purple-100 text-purple-700 border-purple-300" :
                                       rawCalc.overtimeStatus === "rejected" ? "bg-gray-100 text-gray-700 border-gray-300" :
                                       "bg-yellow-100 text-yellow-700 border-yellow-300") :
                                      "bg-gray-100 text-gray-700 border-gray-300",
                                    text: displayText
                                  }
                                  
                                  // Update tracking variables for next iteration using RAW hours for display consistency
                                  previousRegularHours += rawCalc.regularHours
                                  
                                  return (
                                    <Badge key={i} variant={badgeProps.variant} className={badgeProps.className}>
                                      {badgeProps.text}
                                    </Badge>
                                  )
                                })
                              })()}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    // Fallback: show raw data if grouping fails
                    content.timeLogsDetails.map((log, index) => {
                      // Parse the AM/PM time format
                      const timeInDate = parseDateTime(log.date, log.timeIn)
                      const timeOutDate = parseDateTime(log.date, log.timeOut)
                      
                      const timeInString = timeInDate.toISOString()
                      const timeOutString = timeOutDate.toISOString()
                      
                      // Create a single log in the same format as session processing
                      const logData: TimeLogDisplay = {
                        id: index + 1,
                        time_in: timeInString,
                        time_out: timeOutString,
                        log_type: log.logType as "regular" | "overtime" | "extended_overtime",
                        status: log.status as "pending" | "completed",
                        overtime_status: log.overtimeStatus as "pending" | "approved" | "rejected" | undefined,
                        user_id: 1,
                        internId: 1
                      }
                      
                      // Use the same calculation functions as daily-time-record.tsx
                      const accurateCalc = calculateAccurateSessionDuration([logData], new Date(), 0)
                      const rawCalc = calculateRawSessionDuration([logData], new Date(), 0)
                      
                      return (
                        <tr key={index} className="border-b border-gray-100">
                          <td className="py-3 px-4">
                            <div className="flex flex-col items-start">
                              <span className="text-xs text-gray-500">
                                {new Date(log.date).toLocaleDateString("en-US", { weekday: "short" })}
                              </span>
                              <span className="font-medium">
                                {new Date(log.date).toLocaleDateString("en-US", { 
                                  month: "numeric", 
                                  day: "numeric", 
                                  year: "numeric" 
                                })}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                              {log.timeIn}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                              {log.timeOut}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={accurateCalc.regularHours > 0 ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-gray-100 text-gray-700 border-gray-300"}>
                              {formatAccurateHours(accurateCalc.regularHours)}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={
                              rawCalc.overtimeHours > 0 ? 
                                (rawCalc.overtimeStatus === "approved" ? "bg-purple-100 text-purple-700 border-purple-300" :
                                 rawCalc.overtimeStatus === "rejected" ? "bg-gray-100 text-gray-700 border-gray-300" :
                                 "bg-yellow-100 text-yellow-700 border-yellow-300") :
                                "bg-gray-100 text-gray-700 border-gray-300"
                            }>
                              {formatAccurateHours(rawCalc.overtimeHours)}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })
                  )
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No time records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="mt-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium">Hours Summary</h3>
        </div>
        <div className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <span className="block text-4xl font-bold text-blue-600">{timeStats.regularHours.toFixed(2)}</span>
              <span className="block text-gray-600 mt-1">Regular Hours</span>
            </div>
            <div className="text-center">
              <span className="block text-4xl font-bold text-purple-600">{timeStats.approvedOvertimeHours.toFixed(2)}</span>
              <span className="block text-gray-600 mt-1">Approved Overtime</span>
            </div>
            <div className="text-center">
              <span className="block text-4xl font-bold text-green-600">{timeStats.totalHoursRendered.toFixed(2)}</span>
              <span className="block text-gray-600 mt-1">Total Hours Rendered</span>
            </div>
          </div>
        </div>
      </div>

      {/* Official Signature Section */}
      <div className="mt-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium">Official Verification</h3>
        </div>
        <div className="px-6 py-4">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">This document has been officially verified and approved by:</p>
            <p className="font-medium text-lg">{content.adminSignature}</p>
            <p className="text-sm text-gray-600">{content.adminTitle}</p>
            <p className="text-sm text-gray-500 mt-10">
              Date Issued: {new Date(content.issueDate).toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-sm text-gray-500">
              Document No: {content.documentNumber}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function CertificatePreview({ content }: { content: CertificateContent }) {
  const requiredHours = typeof content.requiredHours === 'number' 
    ? content.requiredHours 
    : parseFloat(String(content.requiredHours)) || 0

  // Format the issue date as "6th day of July 2025"
  const formatIssueDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    const day = date.getDate()
    const month = date.toLocaleDateString('en-US', { month: 'long' })
    const year = date.getFullYear()
    
    // Add ordinal suffix to day
    const getDayWithSuffix = (day: number): string => {
      if (day >= 11 && day <= 13) return `${day}th`
      switch (day % 10) {
        case 1: return `${day}st`
        case 2: return `${day}nd`
        case 3: return `${day}rd`
        default: return `${day}th`
      }
    }
    
    return `${getDayWithSuffix(day)} day of ${month} ${year}`
  }

  // Format date in user-friendly format (e.g., "January 15, 2025")
  const formatUserFriendlyDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  return (
    <div className="bg-white text-center p-16 min-h-[800px] flex flex-col justify-between">
      <div className="flex-shrink-0">
        <div className="mb-10 h-32 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element  */}
          <img 
            src="/cybersoft%20logo.png"
            alt="Cybersoft Logo" 
            className="max-h-24 w-auto"
          />
        </div>
        
        <h1 className="text-5xl font-bold text-blue-600 mb-12 underline tracking-widest">
          Certificate of Completion
        </h1>
      </div>
      
      <div className="flex-grow flex items-center justify-center">
        <div className="text-2xl leading-loose text-justify space-y-6">
          <p>
          This is to certify that <span className="text-3xl font-bold text-blue-600 underline mx-1">{content.internName}</span>, <strong>{content.degree || 'Unknown'}</strong> student from <strong>{content.school}</strong>, has satisfactorily completed <strong>{requiredHours.toFixed(0)} hours</strong> of On-The-Job Training in this company, and has been assigned to the <strong>{content.department}</strong> Department from <strong>{formatUserFriendlyDate(content.periodStart)}</strong> until <strong>{formatUserFriendlyDate(content.periodEnd)}</strong>.
          </p>
          <p>
            This certification is issued upon the request of the above mentioned name for whatever legal purpose it may serve them best.
          </p>
          <p>
            Signed this <strong>{formatIssueDate(new Date().toISOString())}</strong>.
          </p>
        </div>
      </div>
      
      <div className="text-left mt-20 text-xl flex-shrink-0">
        <div className="mb-8 font-bold">Certified by:</div>
        <div className="text-xl font-bold mb-2">{content.adminSignature}</div>
        <div className="text-lg text-gray-600">{content.adminTitle}</div>
      </div>
    </div>
  )
}