import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/api-middleware"
import { sql } from "@/lib/database"
import { calculateInternshipProgress } from "@/lib/time-utils"

export async function POST(request: NextRequest) {
  const authResult = await withAuth(request, "intern")
  
  if (!authResult.success) {
    return authResult.response
  }

  const { auth } = authResult
  const userId = parseInt(auth.userId)

  try {

    // Check if already has a request
    const existingRequests = await sql`
      SELECT id FROM internship_completion_requests
      WHERE user_id = ${userId}
    `

    if (existingRequests.length > 0) {
      return NextResponse.json({ error: "Completion request already exists" }, { status: 400 })
    }

    // Get user's internship details
    const internships = await sql`
      SELECT ip.*, s.name as school_name, d.name as department_name
      FROM internship_programs ip
      LEFT JOIN schools s ON ip.school_id = s.id
      LEFT JOIN departments d ON ip.department_id = d.id
      WHERE ip.user_id = ${userId}
    `

    const internship = internships[0]
    if (!internship) {
      return NextResponse.json({ error: "Internship not found" }, { status: 404 })
    }

    // Calculate total hours from time logs using the same logic as the frontend
    const logs = await sql`
      SELECT id, time_in, time_out, status, log_type, overtime_status, user_id
      FROM time_logs
      WHERE user_id = ${userId}
    `

    // Get edit requests for accurate hour calculation
    const editRequestsRaw = await sql`
      SELECT ter.log_id as "logId", ter.status, ter.requested_time_in as "requestedTimeIn", ter.requested_time_out as "requestedTimeOut"
      FROM time_log_edit_requests ter
      JOIN time_logs tl ON ter.log_id = tl.id
      WHERE tl.user_id = ${userId}
    `

    const editRequests = editRequestsRaw.map((req: any) => ({
      logId: req.logId,
      status: req.status as "pending" | "approved" | "rejected",
      requestedTimeIn: req.requestedTimeIn,
      requestedTimeOut: req.requestedTimeOut
    }))

    // Format logs to match the function's expected format
    const formattedLogs = logs.map(log => ({
      id: log.id,
      time_in: log.time_in,
      time_out: log.time_out,
      status: log.status,
      log_type: log.log_type,
      overtime_status: log.overtime_status,
      user_id: log.user_id
    }))

    const totalHours = calculateInternshipProgress(formattedLogs, userId, editRequests)

    // Create completion request
    const completionRequests = await sql`
      INSERT INTO internship_completion_requests (
        user_id,
        internship_program_id,
        total_hours_completed,
        completion_date,
        status
      )
      VALUES (
        ${userId},
        ${internship.id},
        ${totalHours},
        NOW(),
        'pending'
      )
      RETURNING *
    `

    const completionRequest = completionRequests[0]
    if (!completionRequest) {
      return NextResponse.json({ error: "Failed to create completion request" }, { status: 500 })
    }

    // Convert numeric fields to proper numbers
    const formattedRequest = {
      ...completionRequest,
      total_hours_completed: parseFloat(completionRequest.total_hours_completed) || 0
    }

    return NextResponse.json({ request: formattedRequest })
  } catch (error) {
    console.error('Error submitting completion request:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
