/**
 * Database connection and type definitions for the Cybersoft DTR system.
 *
 * Exports:
 * - sql: PostgreSQL connection instance (uses DATABASE_URL env variable)
 * - Entity interfaces: User, School, Department, Project, InternProjectAssignment, InternshipProgram, TimeLog, UserProfile
 * - Extended types: UserWithDetails, TimeLogWithDetails, ProjectWithDetails
 */
import postgres from "postgres"

export const sql = postgres(process.env.DATABASE_URL!, {
  ssl: process.env.DB_SSL === "true" ? "require" : undefined,
})

// --- Entity Type Definitions ---

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

export interface School {
  id: number
  name: string
  address?: string
  contact_email?: string
  contact_phone?: string
  created_at: string
}

export interface Department {
  id: number
  name: string
  description?: string
  supervisor_id?: number
  created_at: string
}

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

export interface TimeLog {
  id: number
  user_id: number
  time_in?: string
  time_out?: string
  notes?: string
  status: "pending" | "completed"
  approved_by?: number
  approved_at?: string
  log_type?: "regular" | "overtime" | "extended_overtime"
  overtime_status?: "pending" | "approved" | "rejected"
  created_at: string
  updated_at: string
}

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

// --- Extended Types ---

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
