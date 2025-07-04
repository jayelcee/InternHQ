import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/database"

/**
 * API Route: GET /api/admin/time-log-edit-requests
 * Returns all time log edit requests with related user, requester, and reviewer info.
 *
 * - Requires admin authentication (token checked via cookies).
 * - Returns an array of edit request objects with user, requester, and reviewer details.
 * - On error, returns 500 with error message.
 */
export async function GET(request: NextRequest) {
  // Minimal token presence logging for debugging auth issues
  console.log("[EDIT REQUESTS LIST] auth-token:", request.cookies.get("auth-token")?.value ? "exists" : "missing")
  console.log("[EDIT REQUESTS LIST] token:", request.cookies.get("token")?.value ? "exists" : "missing")

  try {
    // Fetch all edit requests with user, requester, and reviewer info
    const requests = await sql`
      SELECT 
        r.id, 
        r.log_id as "logId", 
        r.reviewed_by as "raw_reviewed_by",
        log_owner.first_name || ' ' || log_owner.last_name as "internName",
        log_owner.role as "userRole",
        requester.id as "requestedById",
        requester.first_name || ' ' || requester.last_name as "requestedBy",
        requester.role as "requesterRole",
        r.reviewed_by as "reviewedById",
        reviewer.first_name || ' ' || reviewer.last_name as "reviewedBy",
        r.reviewed_at as "reviewedAt",
        r.requested_time_in as "requestedTimeIn", 
        r.requested_time_out as "requestedTimeOut",
        r.original_time_in as "originalTimeIn", 
        r.original_time_out as "originalTimeOut",
        r.status, 
        r.created_at as "requestedAt"
      FROM time_log_edit_requests r
      JOIN time_logs t ON r.log_id = t.id
      JOIN users log_owner ON t.user_id = log_owner.id
      JOIN users requester ON r.requested_by = requester.id
      LEFT JOIN users reviewer ON r.reviewed_by = reviewer.id
      ORDER BY r.created_at DESC
    `
    // Log a sample of results for debugging reviewer mapping
    console.log("[EDIT REQUESTS API] First few results:", requests.slice(0, 3).map(r => ({
      id: r.id,
      status: r.status,
      userRole: r.userRole,
      requestedById: r.requestedById,
      requestedBy: r.requestedBy,
      reviewedById: r.reviewedById,
      raw_reviewed_by: r.raw_reviewed_by,
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt
    })))
    return NextResponse.json(requests)
  } catch (err) {
    console.error("Error fetching edit requests:", err)
    return NextResponse.json({ error: "Failed to fetch edit requests" }, { status: 500 })
  }
}
