"use client"

import { useState, Fragment } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pencil, Trash2 } from "lucide-react"
import { TimeLogDisplay } from "@/lib/ui-utils"
import { processLogsForContinuousEditing } from "@/lib/session-utils"
import { useAuth } from "@/contexts/auth-context"
import { truncateToMinute } from "@/lib/time-utils"

interface EditTimeLogDialogProps {
  logs: TimeLogDisplay[]
  onDelete: (logId: number) => Promise<void>
  isLoading: boolean
  isAdmin?: boolean
  isIntern?: boolean
  disabled?: boolean
  disabledReason?: string
}

export function EditTimeLogDialog({ logs, onDelete, isLoading, isAdmin = false, isIntern = false, disabled = false, disabledReason = "" }: EditTimeLogDialogProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  // Store timeIn/timeOut for each session (not individual logs)
  const [sessionTimes, setSessionTimes] = useState<Record<string, { timeIn: string; timeOut: string }>>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ sessionId: string | null }>({ sessionId: null })

  // Process logs into continuous sessions
  const sessions = processLogsForContinuousEditing(logs)

  // Reset form when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      const initial: Record<string, { timeIn: string; timeOut: string }> = {}
      for (const session of sessions) {
        let timeInValue = ""
        let timeOutValue = ""
        
        if (session.earliestTimeIn) {
          try {
            const date = new Date(session.earliestTimeIn)
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
        
        if (session.latestTimeOut) {
          try {
            const date = new Date(session.latestTimeOut)
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
        
        initial[session.id] = { timeIn: timeInValue, timeOut: timeOutValue }
      }
      setSessionTimes(initial)
    }
  }

  const handleFieldChange = (sessionId: string, field: "timeIn" | "timeOut", value: string) => {
    setSessionTimes((prev) => ({
      ...prev,
      [sessionId]: { ...prev[sessionId], [field]: value }
    }))
  }

  const handleSave = async () => {
    try {
      // Handle each session - apply time changes to all logs in the session
      for (const session of sessions) {
        const { timeIn, timeOut } = sessionTimes[session.id] || {}
        
        if (session.isContinuousSession && timeIn && timeOut) {
          // For continuous sessions, create a single edit request instead of individual ones
          if (isIntern) {
            // For interns, use the continuous session edit request API
            const logIds = session.logs.map(log => log.id)
            const requestedTimeIn = truncateToMinute(new Date(timeIn))
            const requestedTimeOut = truncateToMinute(new Date(timeOut))
            
            const response = await fetch("/api/interns/time-log-edit-session", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
              body: JSON.stringify({
                logIds,
                timeIn: requestedTimeIn,
                timeOut: requestedTimeOut,
                userId: user?.id
              }),
            })
            
            if (!response.ok) {
              throw new Error("Failed to submit continuous session edit request")
            }
          } else {
            // For admins, use the same continuous session edit request API but with auto-approval
            const logIds = session.logs.map(log => log.id)
            const requestedTimeIn = truncateToMinute(new Date(timeIn))
            const requestedTimeOut = truncateToMinute(new Date(timeOut))
            
            const response = await fetch("/api/interns/time-log-edit-session", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
              body: JSON.stringify({
                logIds,
                timeIn: requestedTimeIn,
                timeOut: requestedTimeOut,
                userId: user?.id,
                isAdminEdit: true // Flag to auto-approve
              }),
            })
            
            if (!response.ok) {
              throw new Error("Failed to update continuous session")
            }
          }
        } else {
          // For single logs, handle normally
          const log = session.logs[0]
          const updates: { time_in?: string; time_out?: string } = {}
          
          if (timeIn && timeIn !== (log.time_in ? new Date(log.time_in).toISOString().slice(0, 16) : "")) {
            updates.time_in = truncateToMinute(new Date(timeIn))
          }
          if (timeOut && timeOut !== (log.time_out ? new Date(log.time_out).toISOString().slice(0, 16) : "")) {
            updates.time_out = truncateToMinute(new Date(timeOut))
          }
          
          if (Object.keys(updates).length > 0) {
            // Admin edits now go through the same edit request system but are auto-approved
            const response = await fetch("/api/interns/time-log-edit", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
              body: JSON.stringify({
                logId: log.id,
                time_in: updates.time_in,
                time_out: updates.time_out,
                userId: user?.id,
                isAdminEdit: isAdmin // Flag to auto-approve if admin
              }),
            })
            
            if (!response.ok) {
              throw new Error("Failed to update time log")
            }
          }
        }
      }
      setOpen(false)
    } catch (error) {
      console.error("Error saving time logs:", error)
    }
  }

  const handleDelete = async (sessionId: string) => {
    try {
      const session = sessions.find(s => s.id === sessionId)
      if (session) {
        // Delete all logs in the session
        for (const log of session.logs) {
          await onDelete(log.id)
        }
      }
      setShowDeleteConfirm({ sessionId: null })
      setOpen(false)
    } catch (error) {
      console.error("Error deleting time logs:", error)
    }
  }

  // Show date in dialog title
  const dateStr = logs.length > 0 && logs[0].time_in
    ? new Date(logs[0].time_in).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })
    : ""

  return (
    <>
      {disabled ? (
        <div 
          className="h-6 w-6 p-0 flex items-center justify-center cursor-not-allowed opacity-40 hover:opacity-60 transition-opacity"
          title={disabledReason}
        >
          <Pencil className="h-4 w-4 text-black" />
        </div>
      ) : (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0 flex items-center justify-center border border-transparent transition-colors"
            >
              <Pencil className="h-4 w-4 text-black" />
            </Button>
          </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Edit{" "}
            {sessions.length === 1 && sessions[0].isContinuousSession
              ? "Continuous Session"
              : sessions.length === 1
                ? (() => {
                    const session = sessions[0]
                    if (session.sessionType === "overtime") return "Standard Overtime"
                    if (session.sessionType === "extended_overtime") return "Extended Overtime"
                    return "Regular"
                  })()
                : "Time Logs"
            }{" "}Time
            {dateStr && <span className="text-xs font-normal text-gray-500 ml-2">{dateStr}</span>}
          </DialogTitle>
        </DialogHeader>
        {showDeleteConfirm.sessionId !== null && isAdmin ? (
          <div className="space-y-4">
            <div className="text-center py-4">
              <Trash2 className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Time Entries</h3>
              <p className="text-sm text-gray-600">
                Are you sure you want to delete {showDeleteConfirm.sessionId.includes("-") ? "these time entries" : "this time entry"}? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteConfirm({ sessionId: null })}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => handleDelete(showDeleteConfirm.sessionId!)}
                disabled={isLoading}
              >
                {isLoading ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-4">
              {/* Render sessions instead of individual logs */}
              <div className="grid grid-cols-2 gap-4">
                {sessions.map((session) => {
                  let label = "Time"
                  if (session.isContinuousSession) {
                    label = "Continuous Session"
                  } else if (session.sessionType === "overtime") {
                    label = "Standard Overtime"
                  } else if (session.sessionType === "extended_overtime") {
                    label = "Extended Overtime"
                  } else if (session.sessionType === "regular") {
                    label = "Regular"
                  }
                  
                  return (
                    <Fragment key={session.id}>
                      {/* Start row flex container */}
                      <div className="col-span-2 flex items-end gap-4">
                        <div className="flex flex-col flex-1">
                          <Label htmlFor={`time-in-${session.id}`}>{label} Time In</Label>
                          <Input
                            id={`time-in-${session.id}`}
                            type="datetime-local"
                            value={sessionTimes[session.id]?.timeIn || ""}
                            onChange={(e) => handleFieldChange(session.id, "timeIn", e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div className="flex flex-col flex-1">
                          <Label htmlFor={`time-out-${session.id}`}>{label} Time Out</Label>
                          <Input
                            id={`time-out-${session.id}`}
                            type="datetime-local"
                            value={sessionTimes[session.id]?.timeOut || ""}
                            onChange={(e) => handleFieldChange(session.id, "timeOut", e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        {/* Show delete button for admin */}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="hover:bg-red-100"
                            onClick={() => setShowDeleteConfirm({ sessionId: session.id })}
                            disabled={isLoading}
                            title={`Delete ${session.isContinuousSession ? "session" : "log"}`}
                            tabIndex={-1}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
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
      )}
    </>
  )
}
