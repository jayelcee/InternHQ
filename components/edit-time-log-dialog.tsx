"use client"

import { useState, Fragment } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pencil, Trash2 } from "lucide-react"
import { TimeLogDisplay } from "@/lib/ui-utils"

interface EditTimeLogDialogProps {
  logs: TimeLogDisplay[]
  onSave: (logId: number, updates: { time_in?: string; time_out?: string }) => Promise<void>
  onDelete: (logId: number) => Promise<void>
  isLoading: boolean
  isAdmin?: boolean
  isIntern?: boolean
}

export function EditTimeLogDialog({ logs, onSave, onDelete, isLoading, isAdmin = false }: EditTimeLogDialogProps) {
  const [open, setOpen] = useState(false)
  // Store timeIn/timeOut for each log by id
  const [logTimes, setLogTimes] = useState<Record<number, { timeIn: string; timeOut: string }>>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ logId: number | null }>({ logId: null })

  // Reset form when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      const initial: Record<number, { timeIn: string; timeOut: string }> = {}
      for (const log of logs) {
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
          } catch {}
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
          } catch {}
        }
        initial[log.id] = { timeIn: timeInValue, timeOut: timeOutValue }
      }
      setLogTimes(initial)
    }
  }

  const handleFieldChange = (logId: number, field: "timeIn" | "timeOut", value: string) => {
    setLogTimes((prev) => ({
      ...prev,
      [logId]: { ...prev[logId], [field]: value }
    }))
  }

  const handleSave = async () => {
    try {
      for (const log of logs) {
        const { timeIn, timeOut } = logTimes[log.id] || {}
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
      }
      setOpen(false)
    } catch (error) {
      console.error("Error saving time logs:", error)
    }
  }

  const handleDelete = async (logId: number) => {
    try {
      await onDelete(logId)
      setShowDeleteConfirm({ logId: null })
      setOpen(false)
    } catch (error) {
      console.error("Error deleting time log:", error)
    }
  }

  // Show date in dialog title
  const dateStr = logs.length > 0 && logs[0].time_in
    ? new Date(logs[0].time_in).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })
    : ""

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-gray-100">
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Edit{" "}
            {logs.length === 1
              ? (() => {
                  if (logs[0].log_type === "overtime") return "Standard Overtime";
                  if (logs[0].log_type === "extended_overtime") return "Extended Overtime";
                  return "Regular";
                })()
              : (() => {
                  // If all logs are same type, show that type, else show "Time"
                  const types = Array.from(new Set(logs.map(l => l.log_type || "regular")));
                  if (types.length === 1) {
                    if (types[0] === "overtime") return "Standard Overtime";
                    if (types[0] === "extended_overtime") return "Extended Overtime";
                    return "Regular";
                  }
                  return "Time";
                })()
              }
            {" "}In/Out
            {dateStr && <span className="text-xs font-normal text-gray-500 ml-2">{dateStr}</span>}
          </DialogTitle>
        </DialogHeader>
        {showDeleteConfirm.logId !== null && isAdmin ? (
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
                onClick={() => setShowDeleteConfirm({ logId: null })}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => handleDelete(showDeleteConfirm.logId!)}
                disabled={isLoading}
              >
                {isLoading ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-4">
              {/* Render all logs in a single grid, each row is a log type */}
              <div className="grid grid-cols-2 gap-4">
                {logs.map((log) => {
                  let label = "Regular"
                  if (log.log_type === "overtime") label = "Standard Overtime"
                  else if (log.log_type === "extended_overtime") label = "Extended Overtime"
                  return (
                    <Fragment key={log.id}>
                      {/* Start row flex container */}
                      <div className="col-span-2 flex items-end gap-4">
                        <div className="flex flex-col flex-1">
                          <Label htmlFor={`time-in-${log.id}`}>{label} Time In</Label>
                          <Input
                            id={`time-in-${log.id}`}
                            type="datetime-local"
                            value={logTimes[log.id]?.timeIn || ""}
                            onChange={(e) => handleFieldChange(log.id, "timeIn", e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div className="flex flex-col flex-1">
                          <Label htmlFor={`time-out-${log.id}`}>{label} Time Out</Label>
                          <Input
                            id={`time-out-${log.id}`}
                            type="datetime-local"
                            value={logTimes[log.id]?.timeOut || ""}
                            onChange={(e) => handleFieldChange(log.id, "timeOut", e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        {/* Remove isAdmin check so both admin and intern can see the delete button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-red-100"
                          onClick={() => setShowDeleteConfirm({ logId: log.id })}
                          disabled={isLoading}
                          title="Delete this log"
                          tabIndex={-1}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                      {/* End row flex container */}
                    </Fragment>
                  )
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
