import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { migrateLongLogsForUser } from "@/lib/data-access"

/**
 * POST /api/time-logs/long-logs/user/[userId]/migrate
 * 
 * Migrate long logs for a specific user.
 * 
 * @returns Migration result with success, processed count, and errors
 */
export async function POST(
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
    
    // Users can only migrate their own logs, admins can migrate any user's logs
    if (role !== "admin" && authUserId !== requestedUserId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const result = await migrateLongLogsForUser(requestedUserId)
    
    return NextResponse.json(result)

  } catch (error) {
    console.error("Migrate user long logs error:", error)
    return NextResponse.json(
      { error: "Failed to migrate long logs for user" }, 
      { status: 500 }
    )
  }
}
