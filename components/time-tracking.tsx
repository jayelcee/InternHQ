import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Timer } from "lucide-react"
import { useState } from "react"
import { DAILY_REQUIRED_HOURS, MAX_OVERTIME_HOURS } from "@/lib/time-utils"

/**
 * Props for the TimeTracking component
 */
interface TimeTrackingProps {
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
  isExtendedOvertimeIn?: boolean
  extendedOvertimeInTimestamp?: Date | null
  todayTotalHours?: number
  hasReachedDailyRequirement?: boolean
  hasReachedOvertimeLimit?: boolean
}

/**
 * TimeTracking component handles manual time tracking functionality for interns.
 */
export function TimeTracking({
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
  isExtendedOvertimeIn = false,
  extendedOvertimeInTimestamp = null,
  todayTotalHours = 0,
  hasReachedDailyRequirement = false,
  hasReachedOvertimeLimit = false,
}: TimeTrackingProps) {
  const [showOvertimeDialog, setShowOvertimeDialog] = useState(false)
  const [overtimeDialogData, setOvertimeDialogData] = useState<{
    sessionDuration: string
    standardOvertimeDuration: string
    extendedOvertimeDuration: string
    totalOvertimeDuration: string
    hasExtendedOvertime: boolean
  } | null>(null)
  const [overtimeNote, setOvertimeNote] = useState("")
  // Determine which session is currently active
  const currentSessionActive = isTimedIn || isOvertimeIn || isExtendedOvertimeIn
  const currentTimestamp = isExtendedOvertimeIn 
    ? extendedOvertimeInTimestamp 
    : isOvertimeIn 
      ? overtimeInTimestamp 
      : timeInTimestamp
  
  // Determine session type and context
  const isInOvertimePortion = hasReachedDailyRequirement && isTimedIn && !isOvertimeIn && !isExtendedOvertimeIn
  const isInExtendedOvertimePortion = hasReachedOvertimeLimit && (isTimedIn || isOvertimeIn) && !isExtendedOvertimeIn
  
  // Check if user has exceeded max standard overtime (past 12 hours total today)
  const hasPastMaxStandardOvertime = todayTotalHours > (DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS)
  
  const sessionType = isExtendedOvertimeIn 
    ? "extended_overtime" 
    : isOvertimeIn 
      ? "overtime" 
      : isInExtendedOvertimePortion
        ? "extended-overtime-portion"
        : isInOvertimePortion 
          ? "overtime-portion" 
          : "regular"
  
  // Calculate overtime and extended overtime start times for continuous sessions
  const overtimeStartTime = (isInOvertimePortion || isInExtendedOvertimePortion) && timeInTimestamp 
    ? new Date(timeInTimestamp.getTime() + (DAILY_REQUIRED_HOURS * 60 * 60 * 1000))
    : isOvertimeIn ? overtimeInTimestamp : null
    
  const extendedOvertimeStartTime = isInExtendedOvertimePortion && timeInTimestamp
    ? new Date(timeInTimestamp.getTime() + ((DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) * 60 * 60 * 1000))
    : isExtendedOvertimeIn ? extendedOvertimeInTimestamp : null
  
  // Determine if the next log would be overtime or extended overtime
  const nextWillBeExtendedOvertime = hasReachedOvertimeLimit && !currentSessionActive
  const nextWillBeOvertime = hasReachedDailyRequirement && !hasReachedOvertimeLimit && !currentSessionActive

  // Handle forgotten timeout scenario - when user has worked more than required hours total today
  const handleTimeOutWithConfirmation = () => {
    if (isTimedIn && timeInTimestamp && todayTotalHours > DAILY_REQUIRED_HOURS) {
      // Calculate how much of today's total time comes from the current session
      const sessionDurationHours = (Date.now() - timeInTimestamp.getTime()) / (1000 * 60 * 60)
      const previousHoursToday = todayTotalHours - sessionDurationHours
      
      // Check if this single session would put them over required hours for the day
      if (previousHoursToday + sessionDurationHours > DAILY_REQUIRED_HOURS) {
        const totalOvertimeHours = Math.max(0, (previousHoursToday + sessionDurationHours) - DAILY_REQUIRED_HOURS)
        
        // Calculate standard overtime and extended overtime
        const standardOvertimeHours = Math.min(totalOvertimeHours, MAX_OVERTIME_HOURS)
        const extendedOvertimeHours = Math.max(0, totalOvertimeHours - MAX_OVERTIME_HOURS)
        const hasExtendedOvertime = extendedOvertimeHours > 0
        
        // Helper function to format duration
        const formatDuration = (hours: number) => {
          const h = Math.floor(hours)
          const m = Math.floor((hours % 1) * 60)
          return `${h}h ${m.toString().padStart(2, '0')}m`
        }

        // Show dialog with overtime confirmation
        const sessionDuration = formatDuration(sessionDurationHours)
        const standardOvertimeDuration = formatDuration(standardOvertimeHours)
        const extendedOvertimeDuration = formatDuration(extendedOvertimeHours)
        const totalOvertimeDuration = formatDuration(totalOvertimeHours)
        
        setOvertimeDialogData({ 
          sessionDuration, 
          standardOvertimeDuration,
          extendedOvertimeDuration,
          totalOvertimeDuration,
          hasExtendedOvertime
        })
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

  const handleDiscardOvertime = () => {
    setShowOvertimeDialog(false)
    setOvertimeDialogData(null)
    setOvertimeNote("")
    onOvertimeConfirmationHide?.()
    handleTimeOut(undefined, false, undefined, true)
  }

  const handleConfirmStandardOvertime = () => {
    setShowOvertimeDialog(false)
    setOvertimeDialogData(null)
    onOvertimeConfirmationHide?.()
    // Calculate cutoff time for standard overtime (9 + 3 = 12 hours from start)
    if (timeInTimestamp) {
      const maxStandardOvertimeCutoff = new Date(timeInTimestamp.getTime() + ((DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS) * 60 * 60 * 1000))
      handleTimeOut(maxStandardOvertimeCutoff, false, undefined, false, overtimeNote.trim())
    } else {
      handleTimeOut(undefined, false, undefined, false, overtimeNote.trim())
    }
    setOvertimeNote("")
  }

  const handleConfirmAllOvertime = () => {
    setShowOvertimeDialog(false)
    setOvertimeDialogData(null)
    onOvertimeConfirmationHide?.()
    handleTimeOut(undefined, false, undefined, false, overtimeNote.trim())
    setOvertimeNote("")
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900">
          {hasPastMaxStandardOvertime
            ? "⚠️ Maximum Overtime Exceeded"
            : isExtendedOvertimeIn || isInExtendedOvertimePortion 
              ? "Extended Overtime Tracking" 
              : isOvertimeIn || isInOvertimePortion 
                ? "Overtime Tracking" 
                : "Time Tracking"}
        </h3>
        <p className="text-sm text-gray-600">
          {hasPastMaxStandardOvertime
            ? "Please consider ending your session if this is unintentional."
            : autoTimeoutTriggered
              ? "Session complete. Use manual time out to end."
              : currentSessionActive
                ? isExtendedOvertimeIn 
                  ? "You're currently in an extended overtime session." 
                  : isOvertimeIn 
                    ? "You're currently in an overtime session." 
                    : isInExtendedOvertimePortion
                      ? "You're currently working extended overtime hours."
                      : isInOvertimePortion
                        ? "You're currently working standard overtime hours."
                        : "You're currently clocked in."
                : nextWillBeExtendedOvertime
                  ? "Overtime limit reached. Start extended overtime?"
                  : nextWillBeOvertime
                    ? "Daily requirement completed. Start overtime?"
                    : hasReachedOvertimeLimit
                      ? "Overtime limit completed. Next session will be extended overtime."
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
              hasPastMaxStandardOvertime
                ? "bg-red-100 text-red-800 border-red-200 animate-pulse"
                : autoTimeoutTriggered
                  ? "bg-gray-100 text-gray-800 border-gray-200"
                  : isExtendedOvertimeIn 
                    ? "bg-red-100 text-red-800 border-red-200"
                    : isOvertimeIn 
                      ? "bg-purple-100 text-purple-800 border-purple-200"
                      : isInExtendedOvertimePortion
                        ? "bg-red-100 text-red-800 border-red-200"
                        : isInOvertimePortion
                          ? "bg-orange-100 text-orange-800 border-orange-200"
                          : nextWillBeExtendedOvertime
                            ? "bg-red-100 text-red-800 border-red-200"
                            : nextWillBeOvertime
                              ? "bg-orange-100 text-orange-800 border-orange-200"
                              : hasReachedOvertimeLimit
                                ? "bg-blue-100 text-blue-800 border-blue-200"
                                : hasReachedDailyRequirement
                                  ? "bg-blue-100 text-blue-800 border-blue-200"
                                  : "bg-green-100 text-green-800 border-green-200"
            }
          >
            {hasPastMaxStandardOvertime
              ? `🚨 Exceeded Max Hours: ${todayTotalHours.toFixed(2)}h / ${DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS}h`
              : autoTimeoutTriggered
                ? "⚡ Session Complete - Manual Timeout Required"
                : currentSessionActive
                  ? currentTimestamp
                    ? isExtendedOvertimeIn
                      ? `🔴 Extended OT started at ${currentTimestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                      : isOvertimeIn
                        ? `⏰ Overtime started at ${currentTimestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                        : isInExtendedOvertimePortion && extendedOvertimeStartTime
                          ? `🔴 Extended OT started at ${extendedOvertimeStartTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                          : isInOvertimePortion && overtimeStartTime
                            ? `⏰ Overtime started at ${overtimeStartTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                            : `🕒 Regular shift started at ${currentTimestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                    : sessionType === "extended_overtime" 
                      ? "� Extended OT Active" 
                      : sessionType === "overtime" 
                        ? "⏰ Overtime Active" 
                        : "🕒 Clocked in"
                  : nextWillBeExtendedOvertime
                    ? "🔴 Next Log: Extended Overtime Session"
                    : nextWillBeOvertime
                      ? "⚡ Next Log: Overtime Session"
                      : hasReachedOvertimeLimit
                        ? "✅ Overtime Limit Met"
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
              nextWillBeExtendedOvertime
                ? "bg-red-600 hover:bg-red-700"
                : nextWillBeOvertime
                  ? "bg-purple-600 hover:bg-purple-700" 
                  : "bg-green-600 hover:bg-green-700"
            }`}
            disabled={actionLoading || freezeSessionAt !== null}
          >
            <Timer className="mr-2 h-5 w-5" />
            {loadingAction === "timein"
              ? "Processing..."
              : hasPastMaxStandardOvertime || nextWillBeExtendedOvertime || isExtendedOvertimeIn || isInExtendedOvertimePortion
                ? "Extended Overtime In"
                : nextWillBeOvertime
                  ? "Overtime In"
                  : isInOvertimePortion
                    ? "Overtime In"
                    : "Time In"}
          </Button>
        ) : (
          <Button
            onClick={handleTimeOutWithConfirmation}
            size="lg"
            variant="destructive"
            className={`w-full ${
              (isExtendedOvertimeIn || isInExtendedOvertimePortion || isOvertimeIn || isInOvertimePortion)
                ? "bg-red-600 hover:bg-red-700"
                : ""
            }`}
            disabled={actionLoading}
          >
            <Timer className="mr-2 h-5 w-5" />
            {loadingAction === "timeout"
              ? "Processing..."
              : hasPastMaxStandardOvertime || isExtendedOvertimeIn || isInExtendedOvertimePortion
                ? "Extended Overtime Out"
                : isOvertimeIn || isInOvertimePortion
                  ? "Overtime Out"
                  : "Time Out"}
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
        <DialogContent className={overtimeDialogData?.hasExtendedOvertime ? "sm:max-w-2xl" : "sm:max-w-lg"}>
          <DialogHeader>
            <DialogTitle>
              {overtimeDialogData?.hasExtendedOvertime ? "Extended Overtime Detected" : "Overtime Hours Detected"}
            </DialogTitle>
            <DialogDescription>
              You&apos;ve worked past your daily requirement of {DAILY_REQUIRED_HOURS} hours. 
              {overtimeDialogData?.hasExtendedOvertime 
                ? " Your session includes extended overtime beyond the standard overtime limit. Choose how to handle your overtime:"
                : " How would you like to handle the overtime?"
              }
            </DialogDescription>
          </DialogHeader>
          
          {overtimeDialogData && (
            <div className="py-4 space-y-4">
              {/* Overtime Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {overtimeDialogData.hasExtendedOvertime ? (
                  <>
                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                      <div className="text-sm text-orange-600">Standard Overtime:</div>
                      <div className="font-semibold text-orange-800">{overtimeDialogData.standardOvertimeDuration}</div>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                      <div className="text-sm text-red-600">Extended Overtime:</div>
                      <div className="font-semibold text-red-800">{overtimeDialogData.extendedOvertimeDuration}</div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <div className="text-sm text-blue-600">Total Overtime:</div>
                      <div className="font-semibold text-blue-800">{overtimeDialogData.totalOvertimeDuration}</div>
                    </div>
                  </>
                ) : (
                  <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 md:col-span-3">
                    <div className="text-sm text-orange-600">Overtime hours in this session:</div>
                    <div className="font-semibold text-orange-800">{overtimeDialogData.totalOvertimeDuration}</div>
                  </div>
                )}
              </div>

              {/* Options explanation for extended overtime */}
              {overtimeDialogData.hasExtendedOvertime && (
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li><strong>Discard All Overtime:</strong> Save only your regular {DAILY_REQUIRED_HOURS}-hour shift</li>
                    <li><strong>Confirm Standard Overtime:</strong> Save regular hours + {overtimeDialogData.standardOvertimeDuration}</li>
                    <li><strong>Confirm All Overtime:</strong> Save all {DAILY_REQUIRED_HOURS + parseFloat(overtimeDialogData.totalOvertimeDuration.replace(/h.*/, ''))}+ hours worked</li>
                  </ul>
                </div>
              )}
              
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
              {overtimeDialogData?.hasExtendedOvertime ? "Discard All Overtime" : "Discard Overtime"}
            </Button>
            {overtimeDialogData?.hasExtendedOvertime ? (
              <>
                <Button 
                  onClick={handleConfirmStandardOvertime}
                  disabled={!overtimeNote.trim()}
                  className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Confirm Standard Overtime
                </Button>
                <Button 
                  onClick={handleConfirmAllOvertime}
                  disabled={!overtimeNote.trim()}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Confirm All Overtime
                </Button>
              </>
            ) : (
              <Button 
                onClick={handleConfirmAllOvertime}
                disabled={!overtimeNote.trim()}
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Confirm Overtime
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}