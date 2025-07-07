import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { sql } from "@/lib/database"
import { DAILY_REQUIRED_HOURS, MAX_OVERTIME_HOURS } from "@/lib/time-utils"

/**
 * GET /api/admin/check-long-logs
 * 
 * Check if there are any logs that need migration to the 3-tier time tracking system.
 * This includes:
 * - Regular logs >9 hours (should be split)
 * - Overtime logs >3 hours (should be split into overtime + extended_overtime)
 * - Extended overtime logs >12 hours total (should be split into regular + overtime + extended_overtime)
 * 
 * Used to conditionally show the migration button in the admin interface.
 * 
 * @returns Object with hasLongLogs boolean and count number
 */
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

    // Query for logs longer than required hours that haven't been split properly
    const result = await sql`
      SELECT COUNT(*) as count 
      FROM time_logs 
      WHERE status = 'completed' 
        AND time_in IS NOT NULL 
        AND time_out IS NOT NULL
        AND (
          -- Regular logs > 9 hours (should be split)
          (log_type = 'regular' AND EXTRACT(EPOCH FROM (time_out - time_in)) / 3600 > ${DAILY_REQUIRED_HOURS})
          OR 
          -- Overtime logs > 3 hours (should be split into overtime + extended_overtime)
          (log_type = 'overtime' AND EXTRACT(EPOCH FROM (time_out - time_in)) / 3600 > ${MAX_OVERTIME_HOURS})
          OR
          -- Extended overtime logs > 12 hours total (should be split into regular + overtime + extended_overtime)
          (log_type = 'extended_overtime' AND EXTRACT(EPOCH FROM (time_out - time_in)) / 3600 > ${DAILY_REQUIRED_HOURS + MAX_OVERTIME_HOURS})
        )
    `

    const count = parseInt(result[0].count)
    
    return NextResponse.json({ 
      hasLongLogs: count > 0,
      count: count
    })

  } catch (error) {
    console.error("Check long logs error:", error)
    return NextResponse.json(
      { error: "Failed to check long logs" },
      { status: 500 }
    )
  }
}
