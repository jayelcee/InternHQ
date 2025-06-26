import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { updateTimeLog } from "@/lib/data-access"

/**
 * Admin endpoint for updating time log entries
 */
export async function PUT(
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

    const updates = await request.json()
    
    // Validate updates
    const allowedFields = ["time_in", "time_out", "notes", "status", "log_type"]
    const validUpdates: Record<string, unknown> = {}
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        validUpdates[key] = value
      }
    }

    if (Object.keys(validUpdates).length === 0) {
      return NextResponse.json({ error: "No valid updates provided" }, { status: 400 })
    }

    const result = await updateTimeLog(Number(id), validUpdates)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating time log:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
