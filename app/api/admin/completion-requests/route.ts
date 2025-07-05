import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)
    if (!valid || !userId || role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all completion requests with intern details
    const result = await sql`
      SELECT cr.*, 
             ip.required_hours, ip.start_date, ip.end_date,
             u.first_name, u.last_name, u.email,
             s.name as school_name,
             d.name as department_name,
             reviewer.first_name as reviewer_first_name,
             reviewer.last_name as reviewer_last_name
      FROM internship_completion_requests cr
      JOIN internship_programs ip ON cr.internship_program_id = ip.id
      JOIN users u ON cr.user_id = u.id
      LEFT JOIN schools s ON ip.school_id = s.id
      LEFT JOIN departments d ON ip.department_id = d.id
      LEFT JOIN users reviewer ON cr.reviewed_by = reviewer.id
      ORDER BY cr.created_at DESC
    `

    // Ensure numeric fields are properly typed
    const formattedResult = result.map(row => ({
      ...row,
      total_hours_completed: Number(row.total_hours_completed),
      required_hours: Number(row.required_hours),
      user_id: Number(row.user_id),
      internship_program_id: Number(row.internship_program_id)
    }))

    return NextResponse.json(formattedResult)

  } catch (error) {
    console.error('Error fetching completion requests:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
