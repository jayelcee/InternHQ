// Utility to fetch pending edit requests and pending overtime for the current intern
import { fetchEditRequests } from "@/lib/time-utils"

export async function getPendingIssues(internId: string | number) {
  // Fetch edit requests
  const editRequests = await fetchEditRequests(internId)
  const hasPendingEditRequests = editRequests.some(req => req.status === "pending")
  
  // Fetch time logs and check for pending overtime
  const response = await fetch("/api/time-logs", { credentials: "include" })
  let hasPendingOvertime = false
  if (response.ok) {
    const data = await response.json()
    type TimeLog = {
      log_type: string;
      overtime_status?: string;
      // add other properties as needed
    };
    const logs: TimeLog[] = Array.isArray(data) ? data : data.logs || []
    hasPendingOvertime = logs.some((log: TimeLog) => (log.log_type === "overtime" || log.log_type === "extended_overtime") && (log.overtime_status === "pending" || !log.overtime_status))
  }

  return {
    hasPendingEditRequests,
    hasPendingOvertime
  }
}
