/**
 * @file API route for admin to update or delete a specific overtime log.
 * 
 * PUT: Approves, rejects, or reverts an overtime log to pending.
 *      Requires admin authentication via 'auth-token' cookie.
 *      Expects JSON body with 'status' ('approved', 'rejected', or 'pending').
 *      Returns 401 if unauthorized, 400 for invalid input or service errors.
 *      On success, returns { success: true }.
 * 
 * DELETE: Permanently deletes an overtime or extended overtime log.
 *         Requires admin authentication via 'auth-token' cookie.
 *         Returns 401 if unauthorized, 404 if not found.
 *         On success, returns { success: true }.
 */
import { NextRequest, NextResponse } from "next/server"
import { updateOvertimeStatus } from "@/lib/data-access"
import { verifyToken } from "@/lib/auth"
import { sql } from "@/lib/database"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)

    if (!valid || !userId || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const resolvedParams = await params
    const timeLogId = parseInt(resolvedParams.id)
    if (isNaN(timeLogId)) {
      return NextResponse.json({ error: "Invalid time log ID" }, { status: 400 })
    }

    const { status } = await request.json()

    if (!status || !["approved", "rejected", "pending"].includes(status)) {
      return NextResponse.json({ error: "Invalid status. Must be 'approved', 'rejected', or 'pending'" }, { status: 400 })
    }

    const result = await updateOvertimeStatus(timeLogId, status, userId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    // Gracefully handle unexpected errors
    return NextResponse.json(
      { error: "Failed to update overtime status" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)

    if (!valid || !userId || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const resolvedParams = await params
    const timeLogId = parseInt(resolvedParams.id)
    if (isNaN(timeLogId)) {
      return NextResponse.json({ error: "Invalid time log ID" }, { status: 400 })
    }

    // Check if the overtime log exists
    const existingLog = await sql`
      SELECT id FROM time_logs 
      WHERE id = ${timeLogId} 
      AND (log_type = 'overtime' OR log_type = 'extended_overtime')
    `

    if (existingLog.length === 0) {
      return NextResponse.json({ error: "Overtime log not found" }, { status: 404 })
    }

    // Delete the overtime log
    await sql`
      DELETE FROM time_logs 
      WHERE id = ${timeLogId}
    `

    return NextResponse.json({ success: true })
  } catch {
    // Gracefully handle unexpected errors
    return NextResponse.json(
      { error: "Failed to delete overtime log" },
      { status: 500 }
    )
  }
}
