import type {
  UserWithDetails,
  TimeLog,
  TimeLogWithDetails,
  UserProfile,
  Project,
  InternProjectAssignment,
  User,
  Department,
  School,
  InternshipProgram,
} from "./database"
import { sql } from "./database"
import { calculateInternshipProgress, calculateTimeWorked, DAILY_REQUIRED_HOURS, MAX_OVERTIME_HOURS } from "./time-utils"

/**
 * Data access layer for InternHQ application.
 * Provides functions for user, project, and time log operations.
 */

// --- Project Operations ---

/**
 * Retrieves a project by its ID
 */
async function getProjectById(projectId: number): Promise<Project | null> {
  const res = await sql`SELECT * FROM projects WHERE id = ${projectId}`
  return res.length === 0 ? null : (res[0] as Project)
}

// --- User Operations ---

/**
 * Fetches comprehensive user details including profile, internship, and projects
 */
export async function getUserWithDetails(userId: string): Promise<UserWithDetails | null> {
  try {
    const userIdNum = Number(userId)
    
    // Fetch user data
    const userRes = await sql`
      SELECT id, email, first_name, last_name, role, work_schedule, created_at, updated_at
      FROM users
      WHERE id = ${userIdNum}
    `
    if (userRes.length === 0) return null
    const user = userRes[0] as User

    // Fetch user profile
    const profileRes = await sql`
      SELECT * FROM user_profiles WHERE user_id = ${userIdNum}
    `
    const profile = profileRes.length > 0 ? (profileRes[0] as UserProfile) : undefined

    // Fetch internship details with related data
    const internshipRes = await sql`
      SELECT ip.*, 
             s.id as school_id, s.name AS school_name, 
             d.id as department_id, d.name AS department_name,
             sup.id as supervisor_id, sup.first_name AS supervisor_first_name, sup.last_name AS supervisor_last_name
      FROM internship_programs ip
      LEFT JOIN schools s ON ip.school_id = s.id
      LEFT JOIN departments d ON ip.department_id = d.id
      LEFT JOIN supervisors sup ON ip.supervisor_id = sup.id
      WHERE ip.user_id = ${userIdNum}
      ORDER BY ip.created_at DESC
      LIMIT 1
    `
    
    let internship: (InternshipProgram & { school: School; department: Department; supervisor_name?: string }) | undefined = undefined
    if (internshipRes.length > 0) {
      const row = internshipRes[0]
      internship = {
        id: row.id,
        user_id: row.user_id,
        school_id: row.school_id,
        department_id: row.department_id,
        required_hours: row.required_hours,
        start_date: row.start_date,
        end_date: row.end_date,
        supervisor_id: row.supervisor_id,
        supervisor_name: row.supervisor_first_name && row.supervisor_last_name
          ? `${row.supervisor_first_name} ${row.supervisor_last_name}`
          : "",
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        school: { 
          id: row.school_id, 
          name: row.school_name, 
          created_at: "", 
          address: undefined, 
          contact_email: undefined, 
          contact_phone: undefined 
        },
        department: { 
          id: row.department_id, 
          name: row.department_name, 
          created_at: "", 
          description: undefined, 
          supervisor_id: row.supervisor_id 
        },
      }
    }

    // Calculate completed hours using centralized function
    const allLogsRes = await sql<Array<{
      time_in: string | null
      time_out: string | null
      status: string
    }>>`
      SELECT time_in, time_out, status
      FROM time_logs
      WHERE user_id = ${userIdNum} AND time_in IS NOT NULL AND time_out IS NOT NULL
    `
    const completedHours = calculateInternshipProgress(allLogsRes)

    // Get today's status
    const today = new Date().toISOString().split("T")[0]
    const todayLogRes = await sql`
      SELECT * FROM time_logs WHERE user_id = ${userIdNum} AND time_in::date = ${today}
    `
    let todayStatus: "in" | "out" = "out"
    if (todayLogRes.length > 0 && todayLogRes[0].time_in && !todayLogRes[0].time_out) {
      todayStatus = "in"
    }

    // Get assigned projects
    const projects = await getInternProjects(userId)

    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      work_schedule: user.work_schedule,
      created_at: user.created_at,
      updated_at: user.updated_at,
      profile,
      internship,
      completedHours,
      todayStatus,
      projects,
    }
  } catch (error) {
    console.error("Error fetching user with details:", error)
    return null
  }
}

// --- Time Log Operations ---

/**
 * Clock in a user (automatically determines if should be regular or overtime based on hours already worked today)
 */
export async function clockIn(userId: string, time?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userIdNum = Number(userId)
    
    // Check if user already has an active clock-in
    const existing = await sql`
      SELECT * FROM time_logs
      WHERE user_id = ${userIdNum} AND status = 'pending'
    `
    if (existing.length > 0) {
      return { success: false, error: "You are already clocked in. Please clock out before clocking in again." }
    }
    
    // Check how many hours user has already worked today to determine if this should be overtime
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    
    const todayLogs = await sql`
      SELECT * FROM time_logs
      WHERE user_id = ${userIdNum} 
        AND time_in >= ${todayStart.toISOString()}
        AND time_in < ${todayEnd.toISOString()}
        AND status = 'completed'
        AND time_out IS NOT NULL
    `
    
    // Calculate total hours worked today
    let totalHoursToday = 0
    todayLogs.forEach((log) => {
      if (log.time_in && log.time_out) {
        const timeIn = new Date(log.time_in)
        const timeOut = new Date(log.time_out)
        const diffMs = timeOut.getTime() - timeIn.getTime()
        totalHoursToday += diffMs / (1000 * 60 * 60)
      }
    })
    
    // Determine log type: regular, overtime, or extended overtime based on hours worked
    let logType: string
    let overtimeStatus: string | null = null
    
    if (totalHoursToday < DAILY_REQUIRED_HOURS) {
      logType = 'regular'
    } else if (totalHoursToday < DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) {
      logType = 'overtime'
      overtimeStatus = 'pending'
    } else {
      logType = 'extended_overtime'
      overtimeStatus = 'pending'
    }
    
    // Truncate time to minute
    const timeToUse = time ? truncateToMinute(time) : sql`date_trunc('minute', NOW())`
    
    // Clock in with appropriate log type
    await sql`
      INSERT INTO time_logs (
        user_id, time_in, status, log_type, overtime_status, created_at, updated_at
      )
      VALUES (
        ${userIdNum}, 
        ${timeToUse}, 
        'pending', 
        ${logType},
        ${overtimeStatus},
        NOW(), 
        NOW()
      )
    `
    return { success: true }
  } catch (error) {
    console.error("Error clocking in:", error)
    return { success: false, error: "Failed to clock in" }
  }
}

/**
 * Clock out a user (handles both regular and overtime logs)
 */
export async function clockOut(userId: string, time?: string, discardOvertime?: boolean, overtimeNote?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userIdNum = Number(userId)
    
    // Get the active log to check duration
    const activeLog = await sql`
      SELECT * FROM time_logs
      WHERE user_id = ${userIdNum} AND status = 'pending' AND time_out IS NULL
      ORDER BY time_in DESC
      LIMIT 1
    `
    
    if (activeLog.length === 0) {
      return { success: false, error: "No active clock-in found" }
    }
    
    const log = activeLog[0]
    const timeIn = new Date(log.time_in)
    // Truncate timeOut to minute
    const timeOut = time ? new Date(time) : new Date()
    timeOut.setSeconds(0, 0)
    // Calculate total hours for this session
    const totalHours = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60)
    
    // Handle based on the log type
    if (log.log_type === 'overtime' || log.log_type === 'extended_overtime') {
      // For overtime and extended overtime logs, just complete them as-is
      await sql`
        UPDATE time_logs
        SET time_out = ${truncateToMinute(timeOut)}, 
            status = 'completed',
            updated_at = NOW()
        WHERE id = ${log.id}
      `
    } else {
      // For regular logs
      if (discardOvertime) {
        // User wants to discard overtime - cut at 9 hours and delete any existing overtime logs for today
        console.log('Discarding overtime - cutting regular log at 9 hours and deleting overtime logs')
        
        // Calculate cutoff time (9 hours from start)
        const regularCutoff = new Date(timeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
        regularCutoff.setSeconds(0, 0)
        
        // Use the timeIn date to determine "today" for deleting any existing overtime logs
        const today = timeIn.toISOString().split('T')[0] // Get YYYY-MM-DD format
        const todayStart = `${today}T00:00:00.000Z`
        const todayEnd = `${today}T23:59:59.999Z`
        
        console.log(`Cutting regular log at ${regularCutoff.toISOString()} and deleting overtime logs for user ${userId} on ${today}`)
        
        await sql.begin(async (tx) => {
          // Update the regular log to end at exactly 9 hours
          await tx`
            UPDATE time_logs
            SET time_out = ${truncateToMinute(regularCutoff)}, 
                status = 'completed', 
                log_type = 'regular',
                updated_at = NOW()
            WHERE id = ${log.id}
          `
          
          // Delete any existing overtime and extended overtime logs for today
          const deleteResult = await tx`
            DELETE FROM time_logs
            WHERE user_id = ${Number(userId)} 
              AND (log_type = 'overtime' OR log_type = 'extended_overtime')
              AND time_in >= ${todayStart}
              AND time_in <= ${todayEnd}
            RETURNING id
          `
          
          console.log(`Regular log cut to 9 hours. Deleted ${deleteResult.length} overtime logs with IDs:`, deleteResult.map(r => r.id))
        })
      } else if (totalHours > DAILY_REQUIRED_HOURS) {
        // Overtime scenario - split the log into regular, overtime, and potentially extended overtime
        const regularCutoff = new Date(timeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
        const overtimeCutoff = new Date(timeIn.getTime() + ((DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) * 60 * 60 * 1000))
        regularCutoff.setSeconds(0, 0)
        overtimeCutoff.setSeconds(0, 0)
        
        const hasExtendedOvertime = totalHours > (DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS)
        
        // Begin transaction for atomic operation
        await sql.begin(async (tx) => {
          // Update the original log to be regular time (first 9 hours)
          await tx`
            UPDATE time_logs
            SET time_out = ${truncateToMinute(regularCutoff)}, 
                status = 'completed', 
                log_type = 'regular',
                updated_at = NOW()
            WHERE id = ${log.id}
          `
          
          if (hasExtendedOvertime) {
            // Create overtime log (9-12 hours)
            await tx`
              INSERT INTO time_logs (
                user_id, time_in, time_out, status, 
                log_type, overtime_status, notes, created_at, updated_at
              )
              VALUES (
                ${Number(userId)}, 
                ${truncateToMinute(regularCutoff)}, 
                ${truncateToMinute(overtimeCutoff)}, 
                'completed', 
                'overtime', 
                'pending',
                ${overtimeNote || null}, 
                ${log.created_at}, 
                NOW()
              )
            `
            
            // Create extended overtime log (12+ hours)
            await tx`
              INSERT INTO time_logs (
                user_id, time_in, time_out, status, 
                log_type, overtime_status, notes, created_at, updated_at
              )
              VALUES (
                ${Number(userId)}, 
                ${truncateToMinute(overtimeCutoff)}, 
                ${truncateToMinute(timeOut)}, 
                'completed', 
                'extended_overtime', 
                'pending',
                ${overtimeNote || null}, 
                ${log.created_at}, 
                NOW()
              )
            `
          } else {
            // Create only overtime log (9-12 hours)
            await tx`
              INSERT INTO time_logs (
                user_id, time_in, time_out, status, 
                log_type, overtime_status, notes, created_at, updated_at
              )
              VALUES (
                ${Number(userId)}, 
                ${truncateToMinute(regularCutoff)}, 
                ${truncateToMinute(timeOut)}, 
                'completed', 
                'overtime', 
                'pending',
                ${overtimeNote || null}, 
                ${log.created_at}, 
                NOW()
              )
            `
          }
        })
      } else {
        // For logs <= 9 hours, just complete them normally as regular
        await sql`
          UPDATE time_logs
          SET time_out = ${truncateToMinute(timeOut)}, 
              status = 'completed', 
              log_type = 'regular',
              updated_at = NOW()
          WHERE id = ${log.id}
        `
      }
    }
    
    return { success: true }
  } catch (error) {
    console.error("Error clocking out:", error)
    return { success: false, error: "Failed to clock out" }
  }
}

/**
 * Retrieves all time logs for a specific user
 */
export async function getTimeLogsForUser(userId: string, logType: "regular" | "overtime" | null = null): Promise<TimeLog[]> {
  try {
    const userIdNum = Number(userId)
    const res = logType
      ? await sql`SELECT * FROM time_logs WHERE user_id = ${userIdNum} AND log_type = ${logType} ORDER BY time_in DESC`
      : await sql`SELECT * FROM time_logs WHERE user_id = ${userIdNum} ORDER BY time_in DESC`
    return res.map(row => ({
      id: row.id,
      user_id: row.user_id,
      time_in: row.time_in,
      time_out: row.time_out,
      notes: row.notes,
      status: row.status,
      log_type: row.log_type,
      overtime_status: row.overtime_status,
      approved_by: row.approved_by,
      approved_at: row.approved_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })) as TimeLog[]
  } catch (error) {
    console.error("Error fetching time logs:", error)
    return []
  }
}

/**
 * Retrieves today's time log for a specific user and log type
 */
export async function getTodayTimeLog(userId: string, logType: "regular" | "overtime" = "regular"): Promise<TimeLog | null> {
  try {
    const userIdNum = Number(userId)
    const today = new Date().toISOString().split("T")[0]
    const res = await sql`
      SELECT * FROM time_logs
      WHERE user_id = ${userIdNum} AND time_in::date = ${today} AND log_type = ${logType}
      ORDER BY time_in DESC
      LIMIT 1
    `
    if (res.length > 0) {
      const row = res[0]
      return {
        id: row.id,
        user_id: row.user_id,
        time_in: row.time_in,
        time_out: row.time_out,
        notes: row.notes,
        status: row.status,
        log_type: row.log_type,
        overtime_status: row.overtime_status,
        approved_by: row.approved_by,
        approved_at: row.approved_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      } as TimeLog
    }
    return null
  } catch (error) {
    console.error("Error fetching today time log:", error)
    return null
  }
}

// --- Intern-Project Assignment Operations ---

/**
 * Retrieves all projects assigned to a specific intern
 */
export async function getInternProjects(userId: string): Promise<(InternProjectAssignment & { project: Project })[]> {
  try {
    const userIdNum = Number(userId)
    const assignmentsRes = await sql`
      SELECT * FROM intern_project_assignments WHERE user_id = ${userIdNum}
    `
    const assignments = assignmentsRes.map(row => ({
      id: row.id,
      user_id: row.user_id,
      project_id: row.project_id,
      assigned_date: row.assigned_date,
      role: row.role,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })) as InternProjectAssignment[]

    const result: (InternProjectAssignment & { project: Project })[] = []
    for (const assignment of assignments) {
      const project = await getProjectById(assignment.project_id)
      result.push({
        ...assignment,
        project: project || {
          id: assignment.project_id,
          name: "Unknown Project",
          description: "",
          start_date: "",
          end_date: "",
          status: "active",
          department_id: 0,
          created_at: "",
          updated_at: "",
        },
      })
    }
    return result
  } catch (error) {
    console.error("Error fetching intern projects:", error)
    return []
  }
}

/**
 * Deletes an intern user and all associated data
 */
export async function deleteIntern(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userIdNum = Number(userId)
    const userRes = await sql`SELECT * FROM users WHERE id = ${userIdNum}`
    if (userRes.length === 0) {
      return { success: false, error: "Intern not found" }
    }
    if ((userRes[0] as User).role !== "intern") {
      return { success: false, error: "User is not an intern" }
    }
    await sql`DELETE FROM users WHERE id = ${userIdNum}`
    return { success: true }
  } catch (error) {
    console.error("Error deleting intern:", error)
    return { success: false, error: "Failed to delete intern" }
  }
}

/**
 * Updates user profile and internship information
 */
export async function updateUserProfile(
  userId: string,
  profileData: {
    firstName: string
    lastName: string
    email: string
    phone?: string
    address?: string
    city?: string
    country?: string
    zipCode?: string
    dateOfBirth?: string | Date
    bio?: string
    degree?: string
    gpa?: number | string
    graduationDate?: string | Date
    skills?: string[] // <-- should be array
    interests?: string[]
    languages?: string[]
    emergencyContactName?: string
    emergencyContactRelation?: string
    emergencyContactPhone?: string
    startDate?: string | Date
    endDate?: string | Date
    requiredHours?: number | string
    supervisorId?: number | string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const userIdNum = Number(userId)
    const toDateString = (val: unknown) => {
      if (!val) return null
      if (val instanceof Date) return val.toISOString().slice(0, 10)
      if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val
      const d = new Date(val as string)
      return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
    }

    // Fetch current user to compare email
    const currentUserRes = await sql`SELECT email FROM users WHERE id = ${userIdNum}`
    if (currentUserRes.length === 0) {
      return { success: false, error: "User not found" }
    }
    const currentEmail = currentUserRes[0].email

    // Only update email if it has changed
    if (profileData.email && profileData.email !== currentEmail) {
      // Check if new email already exists for another user
      const emailExists = await sql`SELECT id FROM users WHERE email = ${profileData.email} AND id != ${userIdNum}`
      if (emailExists.length > 0) {
        return { success: false, error: "Email already exists" }
      }
      await sql`
        UPDATE users
        SET first_name = ${profileData.firstName},
            last_name = ${profileData.lastName},
            email = ${profileData.email},
            updated_at = NOW()
        WHERE id = ${userIdNum}
      `
    } else {
      await sql`
        UPDATE users
        SET first_name = ${profileData.firstName},
            last_name = ${profileData.lastName},
            updated_at = NOW()
        WHERE id = ${userIdNum}
      `
    }

    // Convert arrays to Postgres arrays
    const toPgArray = (val: unknown) =>
      Array.isArray(val) ? val : typeof val === "string" && val ? [val] : []

    // Ensure user_profiles row exists (atomic upsert)
    await sql`
      INSERT INTO user_profiles (user_id)
      VALUES (${userIdNum})
      ON CONFLICT (user_id) DO NOTHING
    `

    await sql`
      UPDATE user_profiles
      SET
        phone = ${profileData.phone ?? ""},
        address = ${profileData.address ?? ""},
        city = ${profileData.city ?? ""},
        country = ${profileData.country ?? ""},
        zip_code = ${profileData.zipCode ?? ""},
        date_of_birth = ${toDateString(profileData.dateOfBirth)},
        bio = ${profileData.bio ?? ""},
        degree = ${profileData.degree ?? ""},
        gpa = ${profileData.gpa !== undefined && profileData.gpa !== null ? Number(profileData.gpa) : null},
        graduation_date = ${toDateString(profileData.graduationDate)},
        skills = ${toPgArray(profileData.skills)},
        interests = ${toPgArray(profileData.interests)},
        languages = ${toPgArray(profileData.languages)},
        emergency_contact_name = ${profileData.emergencyContactName ?? ""},
        emergency_contact_relation = ${profileData.emergencyContactRelation ?? ""},
        emergency_contact_phone = ${profileData.emergencyContactPhone ?? ""},
        updated_at = NOW()
      WHERE user_id = ${userIdNum}
    `

    await sql`
      UPDATE internship_programs
      SET
        start_date = ${toDateString(profileData.startDate)},
        end_date = ${toDateString(profileData.endDate)},
        required_hours = ${profileData.requiredHours ? Number(profileData.requiredHours) : 0},
        supervisor_id = ${profileData.supervisorId ? Number(profileData.supervisorId) : null},
        updated_at = NOW()
      WHERE user_id = ${userIdNum}
    `

    return { success: true }
  } catch (error) {
    console.error("Error updating user profile:", error)
    return { success: false, error: "Failed to update profile" }
  }
}

// --- Time Log Details ---

// Get all time logs with user, department, and school details
export async function getAllTimeLogsWithDetails(): Promise<TimeLogWithDetails[]> {
  const rows = await sql`
    SELECT
      tl.id,
      tl.user_id,
      tl.time_in,
      tl.time_out,
      tl.status,
      tl.log_type,
      tl.overtime_status,
      tl.created_at,
      tl.updated_at,
      u.first_name,
      u.last_name,
      u.email,
      u.role,
      u.created_at as user_created_at,
      u.updated_at as user_updated_at,
      d.name AS department,
      s.name AS school
    FROM time_logs tl
    LEFT JOIN users u ON tl.user_id = u.id
    LEFT JOIN internship_programs ip ON ip.user_id = u.id
    LEFT JOIN departments d ON ip.department_id = d.id
    LEFT JOIN schools s ON ip.school_id = s.id
    ORDER BY tl.time_in DESC
  `

  return rows.map(row => ({
    id: row.id,
    internId: row.user_id,
    internName: `${row.first_name} ${row.last_name}`,
    user_id: row.user_id,
    user: {
      id: row.user_id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      role: row.role,
      created_at: row.user_created_at,
      updated_at: row.user_updated_at,
      department: row.department || "",
      school: row.school || "",
    },
    timeIn: row.time_in,
    timeOut: row.time_out,
    status: row.status,
    log_type: row.log_type,
    overtime_status: row.overtime_status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    duration: row.time_in && row.time_out
      ? calculateDuration(row.time_in, row.time_out)
      : null,
    hoursWorked: row.time_in && row.time_out
      ? calculateHours(row.time_in, row.time_out)
      : 0,
    department: row.department || "",
    school: row.school || "",
  })) as TimeLogWithDetails[]
}

// --- Helper Functions ---

// These functions are now deprecated - use calculateTimeWorked from time-utils.ts instead
// Kept for backward compatibility but should be replaced with centralized functions

function calculateDuration(timeIn: string, timeOut: string) {
  const result = calculateTimeWorked(timeIn, timeOut)
  return result.duration
}

function calculateHours(timeIn: string, timeOut: string) {
  const result = calculateTimeWorked(timeIn, timeOut)
  return result.hoursWorked
}

// --- Intern List ---

// Get all interns with today's logs and internship details
export async function getAllInterns() {
  const today = new Date().toISOString().split("T")[0]
  const result = await sql<{
    id: number
    first_name: string
    last_name: string
    email: string
    role: string
    required_hours: number
    start_date: Date | null
    end_date: Date | null
    department: string | null
    school: string | null
  }[]>`
    SELECT
      u.id,
      u.first_name,
      u.last_name,
      u.email,
      u.role,
      ip.required_hours,
      ip.start_date,
      ip.end_date,
      d.name AS department,
      s.name AS school
    FROM users u
    LEFT JOIN internship_programs ip ON ip.user_id = u.id
    LEFT JOIN departments d ON ip.department_id = d.id
    LEFT JOIN schools s ON ip.school_id = s.id
    WHERE u.role = 'intern'
    ORDER BY u.id ASC
  `

  type TimeLogRow = {
    time_in: Date | null
    time_out: Date | null
    status: string
  }

  const interns = await Promise.all(result.map(async (row) => {
    // Get all completed logs for this intern
    const allLogsRes = await sql<Array<{
      time_in: string | null
      time_out: string | null
      status: string
    }>>`
      SELECT time_in, time_out, status
      FROM time_logs
      WHERE user_id = ${row.id} AND time_in IS NOT NULL AND time_out IS NOT NULL
    `
    
    // Use centralized calculation for consistent progress tracking
    const completedHours = calculateInternshipProgress(allLogsRes, row.id)

    // Get all today's logs
    const todayLogRes = await sql<TimeLogRow[]>`
      SELECT time_in, time_out, status
      FROM time_logs
      WHERE user_id = ${row.id} AND time_in::date = ${today}
      ORDER BY time_in ASC
    `

    // Collect all today's logs as an array
    const todayLogs = todayLogRes.map((log) => ({
      timeIn: log.time_in,
      timeOut: log.time_out,
      status: log.status,
      label: log.time_in && log.time_out
        ? `Clocked in at ${new Date(log.time_in!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}, Clocked out at ${new Date(log.time_out!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : log.time_in
          ? `Clocked in at ${new Date(log.time_in!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : log.time_out
            ? `Clocked out at ${new Date(log.time_out!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : ""
    }))

    // Calculate today's total hours
    let todayHours = 0
    for (const log of todayLogRes) {
      if (log.time_in && log.time_out) {
        const inDate = new Date(log.time_in)
        const outDate = new Date(log.time_out)
        const diffMs = outDate.getTime() - inDate.getTime()
        todayHours += diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0
      }
    }
    todayHours = Number(todayHours.toFixed(2))

    // Determine current status and last activity
    let status: "in" | "out" = "out"
    let lastActivity = ""
    if (todayLogRes.length > 0) {
      const lastLog = todayLogRes[todayLogRes.length - 1]
      if (lastLog.status === "pending" && lastLog.time_in && !lastLog.time_out) {
        status = "in"
      } else if (lastLog.status === "completed" && lastLog.time_out) {
        status = "out"
      }
      lastActivity = todayLogs.length > 0 ? todayLogs[todayLogs.length - 1].label : ""
    }

    return {
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      department: row.department || "",
      school: row.school || "",
      todayHours,
      status,
      timeIn: todayLogRes.length > 0 ? todayLogRes[0].time_in : null,
      timeOut: todayLogRes.length > 0 ? todayLogRes[0].time_out : null,
      lastActivity,
      todayLogs,
      internshipDetails: {
        requiredHours: row.required_hours || 0,
        completedHours,
        startDate: row.start_date ? row.start_date.toISOString().slice(0, 10) : "",
        endDate: row.end_date ? row.end_date.toISOString().slice(0, 10) : "",
      }
    }
}))

  return interns
}

// --- Intern Creation ---

// Create a new intern, school, and department if needed
export async function createIntern(data: {
  firstName: string
  lastName: string
  email: string
  password?: string
  school: string
  department: string
  requiredHours: number
  startDate: string
  endDate: string
}) {
  try {
    const first_name = data.firstName.trim()
    const last_name = data.lastName.trim()
    const password = data.password || "intern123"

    // Check if user already exists
    const existing = await sql`SELECT id FROM users WHERE email = ${data.email}`
    if (existing.length > 0) {
      return { success: false, error: "Email already exists" }
    }

    // Find or create school
    const schoolRes = await sql`SELECT id FROM schools WHERE name = ${data.school}`
    let schoolId: number
    if (schoolRes.length === 0) {
      const insertSchool = await sql`
        INSERT INTO schools (name) VALUES (${data.school}) RETURNING id
      `
      schoolId = insertSchool[0].id
    } else {
      schoolId = schoolRes[0].id
    }

    // Find or create department
    const deptRes = await sql`SELECT id FROM departments WHERE name = ${data.department}`
    let deptId: number
    if (deptRes.length === 0) {
      const insertDept = await sql`
        INSERT INTO departments (name) VALUES (${data.department}) RETURNING id
      `
      deptId = insertDept[0].id
    } else {
      deptId = deptRes[0].id
    }

    // Insert user
    const userRes = await sql`
      INSERT INTO users (email, password_hash, first_name, last_name, role)
      VALUES (
        ${data.email},
        crypt(${password}, gen_salt('bf')),
        ${first_name},
        ${last_name},
        'intern'
      )
      RETURNING id
    `
    const userId = userRes[0].id

    // Insert internship_programs
    await sql`
      INSERT INTO internship_programs (
        user_id, school_id, department_id, required_hours, start_date, end_date
      ) VALUES (
        ${userId},
        ${schoolId},
        ${deptId},
        ${Number(data.requiredHours)},
        ${data.startDate ?? ""},
        ${data.endDate ?? ""}
      )
    `

    return { success: true, intern: { id: userId, email: data.email, first_name, last_name } }
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("Error creating intern:", error)
    return { success: false, error: err.message || "Failed to create intern" }
  }
}

/**
 * Updates a time log entry (admin only)
 */
export async function updateTimeLog(timeLogId: number, updates: {
  time_in?: string
  time_out?: string
  notes?: string
  status?: "pending" | "completed"
  log_type?: "regular" | "overtime"
}): Promise<{ success: boolean; error?: string }> {
  try {
    const updateFields: string[] = []
    const updateValues: (string | number)[] = []
    let paramCount = 1

    if (updates.time_in !== undefined) {
      updateFields.push(`time_in = $${paramCount}`)
      updateValues.push(truncateToMinute(updates.time_in))
      paramCount++
    }

    if (updates.time_out !== undefined) {
      updateFields.push(`time_out = $${paramCount}`)
      updateValues.push(truncateToMinute(updates.time_out))
      paramCount++
    }

    if (updates.notes !== undefined) {
      updateFields.push(`notes = $${paramCount}`)
      updateValues.push(updates.notes)
      paramCount++
    }

    if (updates.status !== undefined) {
      updateFields.push(`status = $${paramCount}`)
      updateValues.push(updates.status)
      paramCount++
    }

    if (updates.log_type !== undefined) {
      updateFields.push(`log_type = $${paramCount}`)
      updateValues.push(updates.log_type)
      paramCount++
    }

    if (updateFields.length === 0) {
      return { success: false, error: "No updates provided" }
    }

    updateFields.push(`updated_at = NOW()`)
    updateValues.push(timeLogId)

    const query = `
      UPDATE time_logs 
      SET ${updateFields.join(", ")}
      WHERE id = $${paramCount}
      RETURNING *
    `

    const res = await sql.unsafe(query, updateValues)

    if (res.length === 0) {
      return { success: false, error: "Time log not found" }
    }

    return { success: true }
  } catch (error) {
    console.error("Error updating time log:", error)
    return { success: false, error: "Failed to update time log" }
  }
}

/**
 * Deletes a time log entry (admin only)
 */
export async function deleteTimeLog(timeLogId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await sql`
      DELETE FROM time_logs 
      WHERE id = ${timeLogId}
      RETURNING id
    `

    if (res.length === 0) {
      return { success: false, error: "Time log not found" }
    }

    return { success: true }
  } catch (error) {
    console.error("Error deleting time log:", error)
    return { success: false, error: "Failed to delete time log" }
  }
}

/**
 * Get all overtime logs for approval (admin only)
 */
export async function getOvertimeLogsForApproval(): Promise<TimeLogWithDetails[]> {
  const rows = await sql`
    SELECT
      tl.id,
      tl.user_id,
      tl.time_in,
      tl.time_out,
      tl.status,
      tl.log_type,
      tl.overtime_status,
      tl.approved_by,
      tl.approved_at,
      tl.notes,
      tl.created_at,
      tl.updated_at,
      u.first_name,
      u.last_name,
      u.email,
      u.role,
      u.created_at as user_created_at,
      u.updated_at as user_updated_at,
      d.name AS department,
      s.name AS school,
      approver.first_name as approver_first_name,
      approver.last_name as approver_last_name
    FROM time_logs tl
    LEFT JOIN users u ON tl.user_id = u.id
    LEFT JOIN users approver ON tl.approved_by = approver.id
    LEFT JOIN internship_programs ip ON ip.user_id = u.id
    LEFT JOIN departments d ON ip.department_id = d.id
    LEFT JOIN schools s ON ip.school_id = s.id
    WHERE (tl.log_type = 'overtime' OR tl.log_type = 'extended_overtime') AND tl.status = 'completed'
    ORDER BY tl.created_at DESC
  `

  return rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    time_in: row.time_in,
    time_out: row.time_out,
    status: row.status,
    log_type: row.log_type,
    overtime_status: row.overtime_status || 'pending',
    approved_by: row.approved_by,
    approved_at: row.approved_at,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user: {
      id: row.user_id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      role: row.role,
      created_at: row.user_created_at,
      updated_at: row.user_updated_at,
      department: row.department || "",
      school: row.school || "",
    },
    department: row.department || "",
    school: row.school || "",
    approver_name: row.approver_first_name && row.approver_last_name 
      ? `${row.approver_first_name} ${row.approver_last_name}`
      : null,
  })) as TimeLogWithDetails[]
}

/**
 * Approve or reject overtime log (admin only)
 */
export async function updateOvertimeStatus(
  timeLogId: number, 
  status: "approved" | "rejected" | "pending", 
  adminId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    let updateQuery
    
    if (status === "pending") {
      // When reverting to pending, clear approval data
      updateQuery = sql`
        UPDATE time_logs 
        SET 
          overtime_status = ${status},
          approved_by = NULL,
          approved_at = NULL,
          updated_at = NOW()
        WHERE id = ${timeLogId} AND log_type = 'overtime'
        RETURNING id
      `
    } else {
      // When approving or rejecting, set approval data
      updateQuery = sql`
        UPDATE time_logs 
        SET 
          overtime_status = ${status},
          approved_by = ${adminId},
          approved_at = NOW(),
          updated_at = NOW()
        WHERE id = ${timeLogId} AND log_type = 'overtime'
        RETURNING id
      `
    }

    const res = await updateQuery

    if (res.length === 0) {
      return { success: false, error: "Overtime log not found" }
    }

    return { success: true }
  } catch (error) {
    console.error("Error updating overtime status:", error)
    return { success: false, error: "Failed to update overtime status" }
  }
}

/**
 * One-time migration to split existing long logs into regular and overtime portions
 * 
 * Finds all regular logs >9 hours and splits them:
 * - Original log is trimmed to 9 hours (regular time)
 * - New overtime log created for remaining time with pending status
 * 
 * @returns Migration result with success status, processed count, and errors
 */
export async function migrateExistingLongLogs(): Promise<{ 
  success: boolean; 
  processed: number; 
  errors: string[] 
}> {
  const errors: string[] = []
  let processed = 0

  try {
    // Find all unsplit long logs (both regular and overtime types)
    const longLogs = await sql`
      SELECT id, user_id, time_in, time_out, created_at, log_type
      FROM time_logs 
      WHERE status = 'completed' 
        AND time_in IS NOT NULL 
        AND time_out IS NOT NULL
        AND EXTRACT(EPOCH FROM (time_out - time_in)) / 3600 > ${DAILY_REQUIRED_HOURS}
        AND (
          log_type = 'regular' 
          OR (log_type = 'overtime' AND EXTRACT(EPOCH FROM (time_out - time_in)) / 3600 > ${DAILY_REQUIRED_HOURS})
        )
      ORDER BY created_at ASC
    `

    // Process each long log
    for (const log of longLogs) {
      try {
        const timeIn = new Date(log.time_in)
        const timeOut = new Date(log.time_out)
        // Truncate to minute
        timeIn.setSeconds(0, 0)
        timeOut.setSeconds(0, 0)
        // Calculate total hours for this log
        const totalHours = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60)
        if (totalHours <= DAILY_REQUIRED_HOURS) continue // Skip if already within limits

        // Calculate split points
        const regularEndTime = new Date(timeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
        regularEndTime.setSeconds(0, 0)
        // Overtime should start exactly at the end of regular time (no 1-minute gap)
        const overtimeStartTime = new Date(regularEndTime.getTime())
        overtimeStartTime.setSeconds(0, 0)

        // Begin transaction for atomic operation
        await sql.begin(async (tx) => {
          if (log.log_type === 'regular') {
            // For regular logs: Update to regular hours only, create overtime log
            await tx`
              UPDATE time_logs
              SET time_out = ${truncateToMinute(regularEndTime)}, 
                  updated_at = NOW()
              WHERE id = ${log.id}
            `
            await tx`
              INSERT INTO time_logs (
                user_id, time_in, time_out, status, 
                log_type, overtime_status, created_at, updated_at
              )
              VALUES (
                ${log.user_id}, 
                ${truncateToMinute(overtimeStartTime)}, 
                ${truncateToMinute(timeOut)}, 
                'completed', 
                'overtime', 
                'pending', 
                ${log.created_at}, 
                NOW()
              )
            `
          } else if (log.log_type === 'overtime') {
            // For overtime logs that are too long: Create regular log, update overtime log
            await tx`
              INSERT INTO time_logs (
                user_id, time_in, time_out, status, 
                log_type, created_at, updated_at
              )
              VALUES (
                ${log.user_id}, 
                ${truncateToMinute(timeIn)}, 
                ${truncateToMinute(regularEndTime)}, 
                'completed',
                'regular',
                ${log.created_at},
                NOW()
              )
            `
            await tx`
              UPDATE time_logs
              SET time_in = ${truncateToMinute(overtimeStartTime)}, 
                  updated_at = NOW()
              WHERE id = ${log.id}
            `
          }
        })
        
        processed++
      } catch (error) {
        const errorMsg = `Log ${log.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push(errorMsg)
        console.error('Migration error for log:', log.id, error)
      }
    }

    return { success: true, processed, errors }

  } catch (error) {
    console.error("Migration failed:", error)
    return { 
      success: false, 
      processed, 
      errors: [...errors, `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`] 
    }
  }
}

/**
 * Creates a time log edit request
 */
export async function createTimeLogEditRequest(params: {
  logId: number
  requestedBy: number | string
  requestedTimeIn?: string
  requestedTimeOut?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Always fetch the original time_in and time_out from the time_logs table
    const logRes = await sql`
      SELECT time_in, time_out FROM time_logs WHERE id = ${params.logId}
    `
    if (logRes.length === 0) {
      return { success: false, error: "Time log not found" }
    }
    const originalTimeIn = logRes[0].time_in
    const originalTimeOut = logRes[0].time_out

    await sql`
      INSERT INTO time_log_edit_requests (
        log_id, 
        original_time_in, 
        original_time_out, 
        requested_time_in, 
        requested_time_out, 
        status, 
        requested_by
      )
      VALUES (
        ${params.logId},
        ${originalTimeIn},
        ${originalTimeOut},
        ${params.requestedTimeIn ? truncateToMinute(params.requestedTimeIn) : null},
        ${params.requestedTimeOut ? truncateToMinute(params.requestedTimeOut) : null},
        'pending',
        ${params.requestedBy}
      )
    `
    return { success: true }
  } catch (error) {
    console.error("Error creating time log edit request:", error)
    return { success: false, error: "Failed to create edit request" }
  }
}

/**
 * Revert a time log to its original time_in and time_out using the edit request.
 * This should be called when an edit request is reverted to 'pending'.
 */
export async function revertTimeLogToOriginal(editRequestId: number): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the edit request and its associated log
    const req = await sql`
      SELECT log_id, original_time_in, original_time_out
      FROM time_log_edit_requests
      WHERE id = ${editRequestId}
    `
    if (req.length === 0) {
      return { success: false, error: "Edit request not found" }
    }
    const { log_id, original_time_in, original_time_out } = req[0]
    // Update the time log with the original values
    await sql`
      UPDATE time_logs
      SET time_in = ${truncateToMinute(original_time_in)}, time_out = ${truncateToMinute(original_time_out)}, updated_at = NOW()
      WHERE id = ${log_id}
    `
    return { success: true }
  } catch (error) {
    console.error("Error reverting time log to original:", error)
    return { success: false, error: "Failed to revert time log" }
  }
}

/**
 * Approve or reject a time log edit request (admin only)
 * If approved, update the time log and recalculate regular/overtime split.
 * Also ensures DTR duration is recalculated by removing old logs and inserting new ones.
 */
export async function updateTimeLogEditRequest(
  editRequestId: number,
  action: "approve" | "reject"
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the edit request and its associated log
    const req = await sql`
      SELECT * FROM time_log_edit_requests WHERE id = ${editRequestId}
    `
    if (req.length === 0) {
      return { success: false, error: "Edit request not found" }
    }
    const editReq = req[0]
    const logId = editReq.log_id
    const requestedTimeIn = editReq.requested_time_in
    const requestedTimeOut = editReq.requested_time_out

    if (action === "approve") {
      // Fetch the log to get user_id and created_at
      const logRes = await sql`SELECT * FROM time_logs WHERE id = ${logId}`
      if (logRes.length === 0) {
        return { success: false, error: "Time log not found" }
      }
      const log = logRes[0]
      const userId = log.user_id
      const createdAt = log.created_at

      // Remove all logs for this user on this date (to avoid duplicate durations)
      const dateKey = new Date(requestedTimeIn).toISOString().slice(0, 10)
      await sql`
        DELETE FROM time_logs
        WHERE user_id = ${userId}
          AND time_in::date = ${dateKey}
      `

      // Calculate new duration
      const timeIn = new Date(requestedTimeIn)
      const timeOut = new Date(requestedTimeOut)
      timeIn.setSeconds(0, 0)
      timeOut.setSeconds(0, 0)
      const totalHours = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60)

      // If duration > DAILY_REQUIRED_HOURS, split into regular and overtime
      if (totalHours > DAILY_REQUIRED_HOURS) {
        const regularCutoff = new Date(timeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
        regularCutoff.setSeconds(0, 0)
        // Insert regular log
        await sql`
          INSERT INTO time_logs (
            user_id, time_in, time_out, status, log_type, created_at, updated_at
          ) VALUES (
            ${userId},
            ${truncateToMinute(timeIn)},
            ${truncateToMinute(regularCutoff)},
            'completed',
            'regular',
            ${createdAt},
            NOW()
          )
        `
        // Insert overtime log
        await sql`
          INSERT INTO time_logs (
            user_id, time_in, time_out, status, log_type, overtime_status, created_at, updated_at
          ) VALUES (
            ${userId},
            ${truncateToMinute(regularCutoff)},
            ${truncateToMinute(timeOut)},
            'completed',
            'overtime',
            'pending',
            ${createdAt},
            NOW()
          )
        `
      } else {
        // Just insert a regular log with the new times
        await sql`
          INSERT INTO time_logs (
            user_id, time_in, time_out, status, log_type, created_at, updated_at
          ) VALUES (
            ${userId},
            ${truncateToMinute(timeIn)},
            ${truncateToMinute(timeOut)},
            'completed',
            'regular',
            ${createdAt},
            NOW()
          )
        `
      }
    } else if (action === "reject") {
      // If rejected, do nothing to the time log
    }

    // Update the edit request status
    await sql`
      UPDATE time_log_edit_requests
      SET status = ${action}, reviewed_at = NOW()
      WHERE id = ${editRequestId}
    `
    return { success: true }
  } catch (error) {
    console.error("Error updating time log edit request:", error)
    return { success: false, error: "Failed to update edit request" }
  }
}

// Helper to truncate a Date or ISO string to minute precision
function truncateToMinute(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  d.setSeconds(0, 0)
  return d.toISOString()
}

/**
 * Checks if there are any long logs that need to be split (for all users).
 * Returns { hasLongLogs: boolean }
 */
export async function checkLongLogs(): Promise<{ hasLongLogs: boolean }> {
  const res = await sql`
    SELECT COUNT(*) AS count
    FROM time_logs
    WHERE status = 'completed'
      AND time_in IS NOT NULL
      AND time_out IS NOT NULL
      AND EXTRACT(EPOCH FROM (time_out - time_in)) / 3600 > ${DAILY_REQUIRED_HOURS}
      AND (
        log_type = 'regular'
        OR (log_type = 'overtime' AND EXTRACT(EPOCH FROM (time_out - time_in)) / 3600 > ${DAILY_REQUIRED_HOURS})
      )
  `
  return { hasLongLogs: Number(res[0]?.count) > 0 }
}

/**
 * Runs the migration to split all long logs (for all users).
 * Returns { success, processed, errors }
 */
export async function migrateLongLogs(): Promise<{ success: boolean; processed: number; errors: string[] }> {
  // Just call the existing migrateExistingLongLogs function
  return migrateExistingLongLogs()
}
