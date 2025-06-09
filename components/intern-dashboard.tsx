"use client"

import { useState } from "react"
import { InternNavigation } from "./intern-navigation"
import { InternDashboardContent } from "./intern-dashboard-content"
import { InternProfile } from "./intern-profile"
import { DashboardHeader } from "./dashboard-header"
import { useAuth } from "@/contexts/auth-context"

export function InternDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState("dashboard")

  if (!user) return null

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <InternDashboardContent />
      case "profile":
        return <InternProfile />
      default:
        return <InternDashboardContent />
    }
  }

  return (
    <>
      <InternNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="md:pl-64">
        <div className="min-h-screen bg-gray-50 p-4 md:p-6">
          <div className="mx-auto max-w-6xl space-y-6">
            <DashboardHeader />
            {renderContent()}
          </div>
        </div>
      </div>
    </>
  )
}
