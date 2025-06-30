"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TimeLogDisplay } from "@/lib/ui-utils"

interface EditTimeLogRequestDialogProps {
  log: TimeLogDisplay
  onSubmit: (logId: number, updates: { time_in?: string; time_out?: string }) => void
  isLoading?: boolean
}

export function EditTimeLogRequestDialog({ log, onSubmit, isLoading }: EditTimeLogRequestDialogProps) {
  const [open, setOpen] = useState(false)
  const [timeIn, setTimeIn] = useState("")
  const [timeOut, setTimeOut] = useState("")

  // Reset form when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      let timeInValue = ""
      let timeOutValue = ""
      if (log.time_in) {
        try {
          const date = new Date(log.time_in)
          if (!isNaN(date.getTime())) {
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

  const handleSubmit = () => {
    const updates: { time_in?: string; time_out?: string } = {}
    if (timeIn && timeIn !== (log.time_in ? new Date(log.time_in).toISOString().slice(0, 16) : "")) {
      updates.time_in = new Date(timeIn).toISOString()
    }
    if (timeOut && timeOut !== (log.time_out ? new Date(log.time_out).toISOString().slice(0, 16) : "")) {
      updates.time_out = new Date(timeOut).toISOString()
    }
    onSubmit(log.id, updates)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={isLoading}>
          Request Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request Edit for Time Log</DialogTitle>
        </DialogHeader>
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
          <DialogFooter>
            <Button onClick={handleSubmit} disabled={isLoading}>
              Submit Request
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
