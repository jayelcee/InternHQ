"use client"

import { useState } from "react"
import { Home, Menu, Users, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface NavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const navigationItems = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "manage-interns", label: "Manage Interns", icon: Users },
  { id: "overtime-logs", label: "Overtime Logs", icon: Clock },
]

export function AdminNavigation({ activeTab, onTabChange }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const NavItems = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className={cn("space-y-2", mobile && "px-4")}>
      {navigationItems.map((item) => {
        const Icon = item.icon
        return (
          <Button
            key={item.id}
            variant={activeTab === item.id ? "default" : "ghost"}
            className={cn("w-full justify-start", activeTab === item.id && "bg-blue-600 text-white hover:bg-blue-700")}
            onClick={() => {
              onTabChange(item.id)
              if (mobile) setIsMobileMenuOpen(false)
            }}
          >
            <Icon className="mr-2 h-4 w-4" />
            {item.label}
          </Button>
        )
      })}
    </nav>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-gray-200">
        <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4 mb-8">
            <Users className="h-8 w-8 text-blue-600 mr-2" />
            <span className="text-xl font-bold text-gray-900">DTR Admin</span>
          </div>
          <div className="mt-5 flex-grow flex flex-col px-4">
            <NavItems />
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <Users className="h-6 w-6 text-blue-600 mr-2" />
          <span className="text-lg font-bold text-gray-900">DTR Admin</span>
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
                  <Users className="h-6 w-6 text-blue-600 mr-2" />
                  <span className="text-lg font-bold text-gray-900">DTR Admin</span>
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
