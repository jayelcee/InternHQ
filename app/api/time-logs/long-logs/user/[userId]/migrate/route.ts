/**
 * @file API route to migrate long logs for a specific user.
 * 
 * POST: Migrates long logs for the specified user.
 *       Requires authentication via 'auth-token' cookie.
 *       Users can migrate their own logs; admins can migrate any user's logs.
 *       Returns migration result with success, processed count, and errors.
 *       Returns 401/403 for unauthorized access, 500 on error.
 */
import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { migrateLongLogsForUser } from "@/lib/data-access"

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

  } catch {
    // Gracefully handle unexpected errors
    return NextResponse.json(
      { error: "Failed to migrate long logs for user" }, 
      { status: 500 }
    )
  }
}
