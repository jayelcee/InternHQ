"use client"

import { Bell, Clock, Shield, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export function SettingsDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage system settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Time Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="work-hours">Standard Work Hours</Label>
              <Input id="work-hours" defaultValue="8" type="number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="break-time">Break Time (minutes)</Label>
              <Input id="break-time" defaultValue="60" type="number" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="overtime">Enable Overtime Tracking</Label>
              <Switch id="overtime" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-notifications">Email Notifications</Label>
              <Switch id="email-notifications" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="late-alerts">Late Check-in Alerts</Label>
              <Switch id="late-alerts" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="daily-reports">Daily Reports</Label>
              <Switch id="daily-reports" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" variant="outline">
              Manage Intern Accounts
            </Button>
            <Button className="w-full" variant="outline">
              Department Settings
            </Button>
            <Button className="w-full" variant="outline">
              Role Permissions
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="two-factor">Two-Factor Authentication</Label>
              <Switch id="two-factor" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="session-timeout">Auto Logout</Label>
              <Switch id="session-timeout" defaultChecked />
            </div>
            <Button variant="outline" className="w-full">
              Change Password
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium">Version</p>
              <p className="text-gray-600">v1.0.0</p>
            </div>
            <div>
              <p className="font-medium">Last Updated</p>
              <p className="text-gray-600">January 12, 2024</p>
            </div>
            <div>
              <p className="font-medium">Database</p>
              <p className="text-gray-600">Connected</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
