import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/database'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)
    if (!valid || !userId || role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { action, admin_notes } = body

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Get the completion request
    const completionRequest = await sql`
      SELECT cr.*, ip.user_id as intern_id, ip.id as internship_program_id
      FROM internship_completion_requests cr
      JOIN internship_programs ip ON cr.internship_program_id = ip.id
      WHERE cr.id = ${id} AND cr.status = 'pending'
    `

    if (completionRequest.length === 0) {
      return NextResponse.json({ error: 'Completion request not found or already processed' }, { status: 404 })
    }

    const request_data = completionRequest[0]

    if (action === 'approve') {
      // Update completion request status
      await sql`
        UPDATE internship_completion_requests 
        SET status = 'approved', 
            reviewed_by = ${userId}, 
            reviewed_at = ${new Date()}, 
            admin_notes = ${admin_notes || null}
        WHERE id = ${id}
      `

      // Update internship program status
      await sql`
        UPDATE internship_programs 
        SET status = 'completed', 
            completion_approved_at = ${new Date()},
            completion_approved_by = ${userId}
        WHERE id = ${request_data.internship_program_id}
      `

      return NextResponse.json({
        message: 'Completion request approved successfully'
      })

    } else if (action === 'reject') {
      // Update completion request status
      await sql`
        UPDATE internship_completion_requests 
        SET status = 'rejected', 
            reviewed_by = ${userId}, 
            reviewed_at = ${new Date()}, 
            admin_notes = ${admin_notes || null}
        WHERE id = ${id}
      `

      // Reset internship program status to active
      await sql`
        UPDATE internship_programs 
        SET status = 'active', 
            completion_requested_at = null
        WHERE id = ${request_data.internship_program_id}
      `

      return NextResponse.json({
        message: 'Completion request rejected successfully'
      })
    }

  } catch (error) {
    console.error('Error processing completion request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
