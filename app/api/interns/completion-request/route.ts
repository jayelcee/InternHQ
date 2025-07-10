/**
 * @file API route for intern completion requests.
 * 
 * POST: Submit a new completion request if requirements are met.
 *       Requires intern authentication.
 *       Returns 400 if already requested or insufficient hours, 404 if no active internship, 500 on error.
 *       On success, returns the created request.
 * 
 * GET: Fetch all completion requests for the authenticated intern.
 *      Requires intern authentication.
 *      Returns 500 on error.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/database'
import { calculateTimeStatistics } from '@/lib/time-utils'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)
    if (!valid || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (role !== 'intern') {
      return NextResponse.json({ error: 'Only interns can request completion' }, { status: 403 })
    }

    const internshipResult = await sql`
      SELECT * FROM internship_programs WHERE user_id = ${userId} AND status = 'active'
    `

    if (internshipResult.length === 0) {
      return NextResponse.json({ error: 'No active internship program found' }, { status: 404 })
    }

    const internshipProgram = internshipResult[0]

    const existingRequest = await sql`
      SELECT * FROM internship_completion_requests 
      WHERE internship_program_id = ${internshipProgram.id} AND status = 'pending'
    `

    if (existingRequest.length > 0) {
      return NextResponse.json({ error: 'Completion request already pending' }, { status: 400 })
    }

    const timeLogsResult = await sql`
      SELECT * FROM time_logs WHERE user_id = ${userId} ORDER BY time_in
    `
    const stats = await calculateTimeStatistics(
      timeLogsResult,
      String(userId),
      {
        includeEditRequests: true,
        requiredHours: internshipProgram.required_hours
      }
    )

    // Check if intern has completed required hours
    if (stats.internshipProgress < internshipProgram.required_hours) {
      return NextResponse.json({ 
        error: 'Insufficient hours completed',
        required: internshipProgram.required_hours,
        completed: stats.internshipProgress
      }, { status: 400 })
    }

    // Create completion request
    const completionRequest = await sql`
      INSERT INTO internship_completion_requests 
      (user_id, internship_program_id, total_hours_completed, completion_date, status)
      VALUES (${userId}, ${internshipProgram.id}, ${stats.internshipProgress}, ${new Date()}, 'pending')
      RETURNING *
    `

    // Update internship program status
    await sql`
      UPDATE internship_programs 
      SET status = 'pending_completion', completion_requested_at = ${new Date()}
      WHERE id = ${internshipProgram.id}
    `

    return NextResponse.json({
      message: 'Completion request submitted successfully',
      request: completionRequest[0]
    })

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)
    if (!valid || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only interns can view their own completion requests
    if (role !== 'intern') {
      return NextResponse.json({ error: 'Only interns can view completion requests' }, { status: 403 })
    }

    const result = await sql`
      SELECT cr.*, ip.required_hours, ip.start_date, ip.end_date,
             u.first_name, u.last_name
      FROM internship_completion_requests cr
      JOIN internship_programs ip ON cr.internship_program_id = ip.id
      JOIN users u ON cr.user_id = u.id
      WHERE cr.user_id = ${userId}
      ORDER BY cr.created_at DESC
    `

    // Ensure numeric fields are properly typed
    const formattedResult = result.map(row => ({
      ...row,
      total_hours_completed: Number(row.total_hours_completed),
      required_hours: Number(row.required_hours)
    }))

    return NextResponse.json(formattedResult)

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
