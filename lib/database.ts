import postgres from "postgres"

/**
 * PostgreSQL database connection using the DATABASE_URL environment variable.
 * Compatible with Vercel, Railway, and local development setups.
 */
export const sql = postgres(process.env.DATABASE_URL!, {
  ssl: process.env.DB_SSL === "true" ? "require" : undefined,
})

// --- Database Type Definitions ---

/**
 * User entity representing system users (interns and admins)
 */
export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  role: "intern" | "admin"
  work_schedule?: string | object
  created_at: string
  updated_at: string
}

/**
 * School entity representing educational institutions
 */
export interface School {
  id: number
  name: string
  address?: string
  contact_email?: string
  contact_phone?: string
  created_at: string
}

/**
 * Department entity representing organizational departments
 */
export interface Department {
  id: number
  name: string
  description?: string
  supervisor_id?: number
  created_at: string
}

/**
 * Project entity representing work projects
 */
export interface Project {
  id: number
  name: string
  description?: string
  start_date?: string
  end_date?: string
  status: "active" | "completed" | "on-hold" | "cancelled"
  department_id: number
  created_at: string
  updated_at: string
  department?: Department
}

/**
 * Intern project assignment linking users to projects
 */
export interface InternProjectAssignment {
  id: number
  user_id: number
  project_id: number
  assigned_date: string
  role?: string
  created_at: string
  updated_at: string
  project?: Project
}

/**
 * Internship program entity representing an intern's program details
 */
export interface InternshipProgram {
  id: number
  user_id: number
  school_id: number
  department_id: number
  required_hours: number
  start_date: string
  end_date: string
  supervisor_id?: number
  status: "active" | "completed" | "suspended"
  created_at: string
  updated_at: string
}

/**
 * Time log entity for tracking work hours
 */
export interface TimeLog {
  id: number
  user_id: number
  time_in?: string
  time_out?: string
  notes?: string
  status: "pending" | "completed"
  approved_by?: number
  approved_at?: string
  log_type?: "regular" | "overtime"
  overtime_status?: "pending" | "approved" | "rejected"
  created_at: string
  updated_at: string
}

/**
 * User profile entity containing additional user information
 */
export interface UserProfile {
  id: number
  user_id: number
  phone?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  date_of_birth?: string
  bio?: string
  degree?: string
  major?: string
  minor?: string
  gpa?: number
  graduation_date?: string
  skills?: string[]
  interests?: string[]
  languages?: string[]
  emergency_contact_name?: string
  emergency_contact_relation?: string
  emergency_contact_phone?: string
  created_at: string
  updated_at: string
}

/**
 * Extended user type with joined profile, internship, and project data
 */
export interface UserWithDetails extends User {
  profile?: UserProfile
  internship?: InternshipProgram & {
    school: School
    department: Department
  }
  projects?: (InternProjectAssignment & {
    project: Project
  })[]
  completedHours?: number
  todayStatus?: "in" | "out"
  todayTimeIn?: string
  todayTimeOut?: string
}

/**
 * Extended time log type with joined user and department data
 */
export interface TimeLogWithDetails extends TimeLog {
  user: User
  user_profile?: UserProfile
  department?: Department
  school?: School
  internId?: number
  internName?: string
  timeIn?: string | null
  timeOut?: string | null
  duration?: string | null
  hoursWorked?: number
  approver_name?: string | null
}

export interface ProjectWithDetails extends Project {
  department: Department
  interns: (UserWithDetails & { assignment: InternProjectAssignment })[]
}
