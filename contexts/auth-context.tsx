"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

/**
 * User interface representing the authenticated user data
 */
interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  role: "intern" | "admin"
  work_schedule?: any
  profile?: {
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
  }
  internship?: {
    id: number
    user_id: number
    school_id: number
    department_id: number
    required_hours: number
    start_date: string
    end_date: string
    supervisor_id?: number
    supervisor_name?: string
    status: "active" | "completed" | "suspended"
    created_at: string
    updated_at: string
    school: {
      id: number
      name: string
      address?: string
      contact_email?: string
      contact_phone?: string
      created_at: string
    }
    department: {
      id: number
      name: string
      description?: string
      supervisor_id?: number
      created_at: string
    }
  }
  completedHours?: number
  todayStatus?: "in" | "out"
  todayTimeIn?: string
  todayTimeOut?: string
}

/**
 * Authentication context type definition
 */
interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  isLoading: boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * AuthProvider component that provides authentication context to the application
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  /**
   * Checks if user has an active authentication session
   */
  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
      })

      if (!response.ok) {
        setUser(null)
        return
      }

      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        console.error("Failed to parse auth response:", jsonError)
        setUser(null)
        return
      }

      if (data.user) {
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error("Auth check failed:", error)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Authenticates user with email and password
   */
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        console.error("Login failed with status:", response.status)
        return { success: false, error: "Login failed" }
      }

      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        console.error("Failed to parse JSON response:", jsonError)
        return { success: false, error: "Invalid response format" }
      }

      if (data.success) {
        const meRes = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
        })
        if (meRes.ok) {
          const meData = await meRes.json()
          if (meData.user) {
            setUser(meData.user)
            return { success: true }
          }
        }
        setUser(data.user)
        return { success: true }
      } else {
        return { success: false, error: data.error || "Login failed" }
      }
    } catch (error) {
      console.error("Login network error:", error)
      return { success: false, error: "Network error - please try again" }
    }
  }

  /**
   * Logs out the current user and clears session
   */
  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      })
    } catch (error) {
      console.error("Logout failed:", error)
    } finally {
      setUser(null)
    }
  }

  /**
   * Refreshes user data from the server
   */
  const refreshUser = async () => {
    await checkAuth()
  }

  return <AuthContext.Provider value={{ user, login, logout, isLoading, refreshUser }}>{children}</AuthContext.Provider>
}

/**
 * Custom hook to use the authentication context
 * @throws Error if used outside of AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
