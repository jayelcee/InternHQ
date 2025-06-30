import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/database"
import { revertTimeLogToOriginal } from "@/lib/data-access"

// PUT /api/admin/time-log-edit-requests/[id]
export async function PUT(request: NextRequest) {
  // Extract id from the dynamic route using nextUrl
  const idStr = request.nextUrl.pathname.split("/").pop()
  const id = Number(idStr)
  if (!id) {
    return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
  }
  try {
    const { action, reviewedBy } = await request.json()
    if (!["approve", "reject", "revert"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
    // Fetch the edit request to get requested times and log_id
    const reqRows = await sql`
      SELECT * FROM time_log_edit_requests WHERE id = ${id}
    `
    if (reqRows.length === 0) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }
    const editReq = reqRows[0]
    if (action === "approve") {
      // Update the time_logs table with the requested values
      await sql`
        UPDATE time_logs
        SET
          time_in = COALESCE(${editReq.requested_time_in}, time_in),
          time_out = COALESCE(${editReq.requested_time_out}, time_out)
        WHERE id = ${editReq.log_id}
      `
      await sql`
        UPDATE time_log_edit_requests
        SET status = 'approved', reviewed_at = NOW(), reviewed_by = ${reviewedBy || null}
        WHERE id = ${id}
      `
    } else if (action === "reject") {
      await sql`
        UPDATE time_log_edit_requests
        SET status = 'rejected', reviewed_at = NOW(), reviewed_by = ${reviewedBy || null}
        WHERE id = ${id}
      `
    } else if (action === "revert") {
      await sql`
        UPDATE time_log_edit_requests
        SET status = 'pending', reviewed_at = NULL, reviewed_by = NULL
        WHERE id = ${id}
      `
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 })
  }
}

// --- Add this at the end of the file to support /api/admin/time-log-edit-requests/[id]/revert ---

export const dynamic = "force-dynamic"; // Ensure Next.js treats both PUT and POST as valid

// This POST handler will only respond to /api/admin/time-log-edit-requests/[id]/revert
export async function POST(request: NextRequest, context: { params: { id: string } }) {
  // Check if the path ends with /revert
  const url = request.nextUrl.pathname
  if (!url.endsWith("/revert")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  // Extract the id from the path (second to last segment)
  const urlParts = url.split("/").filter(Boolean)
  const idStr = urlParts[urlParts.length - 2]
  const id = Number(idStr)
  if (!id) {
    return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
  }
  try {
    const result = await revertTimeLogToOriginal(id)
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to revert time log" }, { status: 500 })
    }
    await sql`
      UPDATE time_log_edit_requests
      SET status = 'pending', reviewed_at = NULL, reviewed_by = NULL
      WHERE id = ${id}
    `
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to revert time log" }, { status: 500 })
  }
}
