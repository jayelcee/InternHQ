import postgres from "postgres"

// Use DATABASE_URL from .env for connection string
// This is compatible with Vercel, Railway, and local setups
export const sql = postgres(process.env.DATABASE_URL!, {
  ssl: process.env.DB_SSL === "true" ? "require" : undefined,
})

// --- Types ---

export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  role: "intern" | "admin"
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
  date: string
  time_in?: string
  time_out?: string
  break_duration: number
  notes?: string
  status: "pending" | "completed"
  approved_by?: number
  approved_at?: string
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

// Extended types for joined data
export interface UserWithDetails extends User {
  profile?: UserProfile
  internship?: InternshipProgram & {
    school: School
    department: Department
  }
  projects?: (InternProjectAssignment & {
    project: Project
  })[]
  // Computed fields for UI compatibility
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
}

export interface ProjectWithDetails extends Project {
  department: Department
  interns: (UserWithDetails & { assignment: InternProjectAssignment })[]
}
