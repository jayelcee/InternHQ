import { NextRequest, NextResponse } from "next/server"
import { updateOvertimeStatus } from "@/lib/data-access"
import { verifyToken } from "@/lib/auth"
import { sql } from "@/lib/database"

/**
 * PUT /api/admin/overtime/[id]
 * Approve, reject, or revert overtime log to pending (admin only)
 */
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
  } catch (error) {
    console.error("Error updating overtime status:", error)
    return NextResponse.json(
      { error: "Failed to update overtime status" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/overtime/[id]
 * Permanently delete overtime log (admin only)
 */
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
  } catch (error) {
    console.error("Error deleting overtime log:", error)
    return NextResponse.json(
      { error: "Failed to delete overtime log" },
      { status: 500 }
    )
  }
}
