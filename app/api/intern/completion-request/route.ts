import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/api-middleware"
import { sql } from "@/lib/database"
import { calculateTimeStatistics } from "@/lib/time-utils"
import { CompletionService } from "@/lib/completion-service"

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

    const stats = await calculateTimeStatistics(formattedLogs, String(userId), {
      includeEditRequests: false, // Disable edit requests for server-side calculation
      requiredHours: internship.required_hours
    })

    // Check if intern has completed required hours
    if (stats.internshipProgress < internship.required_hours) {
      return NextResponse.json({ 
        error: 'Insufficient hours completed',
        required: internship.required_hours,
        completed: stats.internshipProgress
      }, { status: 400 })
    }

    // Use the service to create the completion request
    const result = await CompletionService.createCompletionRequest(
      userId,
      internship.id,
      stats.internshipProgress
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      message: 'Completion request submitted successfully',
      request: result.request
    })
  } catch (error) {
    console.error('Error submitting completion request:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
