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
import { calculateInternshipProgress, calculateTimeWorked } from "./time-utils"

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
 * Clock in a user for regular or overtime work
 */
export async function clockIn(userId: string, time?: string, logType: "regular" | "overtime" = "regular"): Promise<{ success: boolean; error?: string }> {
  try {
    const userIdNum = Number(userId)
    const existing = await sql`
      SELECT * FROM time_logs
      WHERE user_id = ${userIdNum} AND status = 'pending' AND log_type = ${logType}
    `
    if (existing.length > 0) {
      return { success: false, error: `You are already clocked in for ${logType}. Please clock out before clocking in again.` }
    }
    await sql`
      INSERT INTO time_logs (user_id, time_in, status, log_type, created_at, updated_at)
      VALUES (${userIdNum}, ${time ?? sql`NOW()`}, 'pending', ${logType}, NOW(), NOW())
    `
    return { success: true }
  } catch (error) {
    console.error("Error clocking in:", error)
    return { success: false, error: "Failed to clock in" }
  }
}

/**
 * Clock out a user from regular or overtime work
 */
export async function clockOut(userId: string, time?: string, logType: "regular" | "overtime" = "regular"): Promise<{ success: boolean; error?: string }> {
  try {
    const userIdNum = Number(userId)
    const res = await sql`
      UPDATE time_logs
      SET time_out = ${time ?? sql`NOW()`}, status = 'completed', updated_at = NOW()
      WHERE user_id = ${userIdNum} AND status = 'pending' AND time_out IS NULL AND log_type = ${logType}
      RETURNING *
    `
    if (res.length === 0) {
      return { success: false, error: `No active ${logType} clock-in found` }
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
    return res.length > 0 ? (res[0] as TimeLog) : null
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

function calculateDuration(timeIn: string, timeOut: string) {
  const inDate = new Date(timeIn)
  const outDate = new Date(timeOut)
  const diffMs = outDate.getTime() - inDate.getTime()
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`
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
