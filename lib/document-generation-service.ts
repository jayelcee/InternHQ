/**
 * DocumentGenerationService: Generates DTR and certificate HTML content for PDF export, matching the format and logic of DocumentViewer.
 *
 * Exports:
 * - DocumentGenerationService: Main class for generating DTR and certificate HTML
 * - Internal helpers for time log and badge processing
 */
import { DocumentContent, CertificateContent } from './completion-service'
import { TimeLogDisplay, groupLogsByDate, sortGroupedLogsByDate } from './ui-utils'
import { processTimeLogSessions, getTimeBadgeProps } from './session-utils'
import { calculateAccurateSessionDuration, formatAccurateHours, calculateRawSessionDuration, truncateTo2Decimals } from './time-utils'

interface TimeLogEntry {
  date: string
  timeIn: string
  timeOut: string
  logType: "regular" | "overtime" | "extended_overtime"
  status: string
  overtimeStatus: string | null
}

/**
 * Safely parse date and time strings into a Date object
 */
function parseDateTime(dateStr: string, timeStr: string): Date {
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) throw new Error('Invalid date')
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i)
    if (!timeMatch) throw new Error('Invalid time format')
    let hours = parseInt(timeMatch[1], 10)
    const minutes = parseInt(timeMatch[2], 10)
    const ampm = timeMatch[3].toUpperCase()
    if (ampm === 'PM' && hours !== 12) hours += 12
    else if (ampm === 'AM' && hours === 12) hours = 0
    const result = new Date(date)
    result.setHours(hours, minutes, 0, 0)
    return result
  } catch {
    return new Date()
  }
}

// Helper function to map badge class names to PDF CSS classes
const mapBadgeClassToPDF = (className: string): string => {
  if (className.includes('bg-green-100')) return 'badge-green'
  if (className.includes('bg-red-100')) return 'badge-red'
  if (className.includes('bg-yellow-100')) return 'badge-yellow'
  if (className.includes('bg-purple-100')) return 'badge-overtime-approved'
  if (className.includes('bg-blue-100')) return 'badge-regular'
  if (className.includes('bg-gray-100')) return 'badge-gray'
  return 'badge-gray' // fallback
}

export class DocumentGenerationService {
  /**
   * Generates DTR HTML content using the exact same format as DocumentViewer
   */
  static generateDTRHTML(content: DocumentContent & { timeLogsDetails: TimeLogEntry[] }): string {
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
        log_type: log.logType,
        status: log.status as "pending" | "completed",
        overtime_status: log.overtimeStatus as "pending" | "approved" | "rejected" | undefined,
        user_id: 1,
        internId: 1
      }
    })
    return this.getDTRTemplate(content, completedHours, progressPercentage, this.calculateHoursSummary(content.timeLogsDetails), transformedLogs, totalHours, requiredHours)
  }

  /**
   * Generates certificate HTML content using the exact same format as DocumentViewer
   */
  static generateCertificateHTML(content: CertificateContent): string {
    return this.getCertificateTemplate(content)
  }

  /**
   * Calculates hours summary using the same logic as DocumentViewer
   */
  private static calculateHoursSummary(timeLogsDetails: TimeLogEntry[]): {
    regularHours: number
    approvedOvertimeHours: number
    totalHoursRendered: number
  } {
    let totalRegularHours = 0
    for (const log of timeLogsDetails) {
      try {
        if (log.logType === "regular") {
          const timeIn = parseDateTime(log.date, log.timeIn)
          const timeOut = parseDateTime(log.date, log.timeOut)
          const durationMs = timeOut.getTime() - timeIn.getTime()
          const durationHours = durationMs / (1000 * 60 * 60)
          totalRegularHours += durationHours
        }
      } catch {}
    }
    const regularHours = Number(truncateTo2Decimals(totalRegularHours))
    return { regularHours, approvedOvertimeHours: 0, totalHoursRendered: 0 }
  }

  /**
   * Generates the DTR HTML template using the exact same format as DocumentViewer
   */
  private static getDTRTemplate(
    content: DocumentContent & { timeLogsDetails: TimeLogEntry[] },
    completedHours: number,
    progressPercentage: number,
    hoursSummary: { regularHours: number, approvedOvertimeHours: number, totalHoursRendered: number },
    transformedLogs: TimeLogDisplay[],
    totalHours: number,
    requiredHours: number
  ): string {
    // Group logs by intern and date for display count (like DocumentViewer and daily-time-record)
    const groupedLogs = groupLogsByDate(transformedLogs);

    // Calculate time stats for summary section (using new logic)
    let totalRegularHours = 0;
    content.timeLogsDetails.forEach(log => {
      if (log.logType === "regular") {
        const timeIn = parseDateTime(log.date, log.timeIn);
        const timeOut = parseDateTime(log.date, log.timeOut);
        const durationMs = timeOut.getTime() - timeIn.getTime();
        const durationHours = durationMs / (1000 * 60 * 60);
        totalRegularHours += durationHours;
      }
    });
    const regularHours = Number(truncateTo2Decimals(totalRegularHours));
    // The total hours rendered is the internship progress (completed hours submitted)
    const totalHoursRendered = typeof content.totalHours === 'number' ? content.totalHours : parseFloat(String(content.totalHours)) || 0;
    // Approved overtime is the difference between total rendered and regular hours
    const approvedOvertimeHours = Math.max(0, totalHoursRendered - regularHours);
    const timeStats = {
      regularHours,
      approvedOvertimeHours: Number(truncateTo2Decimals(approvedOvertimeHours)),
      totalHoursRendered: Number(truncateTo2Decimals(totalHoursRendered)),
    };

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
          .badge { display: inline-flex; align-items: center; justify-content: center; border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; white-space: nowrap; min-width: 60px; margin: 2px; }
          .badge-container { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
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
                        (+${(totalHours - requiredHours).toFixed(2)})
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
                              <div class="badge-container">
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
                              <div class="badge-container">
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
                              <div class="badge-container">
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
                              <div class="badge-container">
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
                  <div class="stat-value text-blue-600">${timeStats.regularHours.toFixed(2)}</div>
                  <div class="stat-label">Regular Hours</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value text-purple-600">${timeStats.approvedOvertimeHours.toFixed(2)}</div>
                  <div class="stat-label">Approved Overtime</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value text-green-600">${timeStats.totalHoursRendered.toFixed(2)}</div>
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
                <p class="text-gray-600">${content.adminTitle}</p><br>
                <p class="text-gray-500 mt-10">
                  Date Issued: ${new Date(content.issueDate).toLocaleDateString()}
                </p>
                <p class="text-gray-500">
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

  /**
   * Generates time log table rows using the exact same session processing as DocumentViewer
   */
  private static generateTimeLogTableRows(transformedLogs: TimeLogDisplay[]): string {
    try {
      const groupedLogs = groupLogsByDate(transformedLogs)
      
      return sortGroupedLogsByDate(groupedLogs, "asc")
        .map(([key, logsForDate]) => {
          const datePart = key.split("-").slice(-3).join("-")
          const { sessions } = processTimeLogSessions(logsForDate)
          
          return `
            <tr>
              <td class="font-medium">
                <div class="flex flex-col items-start">
                  <span class="text-xs text-gray-600">
                    ${new Date(datePart).toLocaleDateString("en-US", { weekday: "short" })}
                  </span>
                  <span>${new Date(datePart).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })}</span>
                </div>
              </td>
              
              <td>
                <div class="badge-container">
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
                <div class="badge-container">
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
                <div class="badge-container">
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
                <div class="badge-container">
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
    } catch {
      // Fallback to simple table generation
      return this.generateFallbackTableRows(transformedLogs)
    }
  }

  /**
   * Fallback table generation for when session processing fails
   */
  private static generateFallbackTableRows(transformedLogs: TimeLogDisplay[]): string {
    return transformedLogs.map((log) => {
      const accurateCalc = calculateAccurateSessionDuration([log], new Date(), 0)
      const rawCalc = calculateRawSessionDuration([log], new Date(), 0)
      
      // Safely handle null values
      const timeIn = log.time_in || new Date().toISOString()
      const timeOut = log.time_out || new Date().toISOString()
      
      return `
        <tr>
          <td class="font-medium">
            <div class="flex flex-col items-start">
              <span class="text-xs text-gray-600">
                ${new Date(timeIn).toLocaleDateString("en-US", { weekday: "short" })}
              </span>
              <span>${new Date(timeIn).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })}</span>
            </div>
          </td>
          <td>
            <div class="badge-container">
              <span class="badge badge-green">${new Date(timeIn).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
            </div>
          </td>
          <td>
            <div class="badge-container">
              <span class="badge badge-red">${new Date(timeOut).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
            </div>
          </td>
          <td>
            <div class="badge-container">
              <span class="badge ${accurateCalc.regularHours > 0 ? 'badge-regular' : 'badge-gray'}">${formatAccurateHours(accurateCalc.regularHours)}</span>
            </div>
          </td>
          <td>
            <div class="badge-container">
              <span class="badge ${rawCalc.overtimeHours > 0 ? 
                (rawCalc.overtimeStatus === "approved" ? 'badge-overtime-approved' :
                 rawCalc.overtimeStatus === "rejected" ? 'badge-gray' :
                 'badge-overtime-pending') : 'badge-gray'}">${formatAccurateHours(rawCalc.overtimeHours)}</span>
            </div>
          </td>
        </tr>
      `
    }).join('')
  }

  /**
   * Generates certificate HTML using the exact same format as DocumentViewer
   */
  private static getCertificateTemplate(content: CertificateContent): string {
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
            <p style="margin-bottom: 24px;">
              This is to certify that <span class="intern-name">${content.internName || 'Unknown'}</span>, <strong>${content.degree || 'Unknown'}</strong> student from <strong>${content.school || 'Unknown Institution'}</strong>, has satisfactorily completed <strong>${requiredHours.toFixed(0)} hours</strong> of On-The-Job Training in this company, and has been assigned to the <strong>${content.department || 'Unknown Department'}</strong> Department from <strong>${content.periodStart ? formatUserFriendlyDate(content.periodStart) : 'Unknown'}</strong> until <strong>${content.periodEnd ? formatUserFriendlyDate(content.periodEnd) : 'Unknown'}</strong>.
            </p>
            <p style="margin-bottom: 24px;">
              This certification is issued upon the request of the above mentioned name for whatever legal purpose it may serve them best.
            </p>
            <p style="margin-bottom: 24px;">
              Signed this <strong>${formatIssueDate(new Date().toISOString())}</strong>.
            </p>
          </div>
          
          <div class="signature-section">
            <div class="certified-by">Certified by:</div>
            <div class="signature-name">${content.adminSignature || 'Unknown'}</div>
            <div class="signature-title">${content.adminTitle || 'Administrator'}</div>
          </div>
        </div>
      </body>
      </html>
    `
  }
}
