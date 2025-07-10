/**
 * Utility to check for pending edit requests and pending overtime for an intern.
 *
 * Exports:
 * - getPendingIssues: Returns { hasPendingEditRequests, hasPendingOvertime }
 */
import { fetchEditRequests } from "@/lib/time-utils"

export async function getPendingIssues(internId: string | number) {
  const editRequests = await fetchEditRequests(internId)
  const hasPendingEditRequests = editRequests.some(req => req.status === "pending")

  const response = await fetch("/api/time-logs", { credentials: "include" })
  let hasPendingOvertime = false
  if (response.ok) {
    const data = await response.json()
    const logs: { log_type: string; overtime_status?: string }[] = Array.isArray(data) ? data : data.logs || []
    hasPendingOvertime = logs.some(log =>
      (log.log_type === "overtime" || log.log_type === "extended_overtime") &&
      (log.overtime_status === "pending" || !log.overtime_status)
    )
  }

  return {
    hasPendingEditRequests,
    hasPendingOvertime
  }
}
