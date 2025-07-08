/**
 * Main entry page for InternHQ.
 * - Handles authentication and role-based dashboard rendering.
 * - Wraps content in AuthProvider for global auth state.
 */

"use client"

import { AuthProvider, useAuth } from "@/contexts/auth-context"
import { LoginForm } from "@/components/login-form"
import { InternDashboard } from "@/components/intern/intern-dashboard"
import { AdminDashboard } from "@/components/admin/admin-dashboard"

/**
 * AppContent handles conditional rendering based on authentication state and user role.
 */
function AppContent() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginForm />
  }

  // Render admin dashboard for HR Admin users
  if (user.role === "admin") {
    return <AdminDashboard />
  }

  // Render intern dashboard for intern users
  return <InternDashboard />
}

/**
 * App wraps the application in the AuthProvider.
 */
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
