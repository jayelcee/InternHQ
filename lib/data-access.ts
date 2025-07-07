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
 * 
 * This module provides comprehensive database operations for the InternHQ system,
 * including user management, time logging, overtime tracking, and edit request processing.
 * 
 * Key Features:
 * - User profile and internship management
 * - Time tracking with automatic regular/overtime splitting
 * - Edit request system for time log modifications
 * - Continuous session handling for complex time edits
 * - Migration utilities for data cleanup
 * 
 * Architecture Notes:
 * - Uses PostgreSQL with the @vercel/postgres driver
 * - Implements transactional operations for data integrity
 * - Handles timezone-aware time calculations
 * - Provides foreign key constraint management for complex operations
 * - Supports both single and batch edit request processing
 * 
 * Overtime Rules:
 * - Regular time: 0-9 hours per day
 * - Overtime: 9-12 hours per day (requires approval)
 * - Extended overtime: 12+ hours per day (requires approval)
 * 
 * @module DataAccess
 */

/**
 * Retrieves a project by its ID
 * @param projectId The ID of the project to retrieve
 * @returns The project object or null if not found
 */
async function getProjectById(projectId: number): Promise<Project | null> {
  const res = await sql`SELECT * FROM projects WHERE id = ${projectId}`
  return res.length === 0 ? null : (res[0] as Project)
}

/**
 * Fetches comprehensive user details including profile, internship, and projects.
 * 
 * This function retrieves a complete user profile with all related data:
 * - Basic user information (name, email, role)
 * - User profile (personal details, emergency contacts)
 * - Internship program details (school, department, supervisor)
 * - Completed hours calculation
 * - Today's clock-in/out status
 * - Assigned projects
 * 
 * @param userId The ID of the user to retrieve
 * @returns Complete user details or null if user not found
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

/**
 * Clocks in a user with automatic overtime detection.
 * 
 * The system automatically determines if this should be a regular or overtime clock-in
 * based on hours already worked today:
 * - 0-9 hours: Regular time
 * - 9-12 hours: Overtime (requires approval)
 * - 12+ hours: Extended overtime (requires approval)
 * 
 * @param userId The ID of the user to clock in
 * @param time Optional specific time to clock in (defaults to current time)
 * @returns Success status and error message if applicable
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
    
    // Determine log type based on hours worked
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
    
    const timeToUse = time ? truncateToMinute(time) : sql`date_trunc('minute', NOW())`
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
 * Clocks out a user with intelligent overtime handling.
 * 
 * This function handles complex clock-out scenarios:
 * - Regular logs: Splits into regular + overtime if over 9 hours
 * - Overtime logs: Completes or discards based on user choice
 * - Extended overtime: Handles sessions over 12 hours
 * 
 * When discarding overtime:
 * - For regular logs: Cuts at 9 hours, removes any overtime
 * - For overtime logs: Deletes the overtime session entirely
 * 
 * @param userId The ID of the user to clock out
 * @param time Optional specific time to clock out (defaults to current time)
 * @param discardOvertime Whether to discard any overtime hours
 * @param overtimeNote Optional note for overtime justification
 * @returns Success status and error message if applicable
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
    const timeOut = time ? new Date(time) : new Date()
    timeOut.setSeconds(0, 0)
    const totalHours = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60)
    
    // Handle based on log type
    if (log.log_type === 'overtime' || log.log_type === 'extended_overtime') {
      if (discardOvertime) {
        // Delete the overtime session entirely
        console.log(`Discarding separate ${log.log_type} session by deleting log ${log.id}`)
        
        await sql`
          DELETE FROM time_logs
          WHERE id = ${log.id}
        `
        
        return { success: true }
      } else {
        // Complete the overtime session normally
        await sql`
          UPDATE time_logs
          SET time_out = ${truncateToMinute(timeOut)}, 
              status = 'completed',
              updated_at = NOW()
          WHERE id = ${log.id}
        `
        
        return { success: true }
      }
    } else {
      // Handle regular logs
      if (discardOvertime) {
        // Cut at 9 hours and remove any existing overtime
        console.log('Discarding overtime - cutting regular log at 9 hours and deleting overtime logs')
        
        const regularCutoff = new Date(timeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
        regularCutoff.setSeconds(0, 0)
        
        const today = timeIn.toISOString().split('T')[0]
        const todayStart = `${today}T00:00:00.000Z`
        const todayEnd = `${today}T23:59:59.999Z`
        
        console.log(`Cutting regular log at ${regularCutoff.toISOString()} and deleting overtime logs for user ${userId} on ${today}`)
        
        await sql.begin(async (tx) => {
          await tx`
            UPDATE time_logs
            SET time_out = ${truncateToMinute(regularCutoff)}, 
                status = 'completed', 
                log_type = 'regular',
                updated_at = NOW()
            WHERE id = ${log.id}
          `
          
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
        // Split into regular + overtime (and extended overtime if needed)
        const regularCutoff = new Date(timeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
        const overtimeCutoff = new Date(timeIn.getTime() + ((DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) * 60 * 60 * 1000))
        regularCutoff.setSeconds(0, 0)
        overtimeCutoff.setSeconds(0, 0)
        
        const hasExtendedOvertime = totalHours > (DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS)
        await sql.begin(async (tx) => {
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
        // Complete normally as regular time (≤9 hours)
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
 * Retrieves all time logs for a specific user.
 * 
 * @param userId The ID of the user
 * @param logType Optional filter by log type (regular, overtime, or null for all)
 * @returns Array of time logs ordered by time_in descending
 */
export async function getTimeLogsForUser(userId: string, logType: "regular" | "overtime" | "extended_overtime" | null = null): Promise<TimeLog[]> {
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
 * Retrieves today's time log for a specific user and log type.
 * 
 * @param userId The ID of the user
 * @param logType The type of log to retrieve (regular or overtime)
 * @returns The most recent time log for today or null if none found
 */
export async function getTodayTimeLog(userId: string, logType: "regular" | "overtime" | "extended_overtime" = "regular"): Promise<TimeLog | null> {
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

/**
 * Retrieves all projects assigned to a specific intern.
 * 
 * @param userId The ID of the intern
 * @returns Array of project assignments with project details
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
 * Deletes an intern user and all associated data.
 * 
 * This function performs a cascading delete of an intern user.
 * Only users with the 'intern' role can be deleted through this function.
 * 
 * @param userId The ID of the intern to delete
 * @returns Success status and error message if applicable
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
 * Updates user profile and internship information.
 * 
 * This function handles comprehensive profile updates including:
 * - Basic user information (name, email)
 * - Personal details (address, phone, bio)
 * - Academic information (degree, GPA, graduation date)
 * - Skills, interests, and languages (stored as arrays)
 * - Emergency contact information
 * - Internship program details (dates, hours, supervisor)
 * 
 * @param userId The ID of the user to update
 * @param profileData Object containing all profile fields to update
 * @returns Success status and error message if applicable
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
    skills?: string[]
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

    // Update user basic information (only change email if different)
    if (profileData.email && profileData.email !== currentEmail) {
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

    // Helper functions for data conversion
    const toPgArray = (val: unknown) =>
      Array.isArray(val) ? val : typeof val === "string" && val ? [val] : []

    // Ensure user_profiles row exists
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

/**
 * Retrieves all time logs with comprehensive user and organizational details.
 * 
 * This function joins time logs with user, department, and school information
 * to provide a complete view for administrative dashboards and reporting.
 * 
 * @returns Array of time logs with user, department, and school details
 */
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
      ? calculateTimeWorked(row.time_in, row.time_out).duration
      : null,
    hoursWorked: row.time_in && row.time_out
      ? calculateTimeWorked(row.time_in, row.time_out).hoursWorked
      : 0,
    department: row.department || "",
    school: row.school || "",
  })) as TimeLogWithDetails[]
}

/**
 * Retrieves all interns with their current status and internship progress.
 * 
 * This function provides comprehensive intern information including:
 * - Basic intern details (name, email, department, school)
 * - Today's time logs and current status (in/out)
 * - Total hours completed vs required
 * - Internship program dates
 * - Real-time activity status
 * 
 * @returns Array of intern objects with complete status information
 */
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
    log_type: string | null
    overtime_status: string | null
  }

  const interns = await Promise.all(result.map(async (row) => {
    // Get all completed logs for progress calculation
    const allLogsRes = await sql<Array<{
      time_in: string | null
      time_out: string | null
      status: string
    }>>`
      SELECT time_in, time_out, status
      FROM time_logs
      WHERE user_id = ${row.id} AND time_in IS NOT NULL AND time_out IS NOT NULL
    `
    
    const completedHours = calculateInternshipProgress(allLogsRes, row.id)

    // Get today's logs for status calculation
    const todayLogRes = await sql<TimeLogRow[]>`
      SELECT time_in, time_out, status, log_type, overtime_status
      FROM time_logs
      WHERE user_id = ${row.id} AND time_in::date = ${today}
      ORDER BY time_in ASC
    `

    // Process today's logs for display
    const todayLogs = todayLogRes.map((log) => ({
      timeIn: log.time_in,
      timeOut: log.time_out,
      status: log.status,
      logType: log.log_type,
      overtimeStatus: log.overtime_status,
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

    // Determine current status
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

/**
 * Creates a new intern with school and department auto-creation.
 * 
 * This function handles the complete intern creation process:
 * - Creates user account with encrypted password
 * - Auto-creates school if it doesn't exist
 * - Auto-creates department if it doesn't exist
 * - Sets up internship program with all details
 * 
 * @param data Object containing all intern creation details
 * @returns Success status with created intern details or error message
 */
export async function createIntern(data: {
  firstName: string
  lastName: string
  email: string
  password?: string
  school: string
  degree: string
  department: string
  requiredHours: number
  startDate: string
  endDate: string
  workSchedule?: string
}) {
  try {
    const first_name = data.firstName.trim()
    const last_name = data.lastName.trim()
    const password = data.password || "intern123"

    // Convert work schedule to JSONB format for common schedules
    let workScheduleJson = null
    if (data.workSchedule && data.workSchedule !== "none") {
      switch (data.workSchedule) {
        case "Monday-Friday, 9AM-6PM":
          workScheduleJson = JSON.stringify({
            monday: { start: "09:00", end: "18:00" },
            tuesday: { start: "09:00", end: "18:00" },
            wednesday: { start: "09:00", end: "18:00" },
            thursday: { start: "09:00", end: "18:00" },
            friday: { start: "09:00", end: "18:00" }
          })
          break
        case "Monday-Friday, 8AM-5PM":
          workScheduleJson = JSON.stringify({
            monday: { start: "08:00", end: "17:00" },
            tuesday: { start: "08:00", end: "17:00" },
            wednesday: { start: "08:00", end: "17:00" },
            thursday: { start: "08:00", end: "17:00" },
            friday: { start: "08:00", end: "17:00" }
          })
          break
        case "Monday-Friday, 10AM-7PM":
          workScheduleJson = JSON.stringify({
            monday: { start: "10:00", end: "19:00" },
            tuesday: { start: "10:00", end: "19:00" },
            wednesday: { start: "10:00", end: "19:00" },
            thursday: { start: "10:00", end: "19:00" },
            friday: { start: "10:00", end: "19:00" }
          })
          break
        case "Monday-Saturday, 9AM-6PM":
          workScheduleJson = JSON.stringify({
            monday: { start: "09:00", end: "18:00" },
            tuesday: { start: "09:00", end: "18:00" },
            wednesday: { start: "09:00", end: "18:00" },
            thursday: { start: "09:00", end: "18:00" },
            friday: { start: "09:00", end: "18:00" },
            saturday: { start: "09:00", end: "18:00" }
          })
          break
        default:
          // For other schedules, just store as a simple string description
          workScheduleJson = JSON.stringify({ description: data.workSchedule })
      }
    }

    // Check for existing user
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

    // Create user account
    const userRes = await sql`
      INSERT INTO users (email, password_hash, first_name, last_name, role, work_schedule)
      VALUES (
        ${data.email},
        crypt(${password}, gen_salt('bf')),
        ${first_name},
        ${last_name},
        'intern',
        ${workScheduleJson}
      )
      RETURNING id
    `
    const userId = userRes[0].id

    // Create internship program
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

    // Create user profile with degree
    await sql`
      INSERT INTO user_profiles (user_id, degree)
      VALUES (${userId}, ${data.degree})
    `

    return { success: true, intern: { id: userId, email: data.email, first_name, last_name } }
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("Error creating intern:", error)
    return { success: false, error: err.message || "Failed to create intern" }
  }
}

/**
 * Updates a time log entry (admin only).
 * 
 * This function allows administrators to modify existing time log entries.
 * Only provided fields will be updated, others remain unchanged.
 * 
 * @param timeLogId The ID of the time log to update
 * @param updates Object containing fields to update
 * @returns Success status and error message if applicable
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
 * Deletes a time log entry (admin only).
 * 
 * @param timeLogId The ID of the time log to delete
 * @returns Success status and error message if applicable
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
 * Retrieves all overtime logs pending approval (admin only).
 * 
 * This function fetches completed overtime and extended overtime logs
 * that require administrator review and approval.
 * 
 * @returns Array of overtime logs with user and organizational details
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
 * Approves, rejects, or reverts overtime log status (admin only).
 * 
 * This function manages the overtime approval workflow:
 * - approved: Marks overtime as approved by admin
 * - rejected: Marks overtime as rejected by admin  
 * - pending: Reverts to pending status (clears approval data)
 * 
 * @param timeLogId The ID of the overtime log
 * @param status The new status to set
 * @param adminId The ID of the admin performing the action
 * @returns Success status and error message if applicable
 */
export async function updateOvertimeStatus(
  timeLogId: number, 
  status: "approved" | "rejected" | "pending", 
  adminId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    let updateQuery
    
    if (status === "pending") {
      // Clear approval data when reverting to pending
      updateQuery = sql`
        UPDATE time_logs 
        SET 
          overtime_status = ${status},
          approved_by = NULL,
          approved_at = NULL,
          updated_at = NOW()
        WHERE id = ${timeLogId} AND log_type IN ('overtime', 'extended_overtime')
        RETURNING id
      `
    } else {
      // Set approval data when approving or rejecting
      updateQuery = sql`
        UPDATE time_logs 
        SET 
          overtime_status = ${status},
          approved_by = ${adminId},
          approved_at = NOW(),
          updated_at = NOW()
        WHERE id = ${timeLogId} AND log_type IN ('overtime', 'extended_overtime')
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
 * One-time migration to split existing long logs into the proper 3-tier time tracking system.
 * 
 * This migration function finds all time logs that exceed their designated time boundaries
 * and automatically splits them into appropriate segments:
 * - Regular time: 0-9 hours per day
 * - Overtime: 9-12 hours per day (3 hours max, requires approval)
 * - Extended overtime: 12+ hours per day (requires approval)
 * 
 * Migration Logic:
 * - Regular logs >9h: Split into regular + overtime/extended_overtime
 * - Overtime logs >3h: Split into overtime + extended_overtime  
 * - Extended overtime logs >12h total: Split into regular + overtime + extended_overtime
 * 
 * The migration preserves original timestamps and maintains data integrity
 * through database transactions. It processes logs that exceed their
 * designated time boundaries and splits them appropriately.
 * 
 * @returns Migration result with success status, processed count, and any errors
 */
export async function migrateExistingLongLogs(): Promise<{ 
  success: boolean; 
  processed: number; 
  errors: string[] 
}> {
  const errors: string[] = []
  let processed = 0

  try {
    // Find all logs that need splitting with 3-tier system
    const longLogs = await sql`
      SELECT id, user_id, time_in, time_out, created_at, log_type
      FROM time_logs 
      WHERE status = 'completed' 
        AND time_in IS NOT NULL 
        AND time_out IS NOT NULL
        AND (
          -- Regular logs > 9 hours (should be split)
          (log_type = 'regular' AND EXTRACT(EPOCH FROM (time_out - time_in)) / 3600 > ${DAILY_REQUIRED_HOURS})
          OR 
          -- Overtime logs > 3 hours (should be split into overtime + extended_overtime)
          (log_type = 'overtime' AND EXTRACT(EPOCH FROM (time_out - time_in)) / 3600 > ${MAX_OVERTIME_HOURS})
          OR
          -- Extended overtime logs > 12 hours total (should be split into regular + overtime + extended_overtime)
          (log_type = 'extended_overtime' AND EXTRACT(EPOCH FROM (time_out - time_in)) / 3600 > ${DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS})
        )
      ORDER BY created_at ASC
    `

    // Process each log that needs splitting
    for (const log of longLogs) {
      try {
        const timeIn = new Date(log.time_in)
        const timeOut = new Date(log.time_out)
        timeIn.setSeconds(0, 0)
        timeOut.setSeconds(0, 0)
        const totalHours = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60)
        
        // Calculate split points for 3-tier system
        const regularEndTime = new Date(timeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
        const overtimeEndTime = new Date(timeIn.getTime() + ((DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) * 60 * 60 * 1000))
        regularEndTime.setSeconds(0, 0)
        overtimeEndTime.setSeconds(0, 0)
        
        // Skip logs that don't actually need splitting
        if (log.log_type === 'regular' && totalHours <= DAILY_REQUIRED_HOURS) {
          continue
        }
        if (log.log_type === 'overtime' && totalHours <= MAX_OVERTIME_HOURS) {
          continue
        }
        if (log.log_type === 'extended_overtime' && totalHours <= DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) {
          continue
        }

        await sql.begin(async (tx) => {
          if (log.log_type === 'regular') {
            // Handle regular logs that need splitting
            
            // Update original log to regular hours only (0-9 hours)
            await tx`
              UPDATE time_logs
              SET time_out = ${truncateToMinute(regularEndTime)}, 
                  updated_at = NOW()
              WHERE id = ${log.id}
            `
            
            if (totalHours > DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) {
              // 3-tier split: Create both overtime (9-12h) and extended_overtime (12h+)
              await tx`
                INSERT INTO time_logs (
                  user_id, time_in, time_out, status, 
                  log_type, overtime_status, created_at, updated_at
                )
                VALUES (
                  ${log.user_id}, 
                  ${truncateToMinute(regularEndTime)}, 
                  ${truncateToMinute(overtimeEndTime)}, 
                  'completed', 
                  'overtime', 
                  'pending', 
                  ${log.created_at}, 
                  NOW()
                )
              `
              await tx`
                INSERT INTO time_logs (
                  user_id, time_in, time_out, status, 
                  log_type, overtime_status, created_at, updated_at
                )
                VALUES (
                  ${log.user_id}, 
                  ${truncateToMinute(overtimeEndTime)}, 
                  ${truncateToMinute(timeOut)}, 
                  'completed', 
                  'extended_overtime', 
                  'pending', 
                  ${log.created_at}, 
                  NOW()
                )
              `
            } else {
              // 2-tier split: Create only overtime (9-12h)
              await tx`
                INSERT INTO time_logs (
                  user_id, time_in, time_out, status, 
                  log_type, overtime_status, created_at, updated_at
                )
                VALUES (
                  ${log.user_id}, 
                  ${truncateToMinute(regularEndTime)}, 
                  ${truncateToMinute(timeOut)}, 
                  'completed', 
                  'overtime', 
                  'pending', 
                  ${log.created_at}, 
                  NOW()
                )
              `
            }
          } else if (log.log_type === 'overtime') {
            // Handle overtime logs that are too long (>3 hours)
            
            // Split overtime into proper overtime (3h max) + extended_overtime  
            const overtimeStartTime = new Date(timeIn.getTime())
            const overtimeEndTime = new Date(overtimeStartTime.getTime() + (MAX_OVERTIME_HOURS * 60 * 60 * 1000))
            overtimeEndTime.setSeconds(0, 0)
            
            // Update original overtime log to max 3 hours
            await tx`
              UPDATE time_logs
              SET time_out = ${truncateToMinute(overtimeEndTime)}, 
                  updated_at = NOW()
              WHERE id = ${log.id}
            `
            
            // Create extended_overtime log for remaining time
            await tx`
              INSERT INTO time_logs (
                user_id, time_in, time_out, status, 
                log_type, overtime_status, created_at, updated_at
              )
              VALUES (
                ${log.user_id}, 
                ${truncateToMinute(overtimeEndTime)}, 
                ${truncateToMinute(timeOut)}, 
                'completed', 
                'extended_overtime', 
                'pending', 
                ${log.created_at}, 
                NOW()
              )
            `
          } else if (log.log_type === 'extended_overtime') {
            // Handle extended_overtime logs that span the full day (>12 hours total)
            // This means they should be split into regular + overtime + extended_overtime
            
            // Create regular log (0-9 hours)
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
            
            // Create overtime log (9-12 hours)
            await tx`
              INSERT INTO time_logs (
                user_id, time_in, time_out, status, 
                log_type, overtime_status, created_at, updated_at
              )
              VALUES (
                ${log.user_id}, 
                ${truncateToMinute(regularEndTime)}, 
                ${truncateToMinute(overtimeEndTime)}, 
                'completed', 
                'overtime', 
                'pending', 
                ${log.created_at}, 
                NOW()
              )
            `
            
            // Update original extended_overtime log to start at 12 hours
            await tx`
              UPDATE time_logs
              SET time_in = ${truncateToMinute(overtimeEndTime)}, 
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
 * Creates a time log edit request for a single log entry.
 * 
 * This function allows interns to request modifications to their time logs.
 * The request is stored with original times for audit purposes and enters
 * a pending state for admin review.
 * 
 * @param params Object containing log ID, requester ID, and requested times
 * @returns Success status with edit request ID or error message
 */
export async function createTimeLogEditRequest(params: {
  logId: number
  requestedBy: number | string
  requestedTimeIn?: string
  requestedTimeOut?: string
}): Promise<{ success: boolean; error?: string; editRequestId?: number }> {
  console.log(`[CREATE EDIT REQUEST] Creating edit request for log ${params.logId} by user ${params.requestedBy}`)
  
  try {
    // Fetch original times from the time log
    const logRes = await sql`
      SELECT time_in, time_out FROM time_logs WHERE id = ${params.logId}
    `
    if (logRes.length === 0) {
      console.error(`[CREATE EDIT REQUEST] Time log ${params.logId} not found`)
      return { success: false, error: "Time log not found" }
    }
    const originalTimeIn = logRes[0].time_in
    const originalTimeOut = logRes[0].time_out

    const result = await sql`
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
      RETURNING id
    `
    
    return { success: true, editRequestId: result[0].id }
  } catch (error) {
    console.error("[CREATE EDIT REQUEST] Error creating time log edit request:", error)
    return { success: false, error: "Failed to create edit request" }
  }
}

/**
 * Reverts a time log to its original state using edit request data.
 * 
 * This function restores time logs to their original time_in and time_out
 * values as stored in the edit request. It handles complex scenarios including:
 * - Single log reversion
 * - Overtime splitting restoration
 * - Extended overtime scenarios
 * - Foreign key constraint management
 * 
 * IMPORTANT: This function does not delete edit requests, only updates their status.
 * For continuous session edit requests, use revertContinuousEditRequests instead.
 * 
 * @param editRequestId The ID of the edit request to revert
 * @param reviewerId Optional ID of the admin performing the reversion
 * @returns Success status and error message if applicable
 */
export async function revertTimeLogToOriginal(
  editRequestId: number, 
  reviewerId?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[REVERT] Reverting time log to original for edit request: ${editRequestId}`)
    
    // Get the edit request and its associated log
    const req = await sql`
      SELECT log_id, original_time_in, original_time_out, metadata
      FROM time_log_edit_requests
      WHERE id = ${editRequestId}
    `
    if (req.length === 0) {
      console.error(`[REVERT] Edit request ${editRequestId} not found`)
      return { success: false, error: "Edit request not found" }
    }
    
    const { log_id, original_time_in, original_time_out, metadata } = req[0]
    
    // Check if this is a continuous session
    if (metadata && metadata.isContinuousSession) {
      console.log(`[REVERT] This is a continuous session edit request - should be handled by revertContinuousEditRequests`)
      return { success: false, error: "Continuous session edit requests should use revertContinuousEditRequests" }
    }
    
    if (!original_time_in || !original_time_out) {
      console.error(`[REVERT] No original time data found in edit request ${editRequestId}`)
      return { success: false, error: "No original time data found in edit request" }
    }

    // Get user info for proper restoration
    const logRes = await sql`SELECT user_id, created_at FROM time_logs WHERE id = ${log_id}`
    if (logRes.length === 0) {
      console.error(`[REVERT] Associated time log ${log_id} not found`)
      return { success: false, error: "Associated time log not found" }
    }
    
    const { user_id: userId, created_at: createdAt } = logRes[0]
    const originalDate = new Date(original_time_in)
    const dateKey = `${originalDate.getFullYear()}-${String(originalDate.getMonth() + 1).padStart(2, '0')}-${String(originalDate.getDate()).padStart(2, '0')}`
    
    // Calculate original time range for restoration
    const originalTimeIn = new Date(original_time_in)
    const originalTimeOut = new Date(original_time_out)
    originalTimeIn.setSeconds(0, 0)
    originalTimeOut.setSeconds(0, 0)

    await sql.begin(async (tx) => {
      // Get all log IDs that will be deleted to handle foreign key constraints
      const logsToDelete = await tx`
        SELECT id FROM time_logs 
        WHERE user_id = ${userId} AND time_in::date = ${dateKey}
      `
      const logIdsToDelete = logsToDelete.map(log => log.id)
      
      // Create a temporary placeholder log to handle foreign key constraints
      let placeholderLogId: number | null = null
      if (logIdsToDelete.length > 0) {
        const placeholderLogRes = await tx`
          INSERT INTO time_logs (
            user_id, time_in, time_out, status, log_type, created_at, updated_at
          ) VALUES (
            ${userId}, ${truncateToMinute(originalTimeIn)}, ${truncateToMinute(originalTimeOut)},
            'completed', 'regular', ${createdAt}, NOW()
          )
          RETURNING id
        `
        placeholderLogId = placeholderLogRes[0].id
        
        // Update all edit requests that reference logs being deleted
        await tx`
          UPDATE time_log_edit_requests 
          SET log_id = ${placeholderLogId}
          WHERE log_id = ANY(${logIdsToDelete})
        `
        
        // Delete the original logs using the exact IDs
        await tx`
          DELETE FROM time_logs
          WHERE id = ANY(${logIdsToDelete})
        `
      }
      
      // Calculate original duration to determine how to restore
      const originalTotalHours = (originalTimeOut.getTime() - originalTimeIn.getTime()) / (1000 * 60 * 60)
      
      // Restore original log structure based on original duration
      const newLogIds: number[] = []
      
      if (originalTotalHours > DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) {
        // Extended overtime scenario
        const regularCutoff = new Date(originalTimeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
        const overtimeCutoff = new Date(originalTimeIn.getTime() + ((DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) * 60 * 60 * 1000))
        regularCutoff.setSeconds(0, 0)
        overtimeCutoff.setSeconds(0, 0)

        // Insert regular log (9 hours)
        const regularLogRes = await tx`
          INSERT INTO time_logs (
            user_id, time_in, time_out, status, log_type, created_at, updated_at
          ) VALUES (
            ${userId}, ${truncateToMinute(originalTimeIn)}, ${truncateToMinute(regularCutoff)},
            'completed', 'regular', ${createdAt}, NOW()
          )
          RETURNING id
        `
        newLogIds.push(regularLogRes[0].id)

        // Insert normal overtime log (3 hours) with pending status (reverted to original state)
        const overtimeLogRes = await tx`
          INSERT INTO time_logs (
            user_id, time_in, time_out, status, log_type, overtime_status, created_at, updated_at
          ) VALUES (
            ${userId}, ${truncateToMinute(regularCutoff)}, ${truncateToMinute(overtimeCutoff)},
            'completed', 'overtime', 'pending', ${createdAt}, NOW()
          )
          RETURNING id
        `
        newLogIds.push(overtimeLogRes[0].id)

        // Insert extended overtime log (remainder) with pending status
        const extendedOvertimeLogRes = await tx`
          INSERT INTO time_logs (
            user_id, time_in, time_out, status, log_type, overtime_status, created_at, updated_at
          ) VALUES (
            ${userId}, ${truncateToMinute(overtimeCutoff)}, ${truncateToMinute(originalTimeOut)},
            'completed', 'extended_overtime', 'pending', ${createdAt}, NOW()
          )
          RETURNING id
        `
        newLogIds.push(extendedOvertimeLogRes[0].id)
      } else if (originalTotalHours > DAILY_REQUIRED_HOURS) {
        // Regular overtime scenario: regular (9h) + overtime (remainder, up to 3h)
        console.log(`[REVERT] Restoring with overtime: ${originalTotalHours} hours > ${DAILY_REQUIRED_HOURS} hours`)
        const regularCutoff = new Date(originalTimeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
        regularCutoff.setSeconds(0, 0)

        // Insert regular log
        const regularLogRes = await tx`
          INSERT INTO time_logs (
            user_id, time_in, time_out, status, log_type, created_at, updated_at
          ) VALUES (
            ${userId}, ${truncateToMinute(originalTimeIn)}, ${truncateToMinute(regularCutoff)},
            'completed', 'regular', ${createdAt}, NOW()
          )
          RETURNING id
        `
        newLogIds.push(regularLogRes[0].id)

        // Insert overtime log with pending status (reverted to original state)
        const overtimeLogRes = await tx`
          INSERT INTO time_logs (
            user_id, time_in, time_out, status, log_type, overtime_status, created_at, updated_at
          ) VALUES (
            ${userId}, ${truncateToMinute(regularCutoff)}, ${truncateToMinute(originalTimeOut)},
            'completed', 'overtime', 'pending', ${createdAt}, NOW()
          )
          RETURNING id
        `
        newLogIds.push(overtimeLogRes[0].id)
      } else {
        // Regular hours only: restore as single log
        console.log(`[REVERT] Restoring as single regular log: ${originalTotalHours} hours <= ${DAILY_REQUIRED_HOURS} hours`)
        const regularLogRes = await tx`
          INSERT INTO time_logs (
            user_id, time_in, time_out, status, log_type, created_at, updated_at
          ) VALUES (
            ${userId}, ${truncateToMinute(originalTimeIn)}, ${truncateToMinute(originalTimeOut)},
            'completed', 'regular', ${createdAt}, NOW()
          )
          RETURNING id
        `
        newLogIds.push(regularLogRes[0].id)
      }
      
      console.log(`[REVERT] Created ${newLogIds.length} new logs: ${JSON.stringify(newLogIds)}`)
      
      // Update edit requests to point to the primary new log (regular log) and delete the placeholder
      // This ensures the edit requests maintain their audit trail references
      if (newLogIds.length > 0) {
        if (placeholderLogId) {
          // If we used a placeholder, update all edit requests pointing to it
          console.log(`[REVERT] Found placeholder log ${placeholderLogId}, updating all references to new log ${newLogIds[0]}`)
          
          // Update ALL edit requests pointing to the placeholder to point to the new primary log
          await tx`
            UPDATE time_log_edit_requests 
            SET log_id = ${newLogIds[0]}
            WHERE log_id = ${placeholderLogId}
          `
          
          // Delete the placeholder log now that all references are updated
          console.log(`[REVERT] Deleting placeholder log ${placeholderLogId}`)
          await tx`
            DELETE FROM time_logs WHERE id = ${placeholderLogId}
          `
        } else {
          // If no placeholder was used, directly update the edit request to point to the new log
          console.log(`[REVERT] No placeholder used, directly updating edit request ${editRequestId} to point to new log ${newLogIds[0]}`)
          await tx`
            UPDATE time_log_edit_requests 
            SET log_id = ${newLogIds[0]}
            WHERE id = ${editRequestId}
          `
          
          // Also delete any old logs that might exist (in case they weren't caught earlier)
          if (logIdsToDelete.length > 0) {
            console.log(`[REVERT] Deleting old logs that weren't handled by placeholder: ${JSON.stringify(logIdsToDelete)}`)
            await tx`
              DELETE FROM time_logs
              WHERE user_id = ${userId} AND time_in::date = ${dateKey} AND id != ALL(${newLogIds})
            `
          }
        }
        
        // Update the edit request status to pending (reverted state)
        console.log(`[REVERT] Setting edit request ${editRequestId} status to pending, reviewer: ${reviewerId || 'none'}`)
        if (reviewerId) {
          await tx`
            UPDATE time_log_edit_requests
            SET status = 'pending', reviewed_at = NOW(), reviewed_by = NULL
            WHERE id = ${editRequestId}
          `
        } else {
          await tx`
            UPDATE time_log_edit_requests
            SET status = 'pending', reviewed_at = NULL, reviewed_by = NULL
            WHERE id = ${editRequestId}
          `
        }
      } else {
        // Fallback: just update status without changing log reference
        console.log(`[REVERT] No new logs created, just updating status for edit request ${editRequestId}`)
        if (reviewerId) {
          await tx`
            UPDATE time_log_edit_requests
            SET status = 'pending', reviewed_at = NOW(), reviewed_by = NULL
            WHERE id = ${editRequestId}
          `
        } else {
          await tx`
            UPDATE time_log_edit_requests
            SET status = 'pending', reviewed_at = NULL, reviewed_by = NULL
            WHERE id = ${editRequestId}
          `
        }
      }
    })
    
    console.log(`[REVERT] Successfully reverted time log for edit request ${editRequestId} to original times`)
    return { success: true }
  } catch (error) {
    console.error(`[REVERT] Error reverting time log to original for edit request ${editRequestId}:`, error)
    return { success: false, error: "Failed to revert time log" }
  }
}

/**
 * Approves or rejects a time log edit request (admin only).
 * 
 * This function handles the admin review process for time log edit requests:
 * 
 * When approving:
 * - Validates the requested time range
 * - Deletes existing logs for the date
 * - Creates new logs with proper regular/overtime splitting
 * - Automatically approves any resulting overtime
 * - Updates edit request status and reviewer information
 * 
 * When rejecting:
 * - Leaves the original time logs unchanged
 * - Updates edit request status to rejected
 * 
 * The function ensures data consistency through database transactions
 * and handles foreign key constraints during log recreation.
 * 
 * @param editRequestId The ID of the edit request to process
 * @param action Whether to approve or reject the request
 * @param reviewerId Optional ID of the admin performing the review
 * @returns Success status and error message if applicable
 */
export async function updateTimeLogEditRequest(
  editRequestId: number,
  action: "approve" | "reject",
  reviewerId?: number
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

      // Calculate new duration
      const timeIn = new Date(requestedTimeIn)
      const timeOut = new Date(requestedTimeOut)
      timeIn.setSeconds(0, 0)
      timeOut.setSeconds(0, 0)
      const totalHours = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60)

      console.log(`Single edit request approval - Total hours: ${totalHours}, DAILY_REQUIRED_HOURS: ${DAILY_REQUIRED_HOURS}, MAX_OVERTIME_HOURS: ${MAX_OVERTIME_HOURS}`)

      await sql.begin(async (tx) => {
        // Get all log IDs that will be deleted to handle foreign key constraints
        // Use local date instead of UTC to handle timezone correctly
        const requestedDate = new Date(requestedTimeIn)
        const dateKey = `${requestedDate.getFullYear()}-${String(requestedDate.getMonth() + 1).padStart(2, '0')}-${String(requestedDate.getDate()).padStart(2, '0')}`
        const logsToDelete = await tx`
          SELECT id FROM time_logs 
          WHERE user_id = ${userId} 
            AND time_in::date = ${dateKey}
        `
        const logIdsToDelete = logsToDelete.map(log => log.id)
        console.log(`[SINGLE APPROVAL] Found ${logIdsToDelete.length} logs to delete: ${JSON.stringify(logIdsToDelete)}`)
        
        // Create a temporary placeholder log to handle foreign key constraints
        // This allows us to temporarily point edit requests to it while we delete and recreate logs
        let placeholderLogId: number | null = null
        if (logIdsToDelete.length > 0) {
          console.log(`[SINGLE APPROVAL] Creating temporary placeholder log for foreign key constraint handling`)
          const placeholderLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(timeIn)}, ${truncateToMinute(timeOut)},
              'completed', 'regular', ${createdAt}, NOW()
            )
            RETURNING id
          `
          placeholderLogId = placeholderLogRes[0].id
          console.log(`[SINGLE APPROVAL] Created temporary placeholder log ${placeholderLogId}`)
          
          // Update all edit requests that reference logs being deleted to point to the placeholder
          console.log(`[SINGLE APPROVAL] Updating edit requests to reference temporary placeholder log ${placeholderLogId}`)
          await tx`
            UPDATE time_log_edit_requests
            SET log_id = ${placeholderLogId}
            WHERE log_id = ANY(${logIdsToDelete})
          `
        }

        // Delete all old logs for this user on this date, excluding the placeholder
        // Use the original logIdsToDelete list to ensure we delete exactly the right logs
        console.log(`[SINGLE APPROVAL] Deleting old logs for user ${userId} on date ${dateKey}`)
        if (logIdsToDelete.length > 0) {
          await tx`
            DELETE FROM time_logs
            WHERE id = ANY(${logIdsToDelete})
          `
        }

        // Now create the new logs with the approved time range
        const newLogIds: number[] = []

        // Split into regular, overtime, and potentially extended overtime based on total hours
        if (totalHours > DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) {
          // Extended overtime scenario: regular (9h) + overtime (3h) + extended overtime (remainder)
          console.log(`Creating regular + overtime + extended overtime logs for ${totalHours} hours (discarding original overtime if any)`)
          const regularCutoff = new Date(timeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
          const overtimeCutoff = new Date(timeIn.getTime() + ((DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) * 60 * 60 * 1000))
          regularCutoff.setSeconds(0, 0)
          overtimeCutoff.setSeconds(0, 0)

          // Insert regular log (9 hours)
          const regularLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(timeIn)}, ${truncateToMinute(regularCutoff)},
              'completed', 'regular', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(regularLogRes[0].id)

          // Insert normal overtime log (3 hours) with automatic approval
          const overtimeLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, overtime_status, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(regularCutoff)}, ${truncateToMinute(overtimeCutoff)},
              'completed', 'overtime', 'approved', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(overtimeLogRes[0].id)

          // Insert extended overtime log (remainder) with automatic approval
          const extendedOvertimeLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, overtime_status, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(overtimeCutoff)}, ${truncateToMinute(timeOut)},
              'completed', 'extended_overtime', 'approved', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(extendedOvertimeLogRes[0].id)
        } else if (totalHours > DAILY_REQUIRED_HOURS) {
          // Regular overtime scenario: regular (9h) + overtime (remainder, up to 3h)
          console.log(`Creating regular + overtime logs for ${totalHours} hours (discarding original extended overtime if any)`)
          const regularCutoff = new Date(timeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
          regularCutoff.setSeconds(0, 0)

          // Insert regular log
          const regularLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(timeIn)}, ${truncateToMinute(regularCutoff)},
              'completed', 'regular', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(regularLogRes[0].id)

          // Insert overtime log with automatic approval since admin approved the edit
          const overtimeLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, overtime_status, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(regularCutoff)}, ${truncateToMinute(timeOut)},
              'completed', 'overtime', 'approved', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(overtimeLogRes[0].id)
        } else {
          // Regular hours only: save as single continuous log (discarding all overtime)
          console.log(`Creating single regular log for ${totalHours} hours (discarding all overtime)`)
          const regularLogRes = await tx`
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
            RETURNING id
          `
          newLogIds.push(regularLogRes[0].id)
        }

        console.log(`[SINGLE APPROVAL] Created ${newLogIds.length} new logs: ${JSON.stringify(newLogIds)}`)
        
        // Update edit requests to point to the primary new log and clean up placeholder
        if (newLogIds.length > 0) {
          console.log(`[SINGLE APPROVAL] Updating edit requests to reference primary new log ${newLogIds[0]}`)
          
          // Update edit requests to point to the new primary log
          if (placeholderLogId) {
            console.log(`[SINGLE APPROVAL] Updating edit requests from placeholder ${placeholderLogId} to new log ${newLogIds[0]}`)
            await tx`
              UPDATE time_log_edit_requests
              SET log_id = ${newLogIds[0]}
              WHERE log_id = ${placeholderLogId}
            `
            
            // Delete the placeholder log
            console.log(`[SINGLE APPROVAL] Deleting placeholder log ${placeholderLogId}`)
            await tx`
              DELETE FROM time_logs WHERE id = ${placeholderLogId}
            `
          } else {
            // Fallback: update by edit request ID if no placeholder was used
            await tx`
              UPDATE time_log_edit_requests
              SET log_id = ${newLogIds[0]}
              WHERE id = ${editRequestId}
            `
          }
        }
      })
    } else if (action === "reject") {
      // If rejected, do nothing to the time log
    }

    // Update the edit request status (map action to correct database status)
    const dbStatus = action === "reject" ? "rejected" : action === "approve" ? "approved" : action
    
    console.log(`[UPDATE_TIME_LOG] Updating edit request ${editRequestId} status to ${dbStatus}, reviewer ID: ${reviewerId ? reviewerId : 'not provided'}`)
    
    if (reviewerId) {
      console.log(`[UPDATE_TIME_LOG] Setting reviewed_by to ${reviewerId} for edit request ${editRequestId}`)
      await sql`
        UPDATE time_log_edit_requests
        SET status = ${dbStatus}, reviewed_at = NOW(), reviewed_by = ${reviewerId}
        WHERE id = ${editRequestId}
      `
    } else {
      console.log(`[UPDATE_TIME_LOG] No reviewerId provided for edit request ${editRequestId}, leaving reviewed_by unchanged`)
      await sql`
        UPDATE time_log_edit_requests
        SET status = ${dbStatus}, reviewed_at = NOW()
        WHERE id = ${editRequestId}
      `
    }
    return { success: true }
  } catch (error) {
    console.error("Error updating time log edit request:", error)
    return { success: false, error: "Failed to update edit request" }
  }
}

/**
 * Processes multiple edit requests as a continuous session (admin only).
 * 
 * This function handles complex scenarios where multiple time logs need to be
 * edited as a single continuous session. It supports three actions:
 * 
 * - approve: Merges all requests into a single continuous time range
 * - reject: Marks all requests as rejected without changing time logs
 * - revert: Restores all logs to their original state
 * 
 * For single requests, it delegates to existing single-request functions.
 * For multiple requests, it uses specialized continuous session logic that
 * handles metadata tracking and proper log recreation.
 * 
 * @param requestIds Array of edit request IDs to process together
 * @param action The action to perform (approve, reject, or revert)
 * @param reviewerId Optional ID of the admin performing the action
 * @returns Success status and error message if applicable
 */
export async function processContinuousEditRequests(
  requestIds: number[],
  action: "approve" | "reject" | "revert",
  reviewerId?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    if (requestIds.length === 0) {
      return { success: false, error: "No request IDs provided" }
    }

    // For single requests, use existing logic
    if (requestIds.length === 1) {
      if (action === "revert") {
        return await revertTimeLogToOriginal(requestIds[0], reviewerId)
      } else {
        return await updateTimeLogEditRequest(requestIds[0], action, reviewerId)
      }
    }

    // For multiple continuous requests, we need special handling
    if (action === "approve") {
      return await approveContinuousEditRequests(requestIds, reviewerId)
    } else if (action === "reject") {
      return await rejectContinuousEditRequests(requestIds, reviewerId)
    } else if (action === "revert") {
      return await revertContinuousEditRequests(requestIds)
    }

    return { success: false, error: "Invalid action" }
  } catch (error) {
    console.error("Error processing continuous edit requests:", error)
    return { success: false, error: "Failed to process edit requests" }
  }
}

/**
 * Approves multiple continuous edit requests as a single session.
 * 
 * This internal function handles the complex logic of merging multiple
 * edit requests into a single continuous work session. It supports both
 * new continuous session requests (with metadata) and legacy multiple
 * requests for backward compatibility.
 * 
 * @param requestIds Array of edit request IDs to approve
 * @param reviewerId Optional ID of the reviewing admin
 * @returns Success status and error message if applicable
 */
async function approveContinuousEditRequests(requestIds: number[], reviewerId?: number): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Approving continuous edit requests: ${JSON.stringify(requestIds)}`)
    
    // Get all edit requests
    const requests = await sql`
      SELECT * FROM time_log_edit_requests 
      WHERE id = ANY(${requestIds})
      ORDER BY id
    `

    console.log(`Found ${requests.length} edit requests`)

    if (requests.length === 0) {
      return { success: false, error: "Edit requests not found" }
    }

    // Check if this is a continuous session edit request (has metadata)
    const firstRequest = requests[0]
    if (firstRequest.metadata && firstRequest.metadata.isContinuousSession) {
      // Handle continuous session edit request
      console.log("Processing continuous session edit request")
      
      const metadata = firstRequest.metadata
      const logIds = metadata.allLogIds || []
      
      if (logIds.length === 0) {
        return { success: false, error: "No log IDs found in continuous session metadata" }
      }
      
      const requestedTimeIn = firstRequest.requested_time_in
      const requestedTimeOut = firstRequest.requested_time_out
      
      if (!requestedTimeIn || !requestedTimeOut) {
        return { success: false, error: "Invalid time range in continuous session request" }
      }
      
      // Get user and date info from the first log in the session
      const logRes = await sql`SELECT user_id, created_at FROM time_logs WHERE id = ${logIds[0]}`
      if (logRes.length === 0) {
        return { success: false, error: "Associated time log not found" }
      }

      const { user_id: userId, created_at: createdAt } = logRes[0]
      
      // Calculate new time range and validate it
      const timeIn = new Date(requestedTimeIn)
      const timeOut = new Date(requestedTimeOut)
      timeIn.setSeconds(0, 0)
      timeOut.setSeconds(0, 0)
      
      // Validate time range
      if (timeOut <= timeIn) {
        throw new Error("Invalid time range: time out must be after time in")
      }
      
      const totalHours = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60)
      
      // Validate total hours is positive
      if (totalHours <= 0) {
        throw new Error("Invalid duration: total hours must be positive")
      }
      
      console.log(`Continuous session - Total hours: ${totalHours}, DAILY_REQUIRED_HOURS: ${DAILY_REQUIRED_HOURS}`)

      await sql.begin(async (tx) => {
        // For continuous sessions, use the exact log IDs from metadata instead of date-based query
        // This ensures we delete exactly the logs that were part of the original continuous session
        const logIdsToDelete = logIds
        console.log(`[CONTINUOUS APPROVAL] Using log IDs from metadata to delete: ${JSON.stringify(logIdsToDelete)}`)
        
        // Create a temporary placeholder log to handle foreign key constraints
        // This allows us to temporarily point edit requests to it while we delete and recreate logs
        let placeholderLogId: number | null = null
        if (logIdsToDelete.length > 0) {
          console.log(`[CONTINUOUS APPROVAL] Creating temporary placeholder log for foreign key constraint handling`)
          const placeholderLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(timeIn)}, ${truncateToMinute(timeOut)},
              'completed', 'regular', ${createdAt}, NOW()
            )
            RETURNING id
          `
          placeholderLogId = placeholderLogRes[0].id
          console.log(`[CONTINUOUS APPROVAL] Created temporary placeholder log ${placeholderLogId}`)
          
          // Update all edit requests that reference logs being deleted to point to the placeholder
          console.log(`[CONTINUOUS APPROVAL] Updating edit requests to reference temporary placeholder log ${placeholderLogId}`)
          await tx`
            UPDATE time_log_edit_requests
            SET log_id = ${placeholderLogId}
            WHERE log_id = ANY(${logIdsToDelete})
          `
        }

        // Delete ALL logs for this user that are part of the continuous session using exact log IDs
        console.log(`[CONTINUOUS APPROVAL] Deleting original logs for user ${userId}: ${JSON.stringify(logIdsToDelete)}`)
        if (logIdsToDelete.length > 0) {
          await tx`
            DELETE FROM time_logs
            WHERE id = ANY(${logIdsToDelete})
          `
        }

        // Create new log(s) for the approved continuous session
        // Split into regular, overtime, and potentially extended overtime based on total hours
        const newLogIds: number[] = []
        
        if (totalHours > DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) {
          // Extended overtime scenario: regular (9h) + overtime (3h) + extended overtime (remainder)
          console.log(`Splitting continuous session with extended overtime: ${totalHours} hours > ${DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS} hours`)
          const regularCutoff = new Date(timeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
          const overtimeCutoff = new Date(timeIn.getTime() + ((DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) * 60 * 60 * 1000))
          regularCutoff.setSeconds(0, 0)
          overtimeCutoff.setSeconds(0, 0)

          // Insert regular log (9 hours)
          const regularLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(timeIn)}, ${truncateToMinute(regularCutoff)},
              'completed', 'regular', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(regularLogRes[0].id)

          // Insert normal overtime log (3 hours) with automatic approval
          const overtimeLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, overtime_status, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(regularCutoff)}, ${truncateToMinute(overtimeCutoff)},
              'completed', 'overtime', 'approved', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(overtimeLogRes[0].id)

          // Insert extended overtime log (remainder) with automatic approval
          const extendedOvertimeLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, overtime_status, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(overtimeCutoff)}, ${truncateToMinute(timeOut)},
              'completed', 'extended_overtime', 'approved', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(extendedOvertimeLogRes[0].id)
        } else if (totalHours > DAILY_REQUIRED_HOURS) {
          // Regular overtime scenario: regular (9h) + overtime (remainder, up to 3h)
          console.log(`Splitting continuous session: ${totalHours} hours > ${DAILY_REQUIRED_HOURS} hours`)
          const regularCutoff = new Date(timeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
          regularCutoff.setSeconds(0, 0)

          // Insert regular log
          const regularLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(timeIn)}, ${truncateToMinute(regularCutoff)},
              'completed', 'regular', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(regularLogRes[0].id)

          // Insert overtime log with automatic approval since admin approved the edit
          const overtimeLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, overtime_status, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(regularCutoff)}, ${truncateToMinute(timeOut)},
              'completed', 'overtime', 'approved', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(overtimeLogRes[0].id)
        } else {
          // Insert single continuous log for the entire requested duration
          // This handles cases where user requests exactly 9 hours or less
          console.log(`Saving as single continuous log: ${totalHours} hours <= ${DAILY_REQUIRED_HOURS} hours`)
          const regularLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(timeIn)}, ${truncateToMinute(timeOut)},
              'completed', 'regular', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(regularLogRes[0].id)
        }

        console.log(`[CONTINUOUS APPROVAL] Created ${newLogIds.length} new logs: ${JSON.stringify(newLogIds)}`)
        
        // Update edit requests to point to the primary new log and handle placeholder cleanup
        if (newLogIds.length > 0) {
          console.log(`[CONTINUOUS APPROVAL] Updating edit requests to reference primary new log ${newLogIds[0]}`)
          
          // Update edit requests to point to the new primary log and set approved status
          if (placeholderLogId) {
            console.log(`[CONTINUOUS APPROVAL] Updating edit requests from placeholder ${placeholderLogId} to new log ${newLogIds[0]}`)
            if (reviewerId) {
              await tx`
                UPDATE time_log_edit_requests
                SET log_id = ${newLogIds[0]}, status = 'approved', reviewed_at = NOW(), reviewed_by = ${reviewerId}
                WHERE log_id = ${placeholderLogId}
              `
            } else {
              await tx`
                UPDATE time_log_edit_requests
                SET log_id = ${newLogIds[0]}, status = 'approved', reviewed_at = NOW()
                WHERE log_id = ${placeholderLogId}
              `
            }
            
            // Delete the placeholder log
            console.log(`[CONTINUOUS APPROVAL] Deleting placeholder log ${placeholderLogId}`)
            await tx`
              DELETE FROM time_logs WHERE id = ${placeholderLogId}
            `
          } else {
            // Fallback: update by request IDs if no placeholder was used
            if (reviewerId) {
              await tx`
                UPDATE time_log_edit_requests
                SET log_id = ${newLogIds[0]}, status = 'approved', reviewed_at = NOW(), reviewed_by = ${reviewerId}
                WHERE id = ANY(${requestIds})
              `
            } else {
              await tx`
                UPDATE time_log_edit_requests
                SET log_id = ${newLogIds[0]}, status = 'approved', reviewed_at = NOW()
                WHERE id = ANY(${requestIds})
              `
            }
          }
        } else {
          // Fallback: just update status without log reference if no new logs created
          if (reviewerId) {
            await tx`
              UPDATE time_log_edit_requests
              SET status = 'approved', reviewed_at = NOW(), reviewed_by = ${reviewerId}
              WHERE id = ANY(${requestIds})
            `
          } else {
            await tx`
              UPDATE time_log_edit_requests
              SET status = 'approved', reviewed_at = NOW()
              WHERE id = ANY(${requestIds})
            `
          }
        }
      })

      return { success: true }
    } else {
      // Handle legacy multiple edit requests (for backward compatibility)
      console.log("Processing legacy multiple edit requests")
      
      const requestedTimes = requests
        .map(req => ({
          timeIn: req.requested_time_in,
          timeOut: req.requested_time_out
        }))
        .filter(times => times.timeIn && times.timeOut)

      console.log(`Valid requested times: ${JSON.stringify(requestedTimes)}`)

      if (requestedTimes.length === 0) {
        return { success: false, error: "No valid time ranges in requests" }
      }

      const earliestTimeIn = requestedTimes
        .reduce((earliest, curr) => 
          new Date(curr.timeIn!) < new Date(earliest.timeIn!) ? curr : earliest
        ).timeIn!

      const latestTimeOut = requestedTimes
        .reduce((latest, curr) => 
          new Date(curr.timeOut!) > new Date(latest.timeOut!) ? curr : latest
        ).timeOut!

      console.log(`Legacy mode - Time range: ${earliestTimeIn} to ${latestTimeOut}`)

      // Get user and date info from first request  
      const firstLogId = requests[0].log_id
      const logRes = await sql`SELECT user_id, created_at FROM time_logs WHERE id = ${firstLogId}`
      if (logRes.length === 0) {
        return { success: false, error: "Associated time log not found" }
      }

      const { user_id: userId, created_at: createdAt } = logRes[0]

      // Calculate new time range and validate it
      const timeIn = new Date(earliestTimeIn)
      const timeOut = new Date(latestTimeOut)
      timeIn.setSeconds(0, 0)
      timeOut.setSeconds(0, 0)
      
      // Validate time range
      if (timeOut <= timeIn) {
        throw new Error("Invalid time range: time out must be after time in")
      }
      
      const totalHours = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60)
      
      // Validate total hours is positive
      if (totalHours <= 0) {
        throw new Error("Invalid duration: total hours must be positive")
      }
      
      console.log(`Legacy mode - Total hours: ${totalHours}, DAILY_REQUIRED_HOURS: ${DAILY_REQUIRED_HOURS}`)

      await sql.begin(async (tx) => {
        // Get the date key for this set of logs
        // Use local date instead of UTC to handle timezone correctly
        const requestedDate = new Date(earliestTimeIn)
        const dateKey = `${requestedDate.getFullYear()}-${String(requestedDate.getMonth() + 1).padStart(2, '0')}-${String(requestedDate.getDate()).padStart(2, '0')}`
        
        // Get all log IDs that will be deleted to handle foreign key constraints
        const logsToDelete = await tx`
          SELECT id FROM time_logs 
          WHERE user_id = ${userId} AND time_in::date = ${dateKey}
        `
        const logIdsToDelete = logsToDelete.map(log => log.id)
        console.log(`[LEGACY APPROVAL] Found ${logIdsToDelete.length} logs to delete: ${JSON.stringify(logIdsToDelete)}`)
        
        // Create a temporary placeholder log to handle foreign key constraints
        // This allows us to temporarily point edit requests to it while we delete and recreate logs
        let placeholderLogId: number | null = null
        if (logIdsToDelete.length > 0) {
          console.log(`[LEGACY APPROVAL] Creating temporary placeholder log for foreign key constraint handling`)
          const placeholderLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(timeIn)}, ${truncateToMinute(timeOut)},
              'completed', 'regular', ${createdAt}, NOW()
            )
            RETURNING id
          `
          placeholderLogId = placeholderLogRes[0].id
          console.log(`[LEGACY APPROVAL] Created temporary placeholder log ${placeholderLogId}`)
          
          // Update all edit requests that reference logs being deleted to point to the placeholder
          console.log(`[LEGACY APPROVAL] Updating edit requests to reference temporary placeholder log ${placeholderLogId}`)
          await tx`
            UPDATE time_log_edit_requests
            SET log_id = ${placeholderLogId}
            WHERE log_id = ANY(${logIdsToDelete})
          `
        }

        // Delete ALL logs for this user on the requested edit date using exact log IDs
        console.log(`Legacy mode - Deleting all logs for user ${userId} on date ${dateKey}`)
        if (logIdsToDelete.length > 0) {
          await tx`
            DELETE FROM time_logs
            WHERE id = ANY(${logIdsToDelete})
          `
        }

        // Create new logs with the approved time range
        // Split into regular, overtime, and potentially extended overtime based on total hours
        const newLogIds: number[] = []
        
        if (totalHours > DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) {
          // Extended overtime scenario: regular (9h) + overtime (3h) + extended overtime (remainder)
          const regularCutoff = new Date(timeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
          const overtimeCutoff = new Date(timeIn.getTime() + ((DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) * 60 * 60 * 1000))
          regularCutoff.setSeconds(0, 0)
          overtimeCutoff.setSeconds(0, 0)

          // Insert regular log (9 hours)
          const regularLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(timeIn)}, ${truncateToMinute(regularCutoff)},
              'completed', 'regular', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(regularLogRes[0].id)

          // Insert normal overtime log (3 hours) with automatic approval
          const overtimeLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, overtime_status, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(regularCutoff)}, ${truncateToMinute(overtimeCutoff)},
              'completed', 'overtime', 'approved', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(overtimeLogRes[0].id)

          // Insert extended overtime log (remainder) with automatic approval
          const extendedOvertimeLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, overtime_status, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(overtimeCutoff)}, ${truncateToMinute(timeOut)},
              'completed', 'extended_overtime', 'approved', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(extendedOvertimeLogRes[0].id)
        } else if (totalHours > DAILY_REQUIRED_HOURS) {
          // Regular overtime scenario: regular (9h) + overtime (remainder, up to 3h)
          const regularCutoff = new Date(timeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
          regularCutoff.setSeconds(0, 0)

          // Insert regular log
          const regularLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(timeIn)}, ${truncateToMinute(regularCutoff)},
              'completed', 'regular', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(regularLogRes[0].id)

          // Insert overtime log with automatic approval since admin approved the edit
          const overtimeLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, overtime_status, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(regularCutoff)}, ${truncateToMinute(timeOut)},
              'completed', 'overtime', 'approved', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(overtimeLogRes[0].id)
        } else {
          // Insert single continuous log for the entire requested duration
          // This handles cases where user requests exactly 9 hours or less
          const regularLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(timeIn)}, ${truncateToMinute(timeOut)},
              'completed', 'regular', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(regularLogRes[0].id)
        }

        console.log(`[LEGACY APPROVAL] Created ${newLogIds.length} new logs: ${JSON.stringify(newLogIds)}`)
        
        // Update edit requests to point to the primary new log and handle placeholder cleanup
        if (newLogIds.length > 0) {
          console.log(`[LEGACY APPROVAL] Updating edit requests to reference primary new log ${newLogIds[0]}`)
          
          // Update edit requests to point to the new primary log and set approved status
          if (placeholderLogId) {
            console.log(`[LEGACY APPROVAL] Updating edit requests from placeholder ${placeholderLogId} to new log ${newLogIds[0]}`)
            if (reviewerId) {
              await tx`
                UPDATE time_log_edit_requests
                SET log_id = ${newLogIds[0]}, status = 'approved', reviewed_at = NOW(), reviewed_by = ${reviewerId}
                WHERE log_id = ${placeholderLogId}
              `
            } else {
              await tx`
                UPDATE time_log_edit_requests
                SET log_id = ${newLogIds[0]}, status = 'approved', reviewed_at = NOW()
                WHERE log_id = ${placeholderLogId}
              `
            }
            
            // Delete the placeholder log
            console.log(`[LEGACY APPROVAL] Deleting placeholder log ${placeholderLogId}`)
            await tx`
              DELETE FROM time_logs WHERE id = ${placeholderLogId}
            `
          } else {
            // Fallback: update by request IDs if no placeholder was used
            if (reviewerId) {
              await tx`
                UPDATE time_log_edit_requests
                SET log_id = ${newLogIds[0]}, status = 'approved', reviewed_at = NOW(), reviewed_by = ${reviewerId}
                WHERE id = ANY(${requestIds})
              `
            } else {
              await tx`
                UPDATE time_log_edit_requests
                SET log_id = ${newLogIds[0]}, status = 'approved', reviewed_at = NOW()
                WHERE id = ANY(${requestIds})
              `
            }
          }
        } else {
          // Fallback: just update status without log reference if no new logs created
          if (reviewerId) {
            await tx`
              UPDATE time_log_edit_requests
              SET status = 'approved', reviewed_at = NOW(), reviewed_by = ${reviewerId}
              WHERE id = ANY(${requestIds})
            `
          } else {
            await tx`
              UPDATE time_log_edit_requests
              SET status = 'approved', reviewed_at = NOW()
              WHERE id = ANY(${requestIds})
            `
          }
        }
      })

      return { success: true }
    }
  } catch (error) {
    console.error("Error approving continuous edit requests:", error)
    
    // Log more specific error details
    if (error instanceof Error) {
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)
    }
    
    // Check for specific database errors
    if (typeof error === 'object' && error !== null) {
      console.error("Error details:", JSON.stringify(error, null, 2))
    }
    
    return { success: false, error: `Failed to approve continuous edit requests: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

/**
 * Rejects multiple continuous edit requests.
 * 
 * @param requestIds Array of edit request IDs to reject
 * @param reviewerId Optional ID of the reviewing admin
 * @returns Success status and error message if applicable
 */
async function rejectContinuousEditRequests(requestIds: number[], reviewerId?: number): Promise<{ success: boolean; error?: string }> {
  try {
    // Simply update all requests to rejected status
    if (reviewerId) {
      await sql`
        UPDATE time_log_edit_requests
        SET status = 'rejected', reviewed_at = NOW(), reviewed_by = ${reviewerId}
        WHERE id = ANY(${requestIds})
      `
    } else {
      await sql`
        UPDATE time_log_edit_requests
        SET status = 'rejected', reviewed_at = NOW()
        WHERE id = ANY(${requestIds})
      `
    }
    return { success: true }
  } catch (error) {
    console.error("Error rejecting continuous edit requests:", error)
    return { success: false, error: "Failed to reject continuous edit requests" }
  }
}

/**
 * Reverts multiple continuous edit requests back to pending status.
 * 
 * This function restores all time logs in a continuous session to their
 * original state and resets edit request status to pending. It handles
 * both continuous session requests (with metadata) and legacy multiple
 * requests for backward compatibility.
 * 
 * @param requestIds Array of edit request IDs to revert
 * @returns Success status and error message if applicable
 */
async function revertContinuousEditRequests(requestIds: number[]): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Reverting continuous edit requests: ${JSON.stringify(requestIds)}`)
    
    // Get all edit requests
    const requests = await sql`
      SELECT * FROM time_log_edit_requests 
      WHERE id = ANY(${requestIds})
      ORDER BY id
    `

    if (requests.length === 0) {
      return { success: false, error: "Edit requests not found" }
    }

    const firstRequest = requests[0]
    
    // Check if this is a continuous session edit request (has metadata)
    if (firstRequest.metadata && firstRequest.metadata.isContinuousSession) {
      console.log("Reverting continuous session edit request")
      
      const metadata = firstRequest.metadata
      const logIds = metadata.allLogIds || []
      
      if (logIds.length === 0) {
        return { success: false, error: "No log IDs found in continuous session metadata" }
      }
      
      // Get the original time range from the edit request
      const originalTimeIn = firstRequest.original_time_in
      const originalTimeOut = firstRequest.original_time_out
      
      if (!originalTimeIn || !originalTimeOut) {
        return { success: false, error: "Invalid original time range in continuous session request" }
      }
      
      // Get user and date info from the first log in the session
      const logRes = await sql`SELECT user_id, created_at FROM time_logs WHERE id = ${logIds[0]}`
      if (logRes.length === 0) {
        return { success: false, error: "Associated time log not found" }
      }

      const { user_id: userId, created_at: createdAt } = logRes[0]
      // Use local date instead of UTC to handle timezone correctly
      const originalDate = new Date(originalTimeIn)
      const dateKey = `${originalDate.getFullYear()}-${String(originalDate.getMonth() + 1).padStart(2, '0')}-${String(originalDate.getDate()).padStart(2, '0')}`
      
      // Calculate original time range
      const timeIn = new Date(originalTimeIn)
      const timeOut = new Date(originalTimeOut)
      timeIn.setSeconds(0, 0)
      timeOut.setSeconds(0, 0)
      
      const totalHours = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60)
      
      console.log(`Reverting to original continuous session - Total hours: ${totalHours}`)

      await sql.begin(async (tx) => {
        // For continuous sessions, use the exact log IDs from metadata instead of date-based query
        // This ensures we delete exactly the logs that were part of the original continuous session
        const logIdsToDelete = logIds
        console.log(`[CONTINUOUS REVERT] Using log IDs from metadata to delete: ${JSON.stringify(logIdsToDelete)}`)
        
        // Create a temporary placeholder log to handle foreign key constraints
        // This allows us to temporarily point edit requests to it while we delete and recreate logs
        let placeholderLogId: number | null = null
        if (logIdsToDelete.length > 0) {
          console.log(`[CONTINUOUS REVERT] Creating temporary placeholder log for foreign key constraint handling`)
          const placeholderLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(timeIn)}, ${truncateToMinute(timeOut)},
              'completed', 'regular', ${createdAt}, NOW()
            )
            RETURNING id
          `
          placeholderLogId = placeholderLogRes[0].id
          console.log(`[CONTINUOUS REVERT] Created temporary placeholder log ${placeholderLogId}`)
          
          // Update all edit requests that reference logs being deleted to point to the placeholder
          console.log(`[CONTINUOUS REVERT] Updating edit requests to reference temporary placeholder log ${placeholderLogId}`)
          await tx`
            UPDATE time_log_edit_requests 
            SET log_id = ${placeholderLogId}
            WHERE log_id = ANY(${logIdsToDelete})
          `
        }
        
        // Delete all current logs for the continuous session using exact log IDs
        console.log(`[CONTINUOUS REVERT] Deleting original logs for user ${userId}: ${JSON.stringify(logIdsToDelete)}`)
        if (logIdsToDelete.length > 0) {
          await tx`
            DELETE FROM time_logs
            WHERE id = ANY(${logIdsToDelete})
          `
        }

        // Restore the original time range, splitting as needed
        const newLogIds: number[] = []
        
        if (totalHours > DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) {
          // Extended overtime scenario: regular (9h) + overtime (3h) + extended overtime (remainder)
          console.log(`Restoring with extended overtime: ${totalHours} hours > ${DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS} hours`)
          const regularCutoff = new Date(timeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
          const overtimeCutoff = new Date(timeIn.getTime() + ((DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) * 60 * 60 * 1000))
          regularCutoff.setSeconds(0, 0)
          overtimeCutoff.setSeconds(0, 0)

          // Insert regular log (9 hours)
          const regularLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(timeIn)}, ${truncateToMinute(regularCutoff)},
              'completed', 'regular', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(regularLogRes[0].id)

          // Insert normal overtime log (3 hours) with pending status (reverted to original state)
          const overtimeLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, overtime_status, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(regularCutoff)}, ${truncateToMinute(overtimeCutoff)},
              'completed', 'overtime', 'pending', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(overtimeLogRes[0].id)

          // Insert extended overtime log (remainder) with pending status
          const extendedOvertimeLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, overtime_status, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(overtimeCutoff)}, ${truncateToMinute(timeOut)},
              'completed', 'extended_overtime', 'pending', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(extendedOvertimeLogRes[0].id)
        } else if (totalHours > DAILY_REQUIRED_HOURS) {
          // Regular overtime scenario: regular (9h) + overtime (remainder, up to 3h)
          console.log(`Restoring with overtime: ${totalHours} hours > ${DAILY_REQUIRED_HOURS} hours`)
          const regularCutoff = new Date(timeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
          regularCutoff.setSeconds(0, 0)

          // Insert regular log
          const regularLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(timeIn)}, ${truncateToMinute(regularCutoff)},
              'completed', 'regular', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(regularLogRes[0].id)

          // Insert overtime log with pending status (reverted to original state)
          const overtimeLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, overtime_status, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(regularCutoff)}, ${truncateToMinute(timeOut)},
              'completed', 'overtime', 'pending', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(overtimeLogRes[0].id)
        } else {
          // Insert single continuous log for the entire original duration
          console.log(`Restoring as single continuous log: ${totalHours} hours <= ${DAILY_REQUIRED_HOURS} hours`)
          const regularLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(timeIn)}, ${truncateToMinute(timeOut)},
              'completed', 'regular', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(regularLogRes[0].id)
        }

        console.log(`[CONTINUOUS REVERT] Created ${newLogIds.length} new logs: ${JSON.stringify(newLogIds)}`)
        
        // Update edit requests to point to the primary new log and handle placeholder cleanup
        if (newLogIds.length > 0) {
          console.log(`[CONTINUOUS REVERT] Updating edit requests to reference primary new log ${newLogIds[0]} and set to pending`)
          
          // Update the metadata to reflect the new log IDs created during revert
          // This ensures that future approve/revert operations work correctly
          const updatedMetadata = {
            ...metadata,
            allLogIds: newLogIds,
            originalLogs: newLogIds.map((id, index) => {
              const logType = index === 0 ? 'regular' : 
                            index === 1 ? 'overtime' : 'extended_overtime'
              return {
                id,
                timeIn: index === 0 ? timeIn.toISOString() : 
                       index === 1 ? new Date(timeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000)).toISOString() :
                       new Date(timeIn.getTime() + ((DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) * 60 * 60 * 1000)).toISOString(),
                timeOut: index === newLogIds.length - 1 ? timeOut.toISOString() :
                        index === 0 ? new Date(timeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000)).toISOString() :
                        new Date(timeIn.getTime() + ((DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) * 60 * 60 * 1000)).toISOString(),
                logType
              }
            })
          }
          
          console.log(`[CONTINUOUS REVERT] Updated metadata with new log IDs: ${JSON.stringify(updatedMetadata)}`)
          
          // Update edit requests to point to the new primary log and set pending status
          if (placeholderLogId) {
            console.log(`[CONTINUOUS REVERT] Updating edit requests from placeholder ${placeholderLogId} to new log ${newLogIds[0]}`)
            await tx`
              UPDATE time_log_edit_requests
              SET log_id = ${newLogIds[0]}, status = 'pending', reviewed_at = NULL, reviewed_by = NULL, metadata = ${JSON.stringify(updatedMetadata)}
              WHERE log_id = ${placeholderLogId}
            `
            
            // Delete the placeholder log
            console.log(`[CONTINUOUS REVERT] Deleting placeholder log ${placeholderLogId}`)
            await tx`
              DELETE FROM time_logs WHERE id = ${placeholderLogId}
            `
          } else {
            // Fallback: update by request IDs if no placeholder was used
            console.log(`[CONTINUOUS REVERT] No placeholder used, directly updating edit requests to point to new log ${newLogIds[0]}`)
            await tx`
              UPDATE time_log_edit_requests
              SET log_id = ${newLogIds[0]}, status = 'pending', reviewed_at = NULL, reviewed_by = NULL, metadata = ${JSON.stringify(updatedMetadata)}
              WHERE id = ANY(${requestIds})
            `
            
            // Also delete any old logs that might exist (in case they weren't caught earlier)
            if (logIdsToDelete.length > 0) {
              console.log(`[CONTINUOUS REVERT] Deleting old logs that weren't handled by placeholder: ${JSON.stringify(logIdsToDelete)}`)
              await tx`
                DELETE FROM time_logs
                WHERE user_id = ${userId} AND time_in::date = ${dateKey} AND id != ALL(${newLogIds})
              `
            }
          }
        } else {
          // Fallback: just update status without log reference if no new logs created
          await tx`
            UPDATE time_log_edit_requests
            SET status = 'pending', reviewed_at = NULL, reviewed_by = NULL
            WHERE id = ANY(${requestIds})
          `
        }
      })

      return { success: true }
    } else {
      // Handle legacy multiple edit requests (for backward compatibility)
      console.log("Reverting legacy multiple edit requests")
      
      // Get user info from the first request's original data
      const firstLogId = firstRequest.log_id
      const logRes = await sql`SELECT user_id, created_at FROM time_logs WHERE id = ${firstLogId}`
      if (logRes.length === 0) {
        return { success: false, error: "Associated time log not found" }
      }

      const { user_id: userId, created_at: createdAt } = logRes[0]
      const dateKey = new Date(firstRequest.original_time_in).toISOString().slice(0, 10)

      // Calculate the original time range from all requests
      const requestedTimes = requests
        .map(req => ({
          timeIn: req.original_time_in,
          timeOut: req.original_time_out
        }))
        .filter(times => times.timeIn && times.timeOut)

      if (requestedTimes.length === 0) {
        return { success: false, error: "No valid original time ranges in requests" }
      }

      const earliestTimeIn = requestedTimes
        .reduce((earliest, curr) => 
          new Date(curr.timeIn!) < new Date(earliest.timeIn!) ? curr : earliest
        ).timeIn!

      const latestTimeOut = requestedTimes
        .reduce((latest, curr) => 
          new Date(curr.timeOut!) > new Date(latest.timeOut!) ? curr : latest
        ).timeOut!

      console.log(`Legacy revert - Time range: ${earliestTimeIn} to ${latestTimeOut}`)

      // Calculate original time range
      const timeIn = new Date(earliestTimeIn)
      const timeOut = new Date(latestTimeOut)
      timeIn.setSeconds(0, 0)
      timeOut.setSeconds(0, 0)
      
      const totalHours = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60)
      
      console.log(`Legacy revert - Total hours: ${totalHours}`)

      await sql.begin(async (tx) => {
        // First, get all log IDs that will be deleted to handle foreign key constraints
        const logsToDelete = await tx`
          SELECT id FROM time_logs 
          WHERE user_id = ${userId} AND time_in::date = ${dateKey}
        `
        const logIdsToDelete = logsToDelete.map(log => log.id)
        console.log(`[LEGACY REVERT] Found ${logIdsToDelete.length} logs to delete: ${JSON.stringify(logIdsToDelete)}`)
        
        // Create a temporary placeholder log to handle foreign key constraints
        let placeholderLogId: number | null = null
        if (logIdsToDelete.length > 0) {
          console.log(`[LEGACY REVERT] Creating temporary placeholder log for foreign key constraint handling`)
          const placeholderLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(timeIn)}, ${truncateToMinute(timeOut)},
              'completed', 'regular', ${createdAt}, NOW()
            )
            RETURNING id
          `
          placeholderLogId = placeholderLogRes[0].id
          console.log(`[LEGACY REVERT] Created temporary placeholder log ${placeholderLogId}`)
          
          // Update all edit requests that reference logs being deleted to point to the placeholder
          await tx`
            UPDATE time_log_edit_requests 
            SET log_id = ${placeholderLogId}
            WHERE log_id = ANY(${logIdsToDelete})
          `
        }
        
        // Delete all current logs for the date/user using exact log IDs
        console.log(`[LEGACY REVERT] Deleting current logs for user ${userId} on date ${dateKey}`)
        if (logIdsToDelete.length > 0) {
          await tx`
            DELETE FROM time_logs
            WHERE id = ANY(${logIdsToDelete})
          `
        }

        // Restore the original time range, splitting as needed
        const newLogIds: number[] = []
        
        if (totalHours > DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) {
          // Extended overtime scenario: regular (9h) + overtime (3h) + extended overtime (remainder)
          console.log(`[LEGACY REVERT] Restoring with extended overtime: ${totalHours} hours`)
          const regularCutoff = new Date(timeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
          const overtimeCutoff = new Date(timeIn.getTime() + ((DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) * 60 * 60 * 1000))
          regularCutoff.setSeconds(0, 0)
          overtimeCutoff.setSeconds(0, 0)

          // Insert regular log (9 hours)
          const regularLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(timeIn)}, ${truncateToMinute(regularCutoff)},
              'completed', 'regular', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(regularLogRes[0].id)

          // Insert normal overtime log (3 hours) with pending status
          const overtimeLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, overtime_status, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(regularCutoff)}, ${truncateToMinute(overtimeCutoff)},
              'completed', 'overtime', 'pending', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(overtimeLogRes[0].id)

          // Insert extended overtime log (remainder) with pending status
          const extendedOvertimeLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, overtime_status, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(overtimeCutoff)}, ${truncateToMinute(timeOut)},
              'completed', 'extended_overtime', 'pending', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(extendedOvertimeLogRes[0].id)
        } else if (totalHours > DAILY_REQUIRED_HOURS) {
          // Regular overtime scenario: regular (9h) + overtime (remainder, up to 3h)
          console.log(`[LEGACY REVERT] Restoring with overtime: ${totalHours} hours`)
          const regularCutoff = new Date(timeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
          regularCutoff.setSeconds(0, 0)

          // Insert regular log
          const regularLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(timeIn)}, ${truncateToMinute(regularCutoff)},
              'completed', 'regular', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(regularLogRes[0].id)

          // Insert overtime log with pending status
          const overtimeLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, overtime_status, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(regularCutoff)}, ${truncateToMinute(timeOut)},
              'completed', 'overtime', 'pending', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(overtimeLogRes[0].id)
        } else {
          // Insert single continuous log for the entire original duration
          console.log(`[LEGACY REVERT] Restoring as single continuous log: ${totalHours} hours`)
          const regularLogRes = await tx`
            INSERT INTO time_logs (
              user_id, time_in, time_out, status, log_type, created_at, updated_at
            ) VALUES (
              ${userId}, ${truncateToMinute(timeIn)}, ${truncateToMinute(timeOut)},
              'completed', 'regular', ${createdAt}, NOW()
            )
            RETURNING id
          `
          newLogIds.push(regularLogRes[0].id)
        }

        console.log(`[LEGACY REVERT] Created ${newLogIds.length} new logs: ${JSON.stringify(newLogIds)}`)
        
        // Update edit requests to point to the primary new log and handle placeholder cleanup
        if (newLogIds.length > 0) {
          console.log(`[LEGACY REVERT] Updating edit requests to reference primary new log ${newLogIds[0]} and set to pending`)
          
          // Update edit requests to point to the new primary log and set pending status
          if (placeholderLogId) {
            console.log(`[LEGACY REVERT] Updating edit requests from placeholder ${placeholderLogId} to new log ${newLogIds[0]}`)
            await tx`
              UPDATE time_log_edit_requests
              SET log_id = ${newLogIds[0]}, status = 'pending', reviewed_at = NULL, reviewed_by = NULL
              WHERE log_id = ${placeholderLogId}
            `
            
            // Delete the placeholder log
            console.log(`[LEGACY REVERT] Deleting placeholder log ${placeholderLogId}`)
            await tx`
              DELETE FROM time_logs WHERE id = ${placeholderLogId}
            `
          } else {
            // Fallback: update by request IDs if no placeholder was used
            await tx`
              UPDATE time_log_edit_requests
              SET log_id = ${newLogIds[0]}, status = 'pending', reviewed_at = NULL, reviewed_by = NULL
              WHERE id = ANY(${requestIds})
            `
          }
        } else {
          // Fallback: just update status without log reference if no new logs created
          await tx`
            UPDATE time_log_edit_requests
            SET status = 'pending', reviewed_at = NULL, reviewed_by = NULL
            WHERE id = ANY(${requestIds})
          `
        }
      })

      return { success: true }
    }
  } catch (error) {
    console.error("Error reverting continuous edit requests:", error)
    return { success: false, error: "Failed to revert continuous edit requests" }
  }
}

/**
 * Creates a single edit request for a continuous session spanning multiple logs.
 * 
 * This function merges multiple time logs into a single edit request for
 * easier admin review. It stores metadata about the original logs to enable
 * proper restoration and handles the complex session merging logic.
 * 
 * The function:
 * - Validates all provided log IDs
 * - Determines the earliest time_in and latest time_out from original logs
 * - Creates a single edit request representing the merged session
 * - Stores original log metadata for restoration purposes
 * 
 * @param params Object containing log IDs, requester, and requested times
 * @returns Success status with edit request ID or error message
 */
export async function createContinuousSessionEditRequest(params: {
  logIds: number[]
  requestedBy: number | string
  requestedTimeIn: string
  requestedTimeOut: string
}): Promise<{ success: boolean; error?: string; editRequestId?: number }> {
  try {
    if (params.logIds.length === 0) {
      return { success: false, error: "No log IDs provided" }
    }

    // Get all logs in chronological order and validate them
    const logsRes = await sql`
      SELECT id, time_in, time_out, log_type 
      FROM time_logs 
      WHERE id = ANY(${params.logIds})
      ORDER BY time_in ASC
    `
    
    if (logsRes.length === 0) {
      return { success: false, error: "No time logs found" }
    }

    if (logsRes.length !== params.logIds.length) {
      return { success: false, error: "Some time logs not found" }
    }

    // Determine session boundaries from original logs
    const originalTimeIn = logsRes[0].time_in
    const originalTimeOut = logsRes[logsRes.length - 1].time_out

    if (!originalTimeIn) {
      return { success: false, error: "First log has no time_in" }
    }

    // Use first log as representative and store session metadata
    const representativeLogId = logsRes[0].id
    
    const sessionMetadata = {
      isContinuousSession: true,
      allLogIds: params.logIds,
      originalLogs: logsRes.map(log => ({
        id: log.id,
        timeIn: log.time_in,
        timeOut: log.time_out,
        logType: log.log_type
      }))
    }

    const result = await sql`
      INSERT INTO time_log_edit_requests (
        log_id, 
        original_time_in, 
        original_time_out, 
        requested_time_in, 
        requested_time_out, 
        status, 
        requested_by,
        metadata
      )
      VALUES (
        ${representativeLogId},
        ${originalTimeIn},
        ${originalTimeOut},
        ${truncateToMinute(params.requestedTimeIn)},
        ${truncateToMinute(params.requestedTimeOut)},
        'pending',
        ${params.requestedBy},
        ${JSON.stringify(sessionMetadata)}
      )
      RETURNING id
    `
    
    return { success: true, editRequestId: result[0].id }
  } catch (error) {
    console.error("Error creating continuous session edit request:", error)
    return { success: false, error: "Failed to create continuous session edit request" }
  }
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
function truncateToMinute(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${date}`)
  }
  d.setSeconds(0, 0)
  return d.toISOString()
}

/**
 * Checks if there are any long logs that need migration (system-wide).
 * 
 * @returns Object with hasLongLogs boolean and count of logs needing migration
 */
export async function checkLongLogs(): Promise<{ hasLongLogs: boolean; count: number }> {
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
  const count = Number(res[0]?.count) || 0
  return { hasLongLogs: count > 0, count }
}

/**
 * Executes the migration to split all long logs (system-wide).
 * 
 * @returns Object with success status, processed count, and any errors
 */
export async function migrateLongLogs(): Promise<{ success: boolean; processed: number; errors: string[] }> {
  return migrateExistingLongLogs()
}

/**
 * Checks for long logs for a specific user.
 * 
 * @param userId The ID of the user to check
 * @returns Object with hasLongLogs boolean and count of logs needing migration
 */
export async function checkLongLogsForUser(userId: number): Promise<{ hasLongLogs: boolean; count: number }> {
  const res = await sql`
    SELECT COUNT(*) AS count
    FROM time_logs
    WHERE status = 'completed'
      AND time_in IS NOT NULL
      AND time_out IS NOT NULL
      AND user_id = ${userId}
      AND EXTRACT(EPOCH FROM (time_out - time_in)) / 3600 > ${DAILY_REQUIRED_HOURS}
      AND (
        log_type = 'regular'
        OR (log_type = 'overtime' AND EXTRACT(EPOCH FROM (time_out - time_in)) / 3600 > ${DAILY_REQUIRED_HOURS})
      )
  `
  const count = Number(res[0]?.count) || 0
  return { hasLongLogs: count > 0, count }
}

/**
 * Executes the migration to split long logs for a specific user.
 * 
 * This function applies the same migration logic as the system-wide migration
 * but limits the scope to a single user's time logs.
 * 
 * @param userId The ID of the user whose logs should be migrated
 * @returns Object with success status, processed count, and any errors
 */
export async function migrateLongLogsForUser(userId: number): Promise<{ 
  success: boolean; 
  processed: number; 
  errors: string[] 
}> {
  const errors: string[] = []
  let processed = 0

  try {
    // Find all long logs for the specific user
    const longLogs = await sql`
      SELECT id, user_id, time_in, time_out, created_at, log_type
      FROM time_logs 
      WHERE status = 'completed' 
        AND time_in IS NOT NULL 
        AND time_out IS NOT NULL
        AND user_id = ${userId}
        AND EXTRACT(EPOCH FROM (time_out - time_in)) / 3600 > ${DAILY_REQUIRED_HOURS}
        AND (
          log_type = 'regular' 
          OR (log_type = 'overtime' AND EXTRACT(EPOCH FROM (time_out - time_in)) / 3600 > ${DAILY_REQUIRED_HOURS})
        )
      ORDER BY created_at ASC
    `

    // Process each log using the same logic as global migration
    for (const log of longLogs) {
      try {
        const timeIn = new Date(log.time_in)
        const timeOut = new Date(log.time_out)
        timeIn.setSeconds(0, 0)
        timeOut.setSeconds(0, 0)
        const totalHours = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60)
        if (totalHours <= DAILY_REQUIRED_HOURS) continue

        // Calculate split points
        const regularEndTime = new Date(timeIn.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
        regularEndTime.setSeconds(0, 0)
        const overtimeStartTime = new Date(regularEndTime.getTime())
        overtimeStartTime.setSeconds(0, 0)

        await sql.begin(async (tx) => {
          if (log.log_type === 'regular') {
            // Update to regular hours only, create overtime log
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
            // Create regular log, update to overtime only
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
        console.error(`Error processing log ${log.id}:`, error)
        errors.push(`Log ${log.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return { success: errors.length === 0, processed, errors }
  } catch (error) {
    console.error("Migration error:", error)
    return { 
      success: false, 
      processed, 
      errors: [error instanceof Error ? error.message : 'Unknown error'] 
    }
  }
}
