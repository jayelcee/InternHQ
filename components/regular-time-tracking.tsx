import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Timer, Edit3, Check, X } from "lucide-react"

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
  handleTimeOut: () => void
  user?: {
    id?: number
    work_schedule?: string | object
  }
  refreshUser?: () => Promise<void>
  trackingMode: "manual" | "automatic"
  onTrackingModeChange: (mode: "manual" | "automatic") => void
}

/**
 * RegularTimeTracking component handles time tracking functionality for interns.
 * Supports both manual and automatic tracking modes with schedule customization.
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
  user,
  trackingMode,
  onTrackingModeChange,
}: RegularTimeTrackingProps) {
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [isEditingSchedule, setIsEditingSchedule] = useState(false)

  /**
   * Converts 24-hour time format to 12-hour AM/PM format
   */
  const formatTime12Hour = (time24: string): string => {
    if (!time24) return ""
    const [hours, minutes] = time24.split(':')
    const hour = parseInt(hours, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const hour12 = hour % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }

  /**
   * Gets the current day's work schedule from user's work_schedule data
   */
  const getCurrentDaySchedule = useCallback(() => {
    const today = new Date().getDay()
    const dayOfWeek = today === 0 ? 7 : today
    
    if (!user?.work_schedule) {
      return { start: "00:00", end: "00:00", isWorkDay: false }
    }

    let schedule
    try {
      schedule = typeof user.work_schedule === "string" 
        ? JSON.parse(user.work_schedule) 
        : user.work_schedule
    } catch {
      return { start: "00:00", end: "00:00", isWorkDay: false }
    }

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const todayName = dayNames[today]
    
    if (schedule[todayName] && schedule[todayName].start && schedule[todayName].end) {
      return {
        start: schedule[todayName].start,
        end: schedule[todayName].end,
        isWorkDay: true
      }
    }

    if (schedule.days && schedule.start && schedule.end) {
      const isWorkDay = schedule.days.includes(dayOfWeek)
      return {
        start: schedule.start,
        end: schedule.end,
        isWorkDay
      }
    }
    
    return { start: "00:00", end: "00:00", isWorkDay: false }
  }, [user?.work_schedule])

  const [todaySchedule, setTodaySchedule] = useState(getCurrentDaySchedule())

  /**
   * Gets localStorage key for today's custom schedule
   */
  const getTodayStorageKey = useCallback(() => {
    const today = new Date().toISOString().split('T')[0]
    return `custom_schedule_${today}_${user?.id || 'unknown'}`
  }, [user?.id])

  /**
   * Load custom schedule from localStorage if it exists
   */
  useEffect(() => {
    const storageKey = getTodayStorageKey()
    const savedSchedule = localStorage.getItem(storageKey)
    
    if (savedSchedule) {
      try {
        const customSchedule = JSON.parse(savedSchedule)
        setTodaySchedule(customSchedule)
      } catch {
        setTodaySchedule(getCurrentDaySchedule())
      }
    } else {
      setTodaySchedule(getCurrentDaySchedule())
    }
  }, [user?.id, user?.work_schedule, getCurrentDaySchedule, getTodayStorageKey])

  /**
   * Simple reset to default schedule when auto timeout triggers
   */
  useEffect(() => {
    if (autoTimeoutTriggered && user?.id) {
      const storageKey = getTodayStorageKey()
      localStorage.removeItem(storageKey)
      setTodaySchedule(getCurrentDaySchedule())
      setIsEditingSchedule(false)
    }
  }, [autoTimeoutTriggered, user?.id, getCurrentDaySchedule, getTodayStorageKey])

  /**
   * Save custom schedule to localStorage whenever it changes
   */
  useEffect(() => {
    const dbSchedule = getCurrentDaySchedule()
    const isCustom = JSON.stringify(todaySchedule) !== JSON.stringify(dbSchedule)
    
    if (isCustom && user?.id && !autoTimeoutTriggered) {
      const storageKey = getTodayStorageKey()
      localStorage.setItem(storageKey, JSON.stringify(todaySchedule))
    }
  }, [todaySchedule, user?.id, autoTimeoutTriggered, getCurrentDaySchedule, getTodayStorageKey])

  /**
   * Handles updating the schedule for the current day
   */
  const handleScheduleUpdate = async () => {
    setSavingSchedule(true)
    setScheduleError(null)
    
    try {
      const scheduleToSave = { ...todaySchedule, isWorkDay: true }
      setTodaySchedule(scheduleToSave)
      
      if (user?.id) {
        const storageKey = getTodayStorageKey()
        localStorage.setItem(storageKey, JSON.stringify(scheduleToSave))
      }
      
      setIsEditingSchedule(false)
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : "Failed to update schedule.")
    } finally {
      setSavingSchedule(false)
    }
  }

  /**
   * Handles canceling schedule edit and reverting to saved state
   */
  const handleCancelEdit = () => {
    const storageKey = getTodayStorageKey()
    const savedSchedule = localStorage.getItem(storageKey)
    
    if (savedSchedule) {
      try {
        const customSchedule = JSON.parse(savedSchedule)
        setTodaySchedule(customSchedule)
      } catch {
        setTodaySchedule(getCurrentDaySchedule())
      }
    } else {
      setTodaySchedule(getCurrentDaySchedule())
    }
    
    setIsEditingSchedule(false)
    setScheduleError(null)
  }

  return (
    <div className="space-y-4">
      <div className="text-center relative">
        <h3 className="text-lg font-semibold text-gray-900">Time Tracking</h3>
        <p className="text-sm text-gray-600">
          {autoTimeoutTriggered
            ? "You're done for the day."
            : isTimedIn
              ? "You're currently clocked in."
              : "Ready to start your shift?"}
        </p>
        <div className="absolute top-0 right-0 flex items-center gap-2">
          <span className="text-xs text-gray-600">Auto</span>
          <Switch
            checked={trackingMode === "automatic"}
            onCheckedChange={(checked) => onTrackingModeChange(checked ? "automatic" : "manual")}
          />
        </div>
      </div>

      {trackingMode === "automatic" && (
        <div>
          <div className="flex gap-2 items-center justify-center">
            <input
              type="time"
              value={todaySchedule.start}
              onChange={(e) => setTodaySchedule(prev => ({ ...prev, start: e.target.value }))}
              disabled={!isEditingSchedule}
              className="border rounded px-2 py-1 text-sm text-center disabled:cursor-not-allowed"
            />
            <span className="text-sm">to</span>
            <input
              type="time"
              value={todaySchedule.end}
              onChange={(e) => setTodaySchedule(prev => ({ ...prev, end: e.target.value }))}
              disabled={!isEditingSchedule}
              className="border rounded px-2 py-1 text-sm text-center disabled:cursor-not-allowed"
            />
            {isEditingSchedule ? (
              <>
                <Button
                  size="sm"
                  onClick={handleScheduleUpdate}
                  disabled={savingSchedule}
                  className="h-7 px-2 text-xs ml-2"
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={savingSchedule}
                  className="h-7 px-2 text-xs"
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditingSchedule(true)}
                className="h-7 px-2 text-xs ml-2"
              >
                <Edit3 className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          {scheduleError && (
            <div className="text-red-500 text-xs text-center mt-2">{scheduleError}</div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {trackingMode === "automatic" ? (
          <div className="text-center">
            {autoTimeoutTriggered ? (
              <Badge variant="secondary" className="bg-red-100 text-red-800">
                Auto Timed Out - Work Day Complete
              </Badge>
            ) : todaySchedule.start !== "00:00" && todaySchedule.end !== "00:00" ? (
              isTimedIn ? (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  In Progress - Auto Time Out at {formatTime12Hour(todaySchedule.end)}
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Auto Time In at {formatTime12Hour(todaySchedule.start)}
                </Badge>
              )
            ) : (
              <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                Set schedule to enable auto tracking
              </Badge>
            )}
          </div>
        ) : (
          <>
            <div className="text-center">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {autoTimeoutTriggered
                  ? "Regular Hours Met"
                  : isTimedIn
                    ? timeInTimestamp
                      ? `Clocked in at ${timeInTimestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                      : "Clocked in"
                    : "Log Regular Shift"}
              </Badge>
            </div>
            {!isTimedIn ? (
              <Button
                onClick={handleTimeIn}
                size="lg"
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={actionLoading || freezeSessionAt !== null || autoTimeoutTriggered}
              >
                <Timer className="mr-2 h-5 w-5" />
                {loadingAction === "timein" ? "Processing..." : "Time In"}
              </Button>
            ) : (
              <Button
                onClick={handleTimeOut}
                size="lg"
                variant="destructive"
                className="w-full"
                disabled={actionLoading}
              >
                <Timer className="mr-2 h-5 w-5" />
                {loadingAction === "timeout" ? "Processing..." : "Time Out"}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}