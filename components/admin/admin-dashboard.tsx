/**
 * AdminDashboard
 *
 * Main entry point for the admin dashboard UI.
 * - Handles tab navigation and renders the appropriate dashboard section.
 * - Shows navigation, header, and the selected dashboard content.
 * - Requires authenticated user (admin/HR).
 *
 * Tabs:
 * - Dashboard (overview)
 * - Manage Interns
 * - Overtime Requests
 * - Edit Log Requests
 * - Completion Requests
 *
 * Context:
 * - Uses useAuth() for user info
 */

"use client"

import { useState } from "react"
import { HRAdminDashboard } from "./admin-dashboard-content"
import { ManageInternsDashboard } from "./manage-interns"
import { OvertimeLogsDashboard } from "./manage-overtime-requests"
import { AdminNavigation } from "./admin-navigation"
import { AdminDashboardHeader } from "./admin-dashboard-header"
import { useAuth } from "@/contexts/auth-context"
import { EditLogRequestsAdmin } from "./manage-edit-log-requests"
import { ManageCompletionRequests } from "./manage-completion-requests"

export function AdminDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState("dashboard")
  if (!user) return null

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <HRAdminDashboard />
      case "manage-interns":
        return <ManageInternsDashboard />
      case "overtime-logs":
        return <OvertimeLogsDashboard />
      case "edit-log-requests":
        return <EditLogRequestsAdmin />
      case "completion-requests":
        return <ManageCompletionRequests />
      default:
        return <HRAdminDashboard />
    }
  }

  return (
    <>
      <AdminNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="md:pl-64">
        <div className="min-h-screen bg-gray-50 p-4 md:p-6">
          <div className="mx-auto max-w-6xl space-y-6">
            <AdminDashboardHeader activeTab={activeTab} />
            {renderContent()}
          </div>
        </div>
      </div>
    </>
  )
}