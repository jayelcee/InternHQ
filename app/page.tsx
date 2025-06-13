"use client"

import { AuthProvider, useAuth } from "@/contexts/auth-context"
import { LoginForm } from "@/components/login-form"
import { InternDashboard } from "@/components/intern/intern-dashboard"
import { AdminDashboard } from "@/components/admin/admin-dashboard"

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

  // For HR Admin users, show the admin interface with navigation
  if (user.role === "admin") {
    return <AdminDashboard />
  }

  // For intern users, show the simple intern dashboard (no navigation tabs)
  return <InternDashboard />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
