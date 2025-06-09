"use client"

import { AuthProvider, useAuth } from "@/contexts/auth-context"
import { LoginForm } from "@/components/login-form"
import { InternDashboard } from "@/components/intern-dashboard"

// Add imports for the new dashboard components
import { HRAdminDashboard } from "@/components/hr-admin-dashboard"
import { ReportsDashboard } from "@/components/reports-dashboard"
import { SettingsDashboard } from "@/components/settings-dashboard"
import { Navigation } from "@/components/navigation"
import { useState } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { ManageInternsDashboard } from "@/components/manage-interns-dashboard"

// Update the AppContent component to handle different user roles and navigation
function AppContent() {
  const { user, isLoading } = useAuth()
  const [activeTab, setActiveTab] = useState("dashboard")

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
    const renderContent = () => {
      switch (activeTab) {
        case "dashboard":
          return <HRAdminDashboard />
        case "reports":
          return <ReportsDashboard />
        case "manage-interns":
          return <ManageInternsDashboard />
        case "settings":
          return <SettingsDashboard />
        default:
          return <HRAdminDashboard />
      }
    }

    return (
      <>
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="md:pl-64">
          <div className="min-h-screen bg-gray-50 p-4 md:p-6">
            <div className="mx-auto max-w-7xl">
              <DashboardHeader />
              <div className="mt-6">{renderContent()}</div>
            </div>
          </div>
        </div>
      </>
    )
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
