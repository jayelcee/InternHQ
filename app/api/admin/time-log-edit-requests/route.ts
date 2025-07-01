import { NextResponse } from "next/server"
import { sql } from "@/lib/database"

// GET /api/admin/time-log-edit-requests
export async function GET() {
  // Example: assumes a table 'time_log_edit_requests' with relevant columns
  // and joins to users and time_logs for display
  try {
    const requests = await sql`
      SELECT r.id, r.log_id as "logId", u.first_name || ' ' || u.last_name as "internName",
        r.requested_time_in as "requestedTimeIn", r.requested_time_out as "requestedTimeOut",
        t.time_in as "originalTimeIn", t.time_out as "originalTimeOut",
        r.status, r.created_at as "requestedAt"
      FROM time_log_edit_requests r
      JOIN time_logs t ON r.log_id = t.id
      JOIN users u ON r.requested_by = u.id
      ORDER BY r.created_at DESC
    `
    return NextResponse.json(requests)
  } catch (err) {
    console.error("Error fetching edit requests:", err)
    return NextResponse.json({ error: "Failed to fetch edit requests" }, { status: 500 })
  }
}
