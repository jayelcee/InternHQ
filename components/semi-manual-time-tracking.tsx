import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Timer } from "lucide-react"

interface SemiManualTimeTrackingProps {
  isTimedIn: boolean
  timeInTimestamp: Date | null
  actionLoading: boolean
  loadingAction: null | "timein" | "timeout" | "overtimein" | "overtimeout"
  freezeSessionAt: Date | null
  autoTimeoutTriggered: boolean
  handleTimeIn: () => void
  handleTimeOut: () => void
}

export function SemiManualTimeTracking({
  isTimedIn,
  timeInTimestamp,
  actionLoading,
  loadingAction,
  freezeSessionAt,
  autoTimeoutTriggered,
  handleTimeIn,
  handleTimeOut,
}: SemiManualTimeTrackingProps) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900">Time Tracking</h3>
        <p className="text-sm text-gray-600">
          {autoTimeoutTriggered
            ? "You're done for the day."
            : isTimedIn
              ? "You're currently clocked in."
              : "Ready to start your shift?"}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {/* Always show badge depending on state */}
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
      </div>
    </div>
  )
}