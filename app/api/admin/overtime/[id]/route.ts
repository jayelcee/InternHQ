import { NextRequest, NextResponse } from "next/server"
import { updateOvertimeStatus } from "@/lib/data-access"
import { verifyToken } from "@/lib/auth"

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
