/**
 * @file API route for admin to check if any time logs require migration to the 3-tier time tracking system.
 * 
 * GET: Returns { hasLongLogs: boolean, count: number }
 *      - hasLongLogs: true if any logs exceed allowed durations and need migration.
 *      - count: number of such logs.
 *      - Requires admin authentication via 'auth-token' cookie.
 *      - Returns 401 if not authenticated, 403 if not admin.
 */
import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { sql } from "@/lib/database"
import { DAILY_REQUIRED_HOURS, MAX_OVERTIME_HOURS } from "@/lib/time-utils"

export async function GET(request: NextRequest) {
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

    // Query for logs longer than allowed durations
    const result = await sql`
      SELECT COUNT(*) as count 
      FROM time_logs 
      WHERE status = 'completed' 
        AND time_in IS NOT NULL 
        AND time_out IS NOT NULL
        AND (
          (log_type = 'regular' AND EXTRACT(EPOCH FROM (time_out - time_in)) / 3600 > ${DAILY_REQUIRED_HOURS})
          OR 
          (log_type = 'overtime' AND EXTRACT(EPOCH FROM (time_out - time_in)) / 3600 > ${MAX_OVERTIME_HOURS})
          OR
          (log_type = 'extended_overtime' AND EXTRACT(EPOCH FROM (time_out - time_in)) / 3600 > ${DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS})
        )
    `

    const count = parseInt(result[0].count)
    
    return NextResponse.json({ 
      hasLongLogs: count > 0,
      count: count
    })

  } catch {
    // Gracefully handle errors
    return NextResponse.json(
      { error: "Failed to check long logs" },
      { status: 500 }
    )
  }
}