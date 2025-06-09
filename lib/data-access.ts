import type {
  UserWithDetails,
  TimeLog,
  TimeLogWithDetails,
  UserProfile,
  Project,
  ProjectWithDetails,
  InternProjectAssignment,
  User,
  Department,
  School,
  InternshipProgram,
} from "./database"
import { sql } from "./database"

// Helper for projects
async function getProjectById(projectId: number): Promise<Project | null> {
  const res = await sql`SELECT * FROM projects WHERE id = ${projectId}`
  if (res.length === 0) return null
  // Cast to Project
  return res[0] as Project
}

// User operations
export async function getUserWithDetails(userId: string): Promise<UserWithDetails | null> {
  try {
    const userIdNum = Number(userId)
    // Fetch user
    const userRes = await sql`
      SELECT id, email, first_name, last_name, role, created_at, updated_at
      FROM users
      WHERE id = ${userIdNum}
    `
    if (userRes.length === 0) return null
    const user = userRes[0] as User

    // Fetch profile
    const profileRes = await sql`
      SELECT * FROM user_profiles WHERE user_id = ${userIdNum}
    `
    const profile = profileRes.length > 0 ? (profileRes[0] as UserProfile) : undefined

    // Fetch internship
    const internshipRes = await sql`
      SELECT ip.*, 
             s.id as school_id, s.name AS school_name, 
             d.id as department_id, d.name AS department_name,
             u.id as supervisor_id, u.first_name AS supervisor_first_name, u.last_name AS supervisor_last_name
      FROM internship_programs ip
      LEFT JOIN schools s ON ip.school_id = s.id
      LEFT JOIN departments d ON ip.department_id = d.id
      LEFT JOIN users u ON ip.supervisor_id = u.id
      WHERE ip.user_id = ${userIdNum}
      ORDER BY ip.created_at DESC
      LIMIT 1
    `
    let internship: (InternshipProgram & { school: School; department: Department }) | undefined = undefined
    if (internshipRes.length > 0) {
      const row = internshipRes[0]
      internship = {
        // InternshipProgram fields
        id: row.id,
        user_id: row.user_id,
        school_id: row.school_id,
        department_id: row.department_id,
        required_hours: row.required_hours,
        start_date: row.start_date,
        end_date: row.end_date,
        supervisor_id: row.supervisor_id,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        // School and Department objects
        school: { id: row.school_id, name: row.school_name, created_at: "", address: undefined, contact_email: undefined, contact_phone: undefined },
        department: { id: row.department_id, name: row.department_name, created_at: "", description: undefined, supervisor_id: row.supervisor_id },
        // Optionally, you can add supervisor fields to the root object or as a separate property if you extend the type
      }
    }

    // Fetch completed hours
    const completedHoursRes = await sql`
      SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (time_out - time_in))/3600) - SUM(break_duration)/60, 0) AS completed_hours
      FROM time_logs
      WHERE user_id = ${userIdNum} AND status = 'approved'
    `
    const completedHours = Number(completedHoursRes[0]?.completed_hours || 0)

    // Fetch today's status
    const today = new Date().toISOString().split("T")[0]
    const todayLogRes = await sql`
      SELECT * FROM time_logs WHERE user_id = ${userIdNum} AND date = ${today}
    `
    let todayStatus: "in" | "out" = "out"
    if (todayLogRes.length > 0 && todayLogRes[0].time_in && !todayLogRes[0].time_out) {
      todayStatus = "in"
    }

    // Fetch projects
    const projects = await getInternProjects(userId)

    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
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

// Time log operations
export async function clockIn(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userIdNum = Number(userId)
    const today = new Date().toISOString().split("T")[0]
    // Check if any log exists for today
    const existing = await sql`
      SELECT * FROM time_logs
      WHERE user_id = ${userIdNum} AND date = ${today}
    `
    if (existing.length > 0) {
      return { success: false, error: "Already clocked in and out today" }
    }
    await sql`
      INSERT INTO time_logs (user_id, date, time_in, break_duration, status, created_at, updated_at)
      VALUES (${userIdNum}, ${today}, NOW(), 0, 'pending', NOW(), NOW())
    `
    return { success: true }
  } catch (error) {
    console.error("Error clocking in:", error)
    return { success: false, error: "Failed to clock in" }
  }
}

export async function clockOut(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userIdNum = Number(userId)
    const today = new Date().toISOString().split("T")[0]
    const res = await sql`
      UPDATE time_logs
      SET time_out = NOW(), status = 'approved', updated_at = NOW()
      WHERE user_id = ${userIdNum} AND date = ${today} AND time_out IS NULL
      RETURNING *
    `
    if (res.length === 0) {
      return { success: false, error: "No active clock-in found for today" }
    }
    return { success: true }
  } catch (error) {
    console.error("Error clocking out:", error)
    return { success: false, error: "Failed to clock out" }
  }
}

export async function getTimeLogsForUser(userId: string, limit = 10): Promise<TimeLog[]> {
  try {
    const userIdNum = Number(userId)
    const res = await sql`
      SELECT * FROM time_logs
      WHERE user_id = ${userIdNum}
      ORDER BY date DESC
      LIMIT ${limit}
    `
    return res.map(row => ({
      id: row.id,
      user_id: row.user_id,
      date: row.date,
      time_in: row.time_in,
      time_out: row.time_out,
      break_duration: row.break_duration,
      notes: row.notes,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })) as TimeLog[]
  } catch (error) {
    console.error("Error fetching time logs:", error)
    return []
  }
}

export async function getTodayTimeLog(userId: string): Promise<TimeLog | null> {
  try {
    const userIdNum = Number(userId)
    const today = new Date().toISOString().split("T")[0]
    const res = await sql`
      SELECT * FROM time_logs WHERE user_id = ${userIdNum} AND date = ${today}
    `
    return res.length > 0 ? (res[0] as TimeLog) : null
  } catch (error) {
    console.error("Error fetching today time log:", error)
    return null
  }
}

// Intern-Project Assignment operations
export async function getInternProjects(userId: string): Promise<(InternProjectAssignment & { project: Project })[]> {
  try {
    const userIdNum = Number(userId)
    const assignmentsRes = await sql`
      SELECT * FROM intern_project_assignments WHERE user_id = ${userIdNum}
    `
    // Map each row to InternProjectAssignment
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
          department_id: 0, // Use 0 as a fallback for number
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

export async function updateUserProfile(userId: string, profileData: any): Promise<{ success: boolean; error?: string }> {
  try {
    const userIdNum = Number(userId)
    const toDateString = (val: any) => {
      if (!val) return null
      if (val instanceof Date) return val.toISOString().slice(0, 10)
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
      const d = new Date(val)
      return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
    }

    // Update users table
    await sql`
      UPDATE users
      SET first_name = ${profileData.firstName},
          last_name = ${profileData.lastName},
          email = ${profileData.email},
          updated_at = NOW()
      WHERE id = ${userIdNum}
    `

    // Update user_profiles table
    await sql`
      UPDATE user_profiles
      SET
        phone = ${profileData.phone},
        address = ${profileData.address},
        city = ${profileData.city},
        state = ${profileData.state},
        zip_code = ${profileData.zipCode},
        date_of_birth = ${toDateString(profileData.dateOfBirth)},
        bio = ${profileData.bio},
        degree = ${profileData.degree},
        major = ${profileData.major},
        minor = ${profileData.minor},
        gpa = ${profileData.gpa ? Number(profileData.gpa) : null},
        graduation_date = ${toDateString(profileData.graduationDate)},
        skills = ${profileData.skills},
        interests = ${profileData.interests},
        languages = ${profileData.languages},
        emergency_contact_name = ${profileData.emergencyContactName},
        emergency_contact_relation = ${profileData.emergencyContactRelation},
        emergency_contact_phone = ${profileData.emergencyContactPhone},
        updated_at = NOW()
      WHERE user_id = ${userIdNum}
    `

    // Update internship_programs table (education info)
    await sql`
      UPDATE internship_programs
      SET
        start_date = ${toDateString(profileData.startDate)},
        end_date = ${toDateString(profileData.endDate)},
        supervisor_id = (
          SELECT id FROM users
          WHERE (first_name || ' ' || last_name) ILIKE ${profileData.supervisor}
          LIMIT 1
        ),
        updated_at = NOW()
      WHERE user_id = ${userIdNum}
    `

    return { success: true }
  } catch (error) {
    console.error("Error updating user profile:", error)
    return { success: false, error: "Failed to update profile" }
  }
}

export async function getAllTimeLogsWithDetails(): Promise<TimeLogWithDetails[]> {
  // Implement your admin logs logic here
  return []
}
