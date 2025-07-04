"use client"

import React from "react"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/contexts/auth-context"

interface AdminDashboardHeaderProps {
  activeTab?: string
}

const tabTitles: Record<string, { title: string; description: string }> = {
  dashboard: {
    title: "Admin Dashboard",
    description: "Overview of intern activities and statistics.",
  },
  "manage-interns": {
    title: "Manage Interns",
    description: "Add, remove, and assign projects to interns",
  },
  "overtime-logs": {
    title: "Overtime Requests",
    description: "Review and approve overtime hours submitted by interns",
  },
  "edit-log-requests": {
    title: "Edit Log Requests",
    description: "Review edit requests for time logs submitted by interns",
  },
}

export function AdminDashboardHeader({ activeTab = "dashboard" }: AdminDashboardHeaderProps) {
  const { user, logout } = useAuth()

  if (!user) return null

  const initials = `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase()
  const { title, description } = tabTitles[activeTab] || tabTitles.dashboard

  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-blue-100 text-blue-600">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
              <p className="text-xs leading-none text-muted-foreground capitalize">
                {user.role.replace("_", " ")}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}