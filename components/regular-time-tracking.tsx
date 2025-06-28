import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Timer } from "lucide-react"
import { useState } from "react"
import { DAILY_REQUIRED_HOURS } from "@/lib/time-utils"

/**
 * Props for the RegularTimeTracking component
 */
interface RegularTimeTrackingProps {
  isTimedIn: boolean
  timeInTimestamp: Date | null
  actionLoading: boolean
  loadingAction: null | "timein" | "timeout" | "overtimein" | "overtimeout"
  freezeSessionAt: Date | null
  autoTimeoutTriggered: boolean
  handleTimeIn: () => void
  handleTimeOut: (cutoffTime?: Date, auto?: boolean, freezeAt?: Date, discardOvertime?: boolean, overtimeNote?: string) => void
  onOvertimeConfirmationShow?: (freezeAt: Date) => void
  onOvertimeConfirmationHide?: () => void
  isOvertimeSession?: boolean
  isOvertimeIn?: boolean
  overtimeInTimestamp?: Date | null
  todayTotalHours?: number
  hasReachedDailyRequirement?: boolean
}

/**
 * RegularTimeTracking component handles manual time tracking functionality for interns.
 */
export function RegularTimeTracking({
  isTimedIn,
  timeInTimestamp,
  actionLoading,
  loadingAction,
  freezeSessionAt,
  autoTimeoutTriggered,
  handleTimeIn,
  handleTimeOut,
  onOvertimeConfirmationShow,
  onOvertimeConfirmationHide,
  isOvertimeSession = false,
  isOvertimeIn = false,
  overtimeInTimestamp = null,
  todayTotalHours = 0,
  hasReachedDailyRequirement = false,
}: RegularTimeTrackingProps) {
  const [showOvertimeDialog, setShowOvertimeDialog] = useState(false)
  const [overtimeDialogData, setOvertimeDialogData] = useState<{
    sessionDuration: string
    overtimeDuration: string
  } | null>(null)
  const [overtimeNote, setOvertimeNote] = useState("")
  // Determine which session is currently active
  const currentSessionActive = isTimedIn || isOvertimeIn
  const currentTimestamp = isOvertimeIn ? overtimeInTimestamp : timeInTimestamp
  
  // Determine session type and context
  const isInOvertimePortion = hasReachedDailyRequirement && isTimedIn && !isOvertimeIn
  const sessionType = isOvertimeIn ? "overtime" : isInOvertimePortion ? "overtime-portion" : "regular"
  
  // Calculate overtime start time for continuous sessions
  const overtimeStartTime = isInOvertimePortion && timeInTimestamp 
    ? new Date(timeInTimestamp.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000)) // Add required hours to regular start time
    : isOvertimeIn ? overtimeInTimestamp : null
  
  // Determine if the next log would be overtime
  const nextWillBeOvertime = hasReachedDailyRequirement && !currentSessionActive

  // Handle forgotten timeout scenario - when user has worked more than required hours total today
  const handleTimeOutWithConfirmation = () => {
    if (isTimedIn && timeInTimestamp && todayTotalHours > DAILY_REQUIRED_HOURS) {
      // Calculate how much of today's total time comes from the current session
      const sessionDurationHours = (Date.now() - timeInTimestamp.getTime()) / (1000 * 60 * 60)
      const previousHoursToday = todayTotalHours - sessionDurationHours
      
      // Check if this single session would put them over required hours for the day
      if (previousHoursToday + sessionDurationHours > DAILY_REQUIRED_HOURS) {
        const overtimeHours = Math.max(0, (previousHoursToday + sessionDurationHours) - DAILY_REQUIRED_HOURS)
        
        // Helper function to format duration
        const formatDuration = (hours: number) => {
          const h = Math.floor(hours)
          const m = Math.floor((hours % 1) * 60)
          return `${h}h ${m.toString().padStart(2, '0')}m`
        }

        // Show dialog with overtime confirmation
        const sessionDuration = formatDuration(sessionDurationHours)
        const overtimeDuration = formatDuration(overtimeHours)
        
        setOvertimeDialogData({ sessionDuration, overtimeDuration })
        setShowOvertimeDialog(true)
        
        // Freeze calculations at the current time
        const freezeTime = new Date()
        onOvertimeConfirmationShow?.(freezeTime)
        return
      }
    }
    
    // Normal timeout for all other cases
    handleTimeOut()
  }

  const handleDialogClose = () => {
    setShowOvertimeDialog(false)
    setOvertimeDialogData(null)
    setOvertimeNote("")
    onOvertimeConfirmationHide?.()
  }

  const handleRenderOvertime = () => {
    setShowOvertimeDialog(false)
    setOvertimeDialogData(null)
    onOvertimeConfirmationHide?.()
    handleTimeOut(undefined, false, undefined, false, overtimeNote.trim())
    setOvertimeNote("")
  }

  const handleDiscardOvertime = () => {
    setShowOvertimeDialog(false)
    setOvertimeDialogData(null)
    setOvertimeNote("")
    onOvertimeConfirmationHide?.()
    handleTimeOut(undefined, false, undefined, true)
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900">
          {isOvertimeIn || isInOvertimePortion ? "Overtime Tracking" : "Time Tracking"}
        </h3>
        <p className="text-sm text-gray-600">
          {autoTimeoutTriggered
            ? "You've completed your maximum hours for today."
            : currentSessionActive
              ? isOvertimeIn 
                ? "You're currently in an overtime session." 
                : isInOvertimePortion
                  ? "You're currently working overtime hours."
                  : "You're currently clocked in."
              : nextWillBeOvertime
                ? "Daily requirement completed. Render overtime?"
                : hasReachedDailyRequirement
                  ? "Daily requirement completed. Next session will be overtime."
                  : "Ready to start your shift?"}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-center">
          <Badge 
            variant="secondary" 
            className={
              autoTimeoutTriggered
                ? "bg-green-100 text-green-800 border-green-200"
                : isOvertimeIn 
                  ? "bg-purple-100 text-purple-800 border-purple-200"
                  : isInOvertimePortion
                    ? "bg-orange-100 text-orange-800 border-orange-200"
                    : nextWillBeOvertime
                      ? "bg-orange-100 text-orange-800 border-orange-200"
                      : hasReachedDailyRequirement
                        ? "bg-blue-100 text-blue-800 border-blue-200"
                        : "bg-green-100 text-green-800 border-green-200"
            }
          >
            {autoTimeoutTriggered
              ? "✅ Daily Hours Completed"
              : currentSessionActive
                ? currentTimestamp
                  ? isOvertimeIn
                    ? `⏰ Overtime started at ${currentTimestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                    : isInOvertimePortion && overtimeStartTime
                      ? `⏰ Overtime started at ${overtimeStartTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                      : `🕒 Regular shift started at ${currentTimestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                  : sessionType === "overtime" ? "🕒 Overtime Active" : "🕒 Clocked in"
                : nextWillBeOvertime
                  ? "⚡ Next Log: Overtime Session"
                  : hasReachedDailyRequirement
                    ? "✅ Daily Requirement Met"
                    : "📝 Log Regular Shift"}
          </Badge>
        </div>
        {!currentSessionActive ? (
          <Button
            onClick={handleTimeIn}
            size="lg"
            className={`w-full ${
              nextWillBeOvertime || isOvertimeSession
                ? "bg-purple-600 hover:bg-purple-700" 
                : "bg-green-600 hover:bg-green-700"
            }`}
            disabled={actionLoading || freezeSessionAt !== null || autoTimeoutTriggered}
          >
            <Timer className="mr-2 h-5 w-5" />
            {loadingAction === "timein" 
              ? "Processing..." 
              : nextWillBeOvertime || isOvertimeSession 
                ? "Overtime In" 
                : "Time In"}
          </Button>
        ) : (
          <Button
            onClick={handleTimeOutWithConfirmation}
            size="lg"
            variant="destructive"
            className="w-full"
            disabled={actionLoading}
          >
            <Timer className="mr-2 h-5 w-5" />
            {loadingAction === "timeout" ? "Processing..." : isOvertimeIn || isInOvertimePortion ? "Overtime Out" : "Time Out"}
          </Button>
        )}
      </div>

      {/* Overtime Confirmation Dialog */}
      <Dialog 
        open={showOvertimeDialog} 
        onOpenChange={(open) => {
          if (!open) {
            handleDialogClose()
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Overtime Hours Detected</DialogTitle>
            <DialogDescription>
              You&apos;ve worked past your daily requirement of {DAILY_REQUIRED_HOURS} hours. 
              How would you like to handle the overtime?
            </DialogDescription>
          </DialogHeader>
          
          {overtimeDialogData && (
            <div className="py-4 space-y-4">
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                <div className="text-sm text-orange-600">Overtime hours in this session:</div>
                <div className="font-semibold text-orange-800">{overtimeDialogData.overtimeDuration}</div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="overtime-note" className="text-sm font-medium">
                  Overtime Note <span className="text-red-500">*</span>
                </Label>
                <p className="text-xs text-gray-600">
                  Please describe what you were working on during the overtime period to help your supervisor understand the additional hours.
                </p>
                <Textarea
                  id="overtime-note"
                  value={overtimeNote}
                  onChange={(e) => setOvertimeNote(e.target.value)}
                  className="min-h-[80px] resize-none"
                  maxLength={500}
                />
                <div className="text-xs text-gray-500 text-right">
                  {overtimeNote.length}/500 characters
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={handleDiscardOvertime}
              className="w-full sm:w-auto"
            >
              Discard Overtime
            </Button>
            <Button 
              onClick={handleRenderOvertime}
              disabled={!overtimeNote.trim()}
              className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Render Overtime
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}