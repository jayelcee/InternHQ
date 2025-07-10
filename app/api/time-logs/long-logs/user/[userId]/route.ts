/**
 * @file API route to check for unsplit long logs for a specific user.
 * 
 * GET: Returns { hasLongLogs: boolean, count: number } for the specified user.
 *      Requires authentication via 'auth-token' cookie.
 *      Users can check their own logs; admins can check any user's logs.
 *      Returns 401/403 for unauthorized access, 500 on error.
 */
import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { checkLongLogsForUser } from "@/lib/data-access"

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

  } catch {
    // Gracefully handle unexpected errors
    return NextResponse.json(
      { error: "Failed to check long logs for user" }, 
      { status: 500 }
    )
  }
}
