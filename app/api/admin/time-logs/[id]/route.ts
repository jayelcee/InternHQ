import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { deleteTimeLog } from "@/lib/data-access"

/**
 * Admin endpoint for deleting time log entries
 * Note: Time log editing now goes through the edit request system for consistency
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)

    if (!valid || !userId || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await deleteTimeLog(Number(id))

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting time log:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Admin time log editing has been moved to the edit request system for consistency.
 * Admin edits now go through /api/interns/time-log-edit with isAdminEdit=true for auto-approval.
 * This ensures both admin and intern edits use the exact same logic.
 */
export async function PUT() {
  return NextResponse.json({ 
    error: "Admin time log editing has been moved to the edit request system. Use /api/interns/time-log-edit with isAdminEdit=true." 
  }, { status: 410 })
}
