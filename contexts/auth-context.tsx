"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  role: "intern" | "admin"
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
    required_hours: number
    start_date: string
    end_date: string
    status: string
    school: {
      name: string
      address?: string
    }
    department: {
      name: string
      description?: string
    }
  }
  completedHours?: number
  todayStatus?: "in" | "out"
  todayTimeIn?: string
  todayTimeOut?: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  isLoading: boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
      })

      if (!response.ok) {
        console.log("No active session found")
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

      // Check if response is ok first
      if (!response.ok) {
        console.error("Login failed with status:", response.status)
        return { success: false, error: "Login failed" }
      }

      // Try to parse JSON
      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        console.error("Failed to parse JSON response:", jsonError)
        return { success: false, error: "Invalid response format" }
      }

      if (data.success && data.user) {
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

  const refreshUser = async () => {
    await checkAuth()
  }

  return <AuthContext.Provider value={{ user, login, logout, isLoading, refreshUser }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
