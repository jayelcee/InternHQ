/**
 * @file API route for admin to migrate long time logs to the new 3-tier system.
 * 
 * POST: Splits existing long logs (>9 hours) into regular and overtime portions.
 *       Requires admin authentication via 'auth-token' cookie.
 *       Returns 401 if unauthorized, 403 if not admin.
 *       On success, returns processed count and errors (if any).
 */
import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { migrateExistingLongLogs } from "@/lib/data-access"

export async function POST(request: NextRequest) {
  try {
    // Authenticate admin user
    const token = request.cookies.get("auth-token")?.value
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)
    if (!valid || !userId || role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    // Execute migration
    const result = await migrateExistingLongLogs()
    
    return result.success 
      ? NextResponse.json({
          message: `Migration completed successfully. Processed ${result.processed} logs.`,
          processed: result.processed,
          errors: result.errors
        })
      : NextResponse.json({
          error: "Migration failed",
          errors: result.errors
        }, { status: 500 })

  } catch {
    // Gracefully handle unexpected errors
    return NextResponse.json(
      { error: "Internal server error during migration" },
      { status: 500 }
    )
  }
}
