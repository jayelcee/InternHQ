"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pencil, Trash2 } from "lucide-react"
import { TimeLogDisplay } from "@/lib/ui-utils"

interface EditTimeLogDialogProps {
  log: TimeLogDisplay
  onSave: (logId: number, updates: { time_in?: string; time_out?: string }) => Promise<void>
  onDelete: (logId: number) => Promise<void>
  isLoading: boolean
  isAdmin?: boolean
  isIntern?: boolean
}

export function EditTimeLogDialog({ log, onSave, onDelete, isLoading, isAdmin = false, isIntern = false }: EditTimeLogDialogProps) {
  const [open, setOpen] = useState(false)
  const [timeIn, setTimeIn] = useState("")
  const [timeOut, setTimeOut] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Reset form when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      // Handle timezone-aware date formatting for datetime-local inputs
      let timeInValue = ""
      let timeOutValue = ""
      
      if (log.time_in) {
        try {
          const date = new Date(log.time_in)
          if (!isNaN(date.getTime())) {
            // Convert to local timezone and format for datetime-local
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            const hours = String(date.getHours()).padStart(2, '0')
            const minutes = String(date.getMinutes()).padStart(2, '0')
            timeInValue = `${year}-${month}-${day}T${hours}:${minutes}`
          }
        } catch (e) {
          console.error("Error parsing time_in:", e)
        }
      }
      
      if (log.time_out) {
        try {
          const date = new Date(log.time_out)
          if (!isNaN(date.getTime())) {
            // Convert to local timezone and format for datetime-local
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            const hours = String(date.getHours()).padStart(2, '0')
            const minutes = String(date.getMinutes()).padStart(2, '0')
            timeOutValue = `${year}-${month}-${day}T${hours}:${minutes}`
          }
        } catch (e) {
          console.error("Error parsing time_out:", e)
        }
      }
      
      setTimeIn(timeInValue)
      setTimeOut(timeOutValue)
    }
  }

  const handleSave = async () => {
    try {
      const updates: { time_in?: string; time_out?: string } = {}
      
      if (timeIn && timeIn !== (log.time_in ? new Date(log.time_in).toISOString().slice(0, 16) : "")) {
        updates.time_in = new Date(timeIn).toISOString()
      }
      
      if (timeOut && timeOut !== (log.time_out ? new Date(log.time_out).toISOString().slice(0, 16) : "")) {
        updates.time_out = new Date(timeOut).toISOString()
      }

      if (Object.keys(updates).length > 0) {
        await onSave(log.id, updates)
      }
      
      setOpen(false)
    } catch (error) {
      console.error("Error saving time log:", error)
    }
  }

  const handleDelete = async () => {
    try {
      await onDelete(log.id)
      setOpen(false)
      setShowDeleteConfirm(false)
    } catch (error) {
      console.error("Error deleting time log:", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-gray-100">
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Time Entry</DialogTitle>
        </DialogHeader>
        {showDeleteConfirm && isAdmin ? (
          <div className="space-y-4">
            <div className="text-center py-4">
              <Trash2 className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Time Entry</h3>
              <p className="text-sm text-gray-600">
                Are you sure you want to delete this time entry? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                disabled={isLoading}
              >
                {isLoading ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="time-in">Time In</Label>
                <Input
                  id="time-in"
                  type="datetime-local"
                  value={timeIn}
                  onChange={(e) => setTimeIn(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="time-out">Time Out</Label>
                <Input
                  id="time-out"
                  type="datetime-local"
                  value={timeOut}
                  onChange={(e) => setTimeOut(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex justify-between">
              {isAdmin ? (
                <Button 
                  variant="destructive" 
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              ) : (
                <div /> // Empty div to keep spacing
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
