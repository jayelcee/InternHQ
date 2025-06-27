import { NextRequest, NextResponse } from "next/server"
import { getOvertimeLogsForApproval } from "@/lib/data-access"
import { verifyToken } from "@/lib/auth"

/**
 * GET /api/admin/overtime
 * Get all overtime logs for approval (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)

    if (!valid || !userId || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const overtimeLogs = await getOvertimeLogsForApproval()
    return NextResponse.json(overtimeLogs)
  } catch (error) {
    console.error("Error fetching overtime logs:", error)
    return NextResponse.json(
      { error: "Failed to fetch overtime logs" },
      { status: 500 }
    )
  }
}
