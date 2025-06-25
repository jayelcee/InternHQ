import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Timer } from "lucide-react"

interface OvertimeTrackingProps {
  isOvertimeIn: boolean
  overtimeInTimestamp: Date | null
  actionLoading: boolean
  loadingAction: "timein" | "timeout" | "overtimein" | "overtimeout" | null
  freezeSessionAt: Date | null
  autoTimeoutTriggered: boolean
  handleOvertimeIn: () => Promise<void>
  handleOvertimeOut: () => Promise<void>
}

export function OvertimeTracking({
  isOvertimeIn,
  overtimeInTimestamp,
  actionLoading,
  loadingAction,
  freezeSessionAt,
  autoTimeoutTriggered,
  handleOvertimeIn,
  handleOvertimeOut,
}: OvertimeTrackingProps) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900">Overtime Tracking</h3>
        <p className="text-sm text-gray-600">
          {isOvertimeIn
            ? "You're currently in an overtime session."
            : "Log extra hours beyond your regular shift."}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {/* Always show badge depending on state */}
        <div className="text-center">
          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
            {autoTimeoutTriggered
              ? isOvertimeIn
                ? overtimeInTimestamp
                  ? `Overtime started at ${overtimeInTimestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                  : "Overtime started"
                : "Render Overtime"
              : "Render Regular Hours First"}
          </Badge>
        </div>
        {!isOvertimeIn ? (
          <Button
            onClick={handleOvertimeIn}
            size="lg"
            className="w-full bg-purple-600 hover:bg-purple-700"
            disabled={actionLoading || freezeSessionAt !== null || !autoTimeoutTriggered}
          >
            <Timer className="mr-2 h-5 w-5" />
            {loadingAction === "overtimein" ? "Processing..." : "Overtime In"}
          </Button>
        ) : (
          <Button
            onClick={handleOvertimeOut}
            size="lg"
            variant="destructive"
            className="w-full"
            disabled={actionLoading}
          >
            <Timer className="mr-2 h-5 w-5" />
            {loadingAction === "overtimeout" ? "Processing..." : "Overtime Out"}
          </Button>
        )}
      </div>
    </div>
  )
}