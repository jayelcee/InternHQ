/**
 * Time calculation and formatting utilities.
 *
 * Provides:
 * - Consistent time calculations (regular/overtime, progress, durations)
 * - Centralized constants (DAILY_REQUIRED_HOURS, MAX_OVERTIME_HOURS)
 * - Date/time formatting and extraction helpers
 * - Edit request and statistics utilities
 */

export const DAILY_REQUIRED_HOURS = 9
export const MAX_OVERTIME_HOURS = 3

/**
 * Truncates a decimal number to 2 decimal places (no rounding).
 * @param val The number to truncate.
 * @returns The truncated number as a string with 2 decimal places.
 */
export function truncateTo2Decimals(val: number): string {
  const [int, dec = ""] = val.toString().split(".")
  return dec.length > 0 ? `${int}.${dec.slice(0, 2).padEnd(2, "0")}` : `${int}.00`
}

/**
 * Formats a duration in hours and minutes as a string.
 * @param hours Number of hours.
 * @param minutes Number of minutes.
 * @returns Formatted string, e.g. "2h 05m".
 */
export function formatDuration(hours: number, minutes: number): string {
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`
}

/**
 * Calculates duration and hours from timestamps using truncation (not rounding).
 * @param timeIn Start time as string or Date.
 * @param timeOut End time as string or Date.
 * @returns Object with duration string, hoursWorked number, and decimal string.
 */
export function calculateTimeWorked(timeIn: string | Date, timeOut: string | Date) {
  const inDate = new Date(timeIn)
  const outDate = new Date(timeOut)
  const diffMs = outDate.getTime() - inDate.getTime()
  
  if (diffMs <= 0) {
    return {
      duration: "0h 00m",
      hoursWorked: 0,
      decimal: "0.00"
    }
  }
  
  const totalMinutes = Math.floor(diffMs / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const hoursWorked = diffMs / (1000 * 60 * 60)
  
  return {
    duration: formatDuration(hours, minutes),
    hoursWorked,
    decimal: truncateTo2Decimals(hoursWorked)
  }
}

/**
 * Gets truncated decimal hours from time log entry.
 * @param timeIn Start time string.
 * @param timeOut End time string.
 * @returns Truncated decimal hours as number.
 */
export function getTruncatedDecimalHours(timeIn: string, timeOut: string): number {
  if (!timeIn || !timeOut) return 0
  const result = calculateTimeWorked(timeIn, timeOut)
  return Number(result.decimal)
}

/**
 * Calculates total completed hours from time logs with proper handling of edit requests and overtime approval.
 * @param logs Array of time logs with time_in and time_out fields.
 * @param internId Optional intern ID to filter logs.
 * @param editRequests Optional array of edit requests to apply pending changes.
 * @returns Total completed hours as a number, truncated to 2 decimal places.
 */
export function calculateInternshipProgress(
  logs: Array<{
    id?: number
    time_in?: string | null
    time_out?: string | null
    timeIn?: string | null
    timeOut?: string | null
    status?: string
    user_id?: number | string
    internId?: number | string
    log_type?: string
    overtime_status?: string
    edit_request_status?: string
  }>,
  internId?: string | number,
  editRequests?: Array<{
    logId: number
    status: "pending" | "approved" | "rejected"
    requestedTimeIn?: string | null
    requestedTimeOut?: string | null
  }>
): number {
  const filteredLogs = internId 
    ? logs.filter(log => 
        (log.user_id?.toString() === internId.toString()) ||
        (log.internId?.toString() === internId.toString())
      )
    : logs

  const logsByDate: {[date: string]: typeof filteredLogs} = {}
  
  filteredLogs.forEach(log => {
    const timeIn = log.time_in || log.timeIn
    
    if (timeIn) {
      const dateStr = extractDateString(timeIn)
      if (!logsByDate[dateStr]) {
        logsByDate[dateStr] = []
      }
      logsByDate[dateStr].push(log)
    }
  })
  
  let totalHours = 0
  
  Object.values(logsByDate).forEach(dailyLogs => {
    let dailyRegularHours = 0
    let dailyOvertimeHours = 0
    
    dailyLogs.forEach(log => {
      let timeIn = log.time_in || log.timeIn
      let timeOut = log.time_out || log.timeOut
      
      if (editRequests && log.id) {
        const editRequest = editRequests.find(req => req.logId === log.id)
        if (editRequest) {
          if (editRequest.status === "approved") {
            timeIn = editRequest.requestedTimeIn || timeIn
            timeOut = editRequest.requestedTimeOut || timeOut
          }
        }
      }
      
      if (timeIn && timeOut && (!log.status || log.status === 'completed')) {
        const inDate = new Date(timeIn)
        const outDate = new Date(timeOut)
        const diffMs = outDate.getTime() - inDate.getTime()
        
        if (diffMs > 0) {
          const truncatedMs = Math.floor(diffMs / (1000 * 60)) * (1000 * 60)
          const hoursWorked = truncatedMs / (1000 * 60 * 60)
          
          if (log.log_type === 'overtime' || log.log_type === 'extended_overtime') {
            if (log.overtime_status === 'approved') {
              dailyOvertimeHours += hoursWorked
            }
          } else {
            dailyRegularHours += hoursWorked
          }
        }
      }
    })
    
    const cappedRegularHours = Math.min(dailyRegularHours, DAILY_REQUIRED_HOURS)
    totalHours += cappedRegularHours + dailyOvertimeHours
  })

  return Number(truncateTo2Decimals(totalHours))
}

/**
 * Calculates total and categorized duration from logs, with edit request and active session support.
 * @param logs Array of time logs.
 * @param editRequests Optional array of edit requests.
 * @param internId Optional intern ID to filter logs.
 * @param includeActive Whether to include active (incomplete) sessions.
 * @param currentTime Current time for active session calculations.
 * @returns Object with regular and overtime hours broken down by status.
 */
export function calculateDurationWithEditRequests(
  logs: Array<{
    id?: number
    time_in?: string | null
    time_out?: string | null
    timeIn?: string | null
    timeOut?: string | null
    status?: string
    user_id?: number | string
    internId?: number | string
    log_type?: string
    overtime_status?: string
  }>,
  editRequests?: Array<{
    logId: number
    status: "pending" | "approved" | "rejected"
    requestedTimeIn?: string | null
    requestedTimeOut?: string | null
  }>,
  internId?: string | number,
  includeActive: boolean = false,
  currentTime?: Date
): {
  totalHours: number
  regularHours: number
  overtimeHours: { 
    approved: number
    pending: number
    rejected: number
    total: number
  }
  activeHours: number
} {
  const filteredLogs = internId 
    ? logs.filter(log => 
        (log.user_id?.toString() === internId.toString()) ||
        (log.internId?.toString() === internId.toString())
      )
    : logs

  let totalMs = 0
  let regularMs = 0
  let approvedOvertimeMs = 0
  let pendingOvertimeMs = 0
  let rejectedOvertimeMs = 0
  let activeMs = 0

  filteredLogs.forEach(log => {
    let timeIn = log.time_in || log.timeIn
    let timeOut = log.time_out || log.timeOut

    if (editRequests && log.id) {
      const editRequest = editRequests.find(req => req.logId === log.id)
      if (editRequest && editRequest.status === "approved") {
        timeIn = editRequest.requestedTimeIn || timeIn
        timeOut = editRequest.requestedTimeOut || timeOut
      }
    }

    if (timeIn) {
      if (timeOut && (!log.status || log.status === 'completed')) {
        const inDate = new Date(timeIn)
        const outDate = new Date(timeOut)
        const diffMs = outDate.getTime() - inDate.getTime()
        
        if (diffMs > 0) {
          const truncatedMs = Math.floor(diffMs / (1000 * 60)) * (1000 * 60)
          totalMs += truncatedMs

          if (log.log_type === 'overtime' || log.log_type === 'extended_overtime') {
            if (log.overtime_status === 'approved') {
              approvedOvertimeMs += truncatedMs
            } else if (log.overtime_status === 'rejected') {
              rejectedOvertimeMs += truncatedMs
            } else {
              pendingOvertimeMs += truncatedMs
            }
          } else {
            regularMs += truncatedMs
          }
        }
      }
      else if (!timeOut && includeActive && currentTime && log.status === 'pending') {
        const inDate = new Date(timeIn)
        const diffMs = currentTime.getTime() - inDate.getTime()
        if (diffMs > 0) {
          const truncatedMs = Math.floor(diffMs / (1000 * 60)) * (1000 * 60)
          activeMs += truncatedMs
          totalMs += truncatedMs
        }
      }
    }
  })

  return {
    totalHours: totalMs / (1000 * 60 * 60),
    regularHours: regularMs / (1000 * 60 * 60),
    overtimeHours: {
      approved: approvedOvertimeMs / (1000 * 60 * 60),
      pending: pendingOvertimeMs / (1000 * 60 * 60),
      rejected: rejectedOvertimeMs / (1000 * 60 * 60),
      total: (approvedOvertimeMs + pendingOvertimeMs + rejectedOvertimeMs) / (1000 * 60 * 60)
    },
    activeHours: activeMs / (1000 * 60 * 60)
  }
}

/**
 * Converts UTC date string to local date string (YYYY-MM-DD).
 * @param dateStr UTC date string.
 * @returns Local date string in YYYY-MM-DD format.
 */
export function getLocalDateString(dateStr: string): string {
  const d = new Date(dateStr)
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0")
}

/**
 * Gets current date in YYYY-MM-DD format.
 * @returns Current date string.
 */
export function getCurrentDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Gets the Monday-Sunday range for a given date.
 * @param date Date object (defaults to today).
 * @returns Object with monday and sunday Date objects.
 */
export function getWeekRange(date = new Date()) {
  const day = date.getDay()
  const diffToMonday = (day === 0 ? -6 : 1) - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMonday)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { monday, sunday }
}

/**
 * Extracts date string in YYYY-MM-DD format from a Date object or timestamp.
 * @param date Date object or string.
 * @returns Date string in YYYY-MM-DD format.
 */
export function extractDateString(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) {
    return ""
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * Filters logs by intern ID (matches either user_id or internId).
 * @param logs Array of logs.
 * @param internId Intern ID to filter by.
 * @returns Filtered logs.
 */
export function filterLogsByInternId<T extends { user_id?: number | string; internId?: number | string }>(
  logs: T[], 
  internId: string | number | undefined
): T[] {
  if (!internId) return logs
  return logs.filter(log =>
    log.user_id?.toString() === internId.toString() ||
    log.internId?.toString() === internId.toString()
  )
}

/**
 * Default internship details for fallback values.
 */
export const DEFAULT_INTERNSHIP_DETAILS = {
  school: { name: "N/A" },
  department: { name: "N/A" },
  supervisor: "N/A",
  required_hours: 0,
  start_date: "",
  end_date: "",
  status: "",
} as const

/**
 * Process logs for continuous time display (earliest time in, latest time out).
 * Handles overtime approval/rejection logic.
 * @param logs Array of time logs for a specific day.
 * @returns Object with continuous time info and calculated hours.
 */
export function getContinuousTime(logs: Array<{
  id?: number
  time_in?: string | null
  time_out?: string | null
  timeIn?: string | null
  timeOut?: string | null
  log_type?: string
  overtime_status?: string
  status?: string
}>) {
  const regularLogs = logs.filter(log => log.log_type !== "overtime" && log.log_type !== "extended_overtime")
  const overtimeLogs = logs.filter(log => log.log_type === "overtime" || log.log_type === "extended_overtime")
  const allCompletedLogs = [...regularLogs, ...overtimeLogs].filter(log => {
    const timeIn = log.time_in || log.timeIn
    const timeOut = log.time_out || log.timeOut
    return timeIn && timeOut
  })
  
  let earliestTimeIn: string | null = null
  let latestTimeOut: string | null = null
  let isCurrentlyActive = false
  
  if (allCompletedLogs.length > 0) {
    earliestTimeIn = allCompletedLogs.reduce((earliest, log) => {
      const timeIn = log.time_in || log.timeIn
      if (!timeIn) return earliest
      if (!earliest) return timeIn
      return new Date(timeIn) < new Date(earliest) ? timeIn : earliest
    }, null as string | null)
    
    const hasRejectedOvertime = overtimeLogs.some(log => log.overtime_status === "rejected")
    const hasApprovedOvertime = overtimeLogs.some(log => log.overtime_status === "approved")
    
    if (hasRejectedOvertime && !hasApprovedOvertime) {
      if (earliestTimeIn) {
        const startTime = new Date(earliestTimeIn)
        const cutoffTime = new Date(startTime.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
        latestTimeOut = cutoffTime.toISOString()
      }
    } else {
      latestTimeOut = allCompletedLogs.reduce((latest, log) => {
        const timeOut = log.time_out || log.timeOut
        if (!timeOut) return latest
        if (!latest) return timeOut
        return new Date(timeOut) > new Date(latest) ? timeOut : latest
      }, null as string | null)
    }
  }
  
  const activeLogs = [...regularLogs, ...overtimeLogs].filter(log => {
    const timeIn = log.time_in || log.timeIn
    const timeOut = log.time_out || log.timeOut
    return timeIn && !timeOut && log.status === "pending"
  })
  if (activeLogs.length > 0) {
    isCurrentlyActive = true
    if (!earliestTimeIn) {
      const timeIn = activeLogs[0].time_in || activeLogs[0].timeIn
      if (timeIn) earliestTimeIn = timeIn
    }
  }

  let totalHoursWorked = 0
  if (earliestTimeIn && latestTimeOut) {
    const result = calculateTimeWorked(earliestTimeIn, latestTimeOut)
    totalHoursWorked = result.hoursWorked
  }

  const regularHours = Math.min(totalHoursWorked, DAILY_REQUIRED_HOURS)
  let overtimeHours = 0
  let overtimeStatus = "none"
  
  if (overtimeLogs.length > 0) {
    const hasApprovedOvertime = overtimeLogs.some(log => log.overtime_status === "approved")
    const hasRejectedOvertime = overtimeLogs.some(log => log.overtime_status === "rejected")
    const hasPendingOvertime = overtimeLogs.some(log => !log.overtime_status || log.overtime_status === "pending")
    
    if (totalHoursWorked > DAILY_REQUIRED_HOURS) {
      overtimeHours = totalHoursWorked - DAILY_REQUIRED_HOURS
      
      if (hasApprovedOvertime) {
        overtimeStatus = "approved"
      } else if (hasPendingOvertime) {
        overtimeStatus = "pending"
      } else if (hasRejectedOvertime) {
        overtimeStatus = "rejected"
        overtimeHours = 0
      }
    }
  }

  return {
    earliestTimeIn,
    latestTimeOut,
    isCurrentlyActive,
    regularHours,
    overtimeHours,
    overtimeStatus,
    overtimeLogs,
    allLogs: logs
  }
}

/**
 * Fetch edit requests for time logs.
 * @param internId Optional intern ID to filter requests.
 * @returns Array of edit requests.
 */
export async function fetchEditRequests(internId?: string | number): Promise<Array<{
  logId: number
  status: "pending" | "approved" | "rejected"
  requestedTimeIn?: string | null
  requestedTimeOut?: string | null
}>> {
  // Check if we're in a server environment (Node.js) vs browser
  if (typeof window === 'undefined') {
    // Server-side: skip fetching edit requests for now, return empty array
    return []
  }

  try {
    const url = internId 
      ? `/api/admin/time-log-edit-requests?internId=${internId}`
      : "/api/admin/time-log-edit-requests"
    
    const response = await fetch(url, {
      credentials: "include",
    })
    
    if (!response.ok) {
      return []
    }
    
    const data = await response.json()
    const requests = Array.isArray(data) ? data : data.requests || []
    
    return requests.map((req: {
      logId: number
      status: "pending" | "approved" | "rejected"
      requestedTimeIn?: string | null
      requestedTimeOut?: string | null
    }) => ({
      logId: req.logId,
      status: req.status,
      requestedTimeIn: req.requestedTimeIn,
      requestedTimeOut: req.requestedTimeOut
    }))
  } catch (error) {
    console.error("Error fetching edit requests:", error)
    return []
  }
}

/**
 * Calculate comprehensive time statistics with edit request support.
 * This is the main function that should be used across all components for consistent calculations.
 * @param logs Array of time logs.
 * @param internId Optional intern ID to filter.
 * @param options Calculation options.
 * @returns Complete time statistics object.
 */
export async function calculateTimeStatistics(
  logs: Array<{
    id?: number
    time_in?: string | null
    time_out?: string | null
    timeIn?: string | null
    timeOut?: string | null
    status?: string
    user_id?: number | string
    internId?: number | string
    log_type?: string
    overtime_status?: string
  }>,
  internId?: string | number,
  options: {
    includeEditRequests?: boolean
    includeActive?: boolean
    currentTime?: Date
    requiredHours?: number
  } = {}
): Promise<{
  internshipProgress: number
  totalHours: number
  regularHours: number
  overtimeHours: {
    approved: number
    pending: number
    rejected: number
    total: number
  }
  activeHours: number
  progressPercentage: number
  remainingHours: number
  isCompleted: boolean
}> {
  const {
    includeEditRequests = true,
    includeActive = false,
    currentTime = new Date(),
    requiredHours = 0
  } = options

  const editRequests = includeEditRequests ? await fetchEditRequests(internId) : []
  const internshipProgress = calculateInternshipProgress(logs, internId, editRequests)
  const duration = calculateDurationWithEditRequests(
    logs,
    editRequests,
    internId,
    includeActive,
    currentTime
  )

  const progressPercentage = requiredHours > 0 
    ? Math.min((internshipProgress / requiredHours) * 100, 100) 
    : 0
  
  const remainingHours = Math.max(0, requiredHours - internshipProgress)
  const isCompleted = internshipProgress >= requiredHours && requiredHours > 0

  return {
    internshipProgress,
    totalHours: duration.totalHours,
    regularHours: duration.regularHours,
    overtimeHours: duration.overtimeHours,
    activeHours: duration.activeHours,
    progressPercentage,
    remainingHours,
    isCompleted
  }
}

/**
 * Calculate today's duration with real-time accuracy (no truncation until final display).
 * This function provides the most accurate calculation for real-time display.
 * @param logs Array of time logs.
 * @param internId Optional intern ID to filter logs.
 * @param isTimedIn Whether user is currently timed in.
 * @param timeInTimestamp Current session start time.
 * @param isOvertimeIn Whether user is in overtime.
 * @param overtimeInTimestamp Overtime session start time.
 * @param isExtendedOvertimeIn Whether user is in extended overtime.
 * @param extendedOvertimeInTimestamp Extended overtime session start time.
 * @param currentTime Current time for active session calculation.
 * @returns Object with accurate hours and formatted duration.
 */
export function calculateTodayProgressAccurate(
  logs: Array<{
    id?: number
    time_in?: string | null
    time_out?: string | null
    timeIn?: string | null
    timeOut?: string | null
    status?: string
    user_id?: number | string
    internId?: number | string
    log_type?: string
    overtime_status?: string
  }>,
  internId?: string | number,
  isTimedIn: boolean = false,
  timeInTimestamp: Date | null = null,
  isOvertimeIn: boolean = false,
  overtimeInTimestamp: Date | null = null,
  isExtendedOvertimeIn: boolean = false,
  extendedOvertimeInTimestamp: Date | null = null,
  currentTime: Date = new Date()
): {
  regularHours: number
  approvedOvertimeHours: number
  pendingOvertimeHours: number
  rejectedOvertimeHours: number
  totalHours: number
  formattedDuration: string
} {
  const today = getCurrentDateString()
  const filteredLogs = internId 
    ? logs.filter(log => {
        const logDate = log.time_in ? getLocalDateString(log.time_in) : (log.timeIn ? getLocalDateString(log.timeIn) : "")
        return logDate === today && (
          (log.user_id?.toString() === internId.toString()) ||
          (log.internId?.toString() === internId.toString())
        )
      })
    : logs.filter(log => {
        const logDate = log.time_in ? getLocalDateString(log.time_in) : (log.timeIn ? getLocalDateString(log.timeIn) : "")
        return logDate === today
      })

  let regularMs = 0
  let approvedOvertimeMs = 0
  let pendingOvertimeMs = 0
  let rejectedOvertimeMs = 0

  filteredLogs.forEach(log => {
    const timeIn = log.time_in || log.timeIn
    const timeOut = log.time_out || log.timeOut

    if (timeIn && timeOut && (!log.status || log.status === 'completed')) {
      const inDate = new Date(timeIn)
      const outDate = new Date(timeOut)
      const diffMs = outDate.getTime() - inDate.getTime()
      
      if (diffMs > 0) {
        if (log.log_type === 'overtime' || log.log_type === 'extended_overtime') {
          if (log.overtime_status === 'approved') {
            approvedOvertimeMs += diffMs
          } else if (log.overtime_status === 'rejected') {
            rejectedOvertimeMs += diffMs
          } else {
            pendingOvertimeMs += diffMs
          }
        } else {
          regularMs += diffMs
        }
      }
    }
  })

  if (isTimedIn && timeInTimestamp) {
    const sessionEnd = (isExtendedOvertimeIn && extendedOvertimeInTimestamp) ? 
      extendedOvertimeInTimestamp : 
      ((isOvertimeIn && overtimeInTimestamp) ? overtimeInTimestamp : currentTime)
    
    const sessionDuration = sessionEnd.getTime() - timeInTimestamp.getTime()
    if (sessionDuration > 0) {
      const cappedDuration = Math.min(sessionDuration, 24 * 60 * 60 * 1000)
      const availableRegularMs = Math.max(0, (DAILY_REQUIRED_HOURS * 60 * 60 * 1000) - regularMs)
      
      if (cappedDuration <= availableRegularMs) {
        regularMs += cappedDuration
      } else {
        regularMs += availableRegularMs
        const overtimeMs = cappedDuration - availableRegularMs
        pendingOvertimeMs += overtimeMs
      }
    }
  }

  if (isOvertimeIn && overtimeInTimestamp) {
    const sessionDuration = currentTime.getTime() - overtimeInTimestamp.getTime()
    if (sessionDuration > 0) {
      const cappedDuration = Math.min(sessionDuration, 24 * 60 * 60 * 1000)
      pendingOvertimeMs += cappedDuration
    }
  }

  if (isExtendedOvertimeIn && extendedOvertimeInTimestamp) {
    const sessionDuration = currentTime.getTime() - extendedOvertimeInTimestamp.getTime()
    if (sessionDuration > 0) {
      const cappedDuration = Math.min(sessionDuration, 24 * 60 * 60 * 1000)
      pendingOvertimeMs += cappedDuration
    }
  }

  const regularHours = regularMs / (1000 * 60 * 60)
  const approvedOvertimeHours = approvedOvertimeMs / (1000 * 60 * 60)
  const pendingOvertimeHours = pendingOvertimeMs / (1000 * 60 * 60)
  const rejectedOvertimeHours = rejectedOvertimeMs / (1000 * 60 * 60)

  const displayRegularHours = Math.min(regularHours, DAILY_REQUIRED_HOURS)
  const displayTotalHours = displayRegularHours + approvedOvertimeHours

  const totalMinutes = Math.floor(displayTotalHours * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return {
    regularHours,
    approvedOvertimeHours,
    pendingOvertimeHours,
    rejectedOvertimeHours,
    totalHours: displayTotalHours,
    formattedDuration: formatDuration(hours, minutes)
  }
}

/**
 * Calculate accurate session durations for time log table displays.
 * This function provides high-precision calculations without early truncation.
 * @param logs Array of time logs for a specific date/session.
 * @param currentTime Current time for active session calculations.
 * @param previousRegularHours Previously accumulated regular hours for overflow calculation.
 * @returns Object with accurate regular and overtime hours.
 */
export function calculateAccurateSessionDuration(
  logs: Array<{
    id?: number
    time_in?: string | null
    time_out?: string | null
    timeIn?: string | null
    timeOut?: string | null
    status?: string
    log_type?: string
    overtime_status?: string
  }>,
  currentTime: Date = new Date(),
  previousRegularHours: number = 0
): {
  regularHours: number
  overtimeHours: number
  overtimeStatus: "approved" | "pending" | "rejected" | "none"
  isActive: boolean
} {
  let totalSessionMs = 0
  let overtimeStatus: "approved" | "pending" | "rejected" | "none" = "none"
  let isActive = false

  logs.forEach(log => {
    const timeIn = log.time_in || log.timeIn
    const timeOut = log.time_out || log.timeOut

    if (timeIn) {
      if (timeOut && (!log.status || log.status === 'completed')) {
        const inDate = new Date(timeIn)
        const outDate = new Date(timeOut)
        const diffMs = outDate.getTime() - inDate.getTime()
        if (diffMs > 0) {
          totalSessionMs += diffMs
        }
      } else if (!timeOut && log.status === 'pending') {
        const inDate = new Date(timeIn)
        const diffMs = currentTime.getTime() - inDate.getTime()
        if (diffMs > 0) {
          const cappedMs = Math.min(diffMs, 24 * 60 * 60 * 1000)
          totalSessionMs += cappedMs
          isActive = true
        }
      }

      if (log.log_type === 'overtime' || log.log_type === 'extended_overtime') {
        if (log.overtime_status === 'approved') {
          overtimeStatus = 'approved'
        } else if (log.overtime_status === 'rejected') {
          overtimeStatus = 'rejected'
        } else if (overtimeStatus === 'none') {
          overtimeStatus = 'pending'
        }
      }
    }
  })

  const totalSessionHours = totalSessionMs / (1000 * 60 * 60)
  const dailyLimitMs = DAILY_REQUIRED_HOURS * 60 * 60 * 1000
  const previousRegularMs = previousRegularHours * 60 * 60 * 1000
  const availableRegularMs = Math.max(0, dailyLimitMs - previousRegularMs)
  
  let regularHours = 0
  let overtimeHours = 0

  if (totalSessionMs <= availableRegularMs) {
    regularHours = totalSessionHours
    overtimeHours = 0
  } else {
    regularHours = availableRegularMs / (1000 * 60 * 60)
    overtimeHours = (totalSessionMs - availableRegularMs) / (1000 * 60 * 60)
  }

  if (overtimeStatus !== 'none' && overtimeStatus === 'rejected') {
    overtimeHours = 0
    regularHours = Math.min(regularHours, availableRegularMs / (1000 * 60 * 60))
  }

  return {
    regularHours,
    overtimeHours,
    overtimeStatus,
    isActive
  }
}

/**
 * Calculate session duration for display purposes - shows actual time worked
 * regardless of overtime approval status (for DTR display only).
 * @param logs Array of time logs for the session.
 * @param currentTime Current time for active session calculations.
 * @param previousRegularHours Previously accumulated regular hours for overflow calculation.
 * @returns Object with accurate regular and overtime hours WITHOUT status adjustments.
 */
export function calculateRawSessionDuration(
  logs: Array<{
    id?: number
    time_in?: string | null
    time_out?: string | null
    timeIn?: string | null
    timeOut?: string | null
    status?: string
    log_type?: string
    overtime_status?: string
  }>,
  currentTime: Date = new Date(),
  previousRegularHours: number = 0
): {
  regularHours: number
  overtimeHours: number
  overtimeStatus: "approved" | "pending" | "rejected" | "none"
  isActive: boolean
} {
  let totalSessionMs = 0
  let overtimeStatus: "approved" | "pending" | "rejected" | "none" = "none"
  let isActive = false

  logs.forEach(log => {
    const timeIn = log.time_in || log.timeIn
    const timeOut = log.time_out || log.timeOut

    if (timeIn) {
      if (timeOut && (!log.status || log.status === 'completed')) {
        const inDate = new Date(timeIn)
        const outDate = new Date(timeOut)
        const diffMs = outDate.getTime() - inDate.getTime()
        if (diffMs > 0) {
          totalSessionMs += diffMs
        }
      } else if (!timeOut && log.status === 'pending') {
        const inDate = new Date(timeIn)
        const diffMs = currentTime.getTime() - inDate.getTime()
        if (diffMs > 0) {
          const cappedMs = Math.min(diffMs, 24 * 60 * 60 * 1000)
          totalSessionMs += cappedMs
          isActive = true
        }
      }

      if (log.log_type === 'overtime' || log.log_type === 'extended_overtime') {
        if (log.overtime_status === 'approved') {
          overtimeStatus = 'approved'
        } else if (log.overtime_status === 'rejected') {
          overtimeStatus = 'rejected'
        } else if (overtimeStatus === 'none') {
          overtimeStatus = 'pending'
        }
      }
    }
  })

  const totalSessionHours = totalSessionMs / (1000 * 60 * 60)
  const dailyLimitMs = DAILY_REQUIRED_HOURS * 60 * 60 * 1000
  const previousRegularMs = previousRegularHours * 60 * 60 * 1000
  const availableRegularMs = Math.max(0, dailyLimitMs - previousRegularMs)
  
  let regularHours = 0
  let overtimeHours = 0

  if (totalSessionMs <= availableRegularMs) {
    regularHours = totalSessionHours
    overtimeHours = 0
  } else {
    regularHours = availableRegularMs / (1000 * 60 * 60)
    overtimeHours = (totalSessionMs - availableRegularMs) / (1000 * 60 * 60)
  }

  return {
    regularHours,
    overtimeHours,
    overtimeStatus,
    isActive
  }
}

/**
 * Format hours to display format (Xh XXm) with accurate precision.
 * Only truncates at the final display step.
 * @param hours Number of hours.
 * @returns Formatted string.
 */
export function formatAccurateHours(hours: number): string {
  const totalMinutes = Math.floor(hours * 60)
  const displayHours = Math.floor(totalMinutes / 60)
  const displayMinutes = totalMinutes % 60
  return formatDuration(displayHours, displayMinutes)
}

/**
 * Truncates a Date or ISO string to minute precision for consistent time storage.
 * 
 * This utility function ensures all time values are stored with minute precision
 * by setting seconds and milliseconds to zero. This prevents timestamp precision
 * issues and maintains consistency across the application.
 * 
 * @param date Date object or ISO string to truncate
 * @returns ISO string truncated to minute precision
 * @throws Error if the provided date is invalid
 */
export function truncateToMinute(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${date}`)
  }
  d.setSeconds(0, 0)
  return d.toISOString()
}
