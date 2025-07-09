/**
 * InternNavigation
 *
 * Sidebar and mobile navigation for the intern dashboard.
 *
 * Props:
 * - activeTab: string — currently active tab key
 * - onTabChange: (tab: string) => void — callback to change tab
 * - tabs: { key: string; label: string }[] — list of tab keys and labels
 */

"use client"

import { useState } from "react"
import { Clock, User, LayoutDashboard, Menu, Award } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import React from "react"

export interface InternNavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
  tabs: { key: string; label: string }[]
}

const tabIcons: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard className="w-4 h-4 mr-2" />,
  dtr: <Clock className="w-4 h-4 mr-2" />,
  profile: <User className="w-4 h-4 mr-2" />,
  completion: <Award className="w-4 h-4 mr-2" />,
}

export function InternNavigation({ activeTab, onTabChange, tabs }: InternNavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Navigation items for sidebar and mobile
  const NavItems = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className={cn("space-y-2", mobile && "px-4")}>
      {tabs.map((item) => (
        <Button
          key={item.key}
          variant={activeTab === item.key ? "default" : "ghost"}
          className={cn(
            "w-full justify-start",
            activeTab === item.key && "bg-blue-600 text-white hover:bg-blue-700"
          )}
          onClick={() => {
            onTabChange(item.key)
            if (mobile) setIsMobileMenuOpen(false)
          }}
        >
          {tabIcons[item.key] ?? null}
          {item.label}
        </Button>
      ))}
    </nav>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-gray-200">
        <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4 mb-8">
            <Clock className="h-8 w-8 text-blue-600 mr-2" />
            <span className="text-xl font-bold text-gray-900">Intern DTR</span>
          </div>
          <div className="mt-5 flex-grow flex flex-col px-4">
            <NavItems />
          </div>
        </div>
      </div>
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <Clock className="h-6 w-6 text-blue-600 mr-2" />
          <span className="text-lg font-bold text-gray-900">Intern DTR</span>
        </div>
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center">
                  <Clock className="h-6 w-6 text-blue-600 mr-2" />
                  <span className="text-lg font-bold text-gray-900">Intern DTR</span>
                </div>
              </div>
              <div className="flex-1 py-4">
                <NavItems mobile />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
