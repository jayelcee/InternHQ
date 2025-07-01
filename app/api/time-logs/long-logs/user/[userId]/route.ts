import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { checkLongLogsForUser } from "@/lib/data-access"

/**
 * GET /api/time-logs/long-logs/user/[userId]
 * 
 * Check if there are any unsplit long logs for a specific user.
 * Used to show user-specific migration button count in DTR.
 * 
 * @returns Object with hasLongLogs boolean and count number for specific user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Authenticate user
    const token = request.cookies.get("auth-token")?.value
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const { valid, userId: authUserId, role } = await verifyToken(token)
    if (!valid || !authUserId) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 403 })
    }

    const resolvedParams = await params
    const requestedUserId = parseInt(resolvedParams.userId)
    
    // Users can only check their own logs, admins can check any user's logs
    if (role !== "admin" && authUserId !== requestedUserId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const result = await checkLongLogsForUser(requestedUserId)
    
    return NextResponse.json(result)

  } catch (error) {
    console.error("Check user long logs error:", error)
    return NextResponse.json(
      { error: "Failed to check long logs for user" }, 
      { status: 500 }
    )
  }
}
