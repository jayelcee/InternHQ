import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/database'
import { calculateTimeStatistics } from '@/lib/time-utils'

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
    const { admin_signature_name, admin_title } = body

    if (!admin_signature_name || !admin_title) {
      return NextResponse.json({ 
        error: 'Admin signature name and title are required' 
      }, { status: 400 })
    }

    // Get the approved completion request
    const completionRequest = await sql`
      SELECT cr.*, 
             ip.user_id as intern_id, ip.required_hours, ip.start_date, ip.end_date,
             u.first_name, u.last_name, u.email,
             s.name as school_name,
             d.name as department_name
      FROM internship_completion_requests cr
      JOIN internship_programs ip ON cr.internship_program_id = ip.id
      JOIN users u ON cr.user_id = u.id
      LEFT JOIN schools s ON ip.school_id = s.id
      LEFT JOIN departments d ON ip.department_id = d.id
      WHERE cr.id = ${id} AND cr.status = 'approved'
    `

    if (completionRequest.length === 0) {
      return NextResponse.json({ 
        error: 'Approved completion request not found' 
      }, { status: 404 })
    }

    const request_data = completionRequest[0]

    // Check if DTR document already exists
    const existingDTR = await sql`
      SELECT * FROM official_dtr_documents 
      WHERE completion_request_id = ${id}
    `

    if (existingDTR.length > 0) {
      return NextResponse.json({ 
        error: 'DTR document already exists for this completion request' 
      }, { status: 400 })
    }

    // Get all time logs for the intern
    const timeLogsResult = await sql`
      SELECT * FROM time_logs 
      WHERE user_id = ${request_data.intern_id} 
      ORDER BY time_in
    `

    // Calculate detailed time statistics
    const stats = await calculateTimeStatistics(
      timeLogsResult,
      String(request_data.intern_id),
      {
        includeEditRequests: true,
        requiredHours: request_data.required_hours
      }
    )

    // Generate document number
    const documentNumber = `DTR-${new Date().getFullYear()}-${String(request_data.intern_id).padStart(4, '0')}-${Date.now().toString().slice(-6)}`

    // Create official DTR document record
    const dtrDocument = await sql`
      INSERT INTO official_dtr_documents 
      (user_id, internship_program_id, completion_request_id, document_number, 
       total_hours, regular_hours, overtime_hours, period_start, period_end,
       issued_by, admin_signature_name, admin_title)
      VALUES (${request_data.intern_id}, ${request_data.internship_program_id}, ${id}, 
              ${documentNumber}, ${stats.internshipProgress}, ${stats.regularHours}, 
              ${stats.overtimeHours.total}, ${request_data.start_date}, ${request_data.end_date},
              ${userId}, ${admin_signature_name}, ${admin_title})
      RETURNING *
    `

    // Generate DTR content
    const dtrContent = {
      documentNumber: documentNumber,
      internName: `${request_data.first_name} ${request_data.last_name}`,
      school: request_data.school_name,
      department: request_data.department_name,
      periodStart: request_data.start_date,
      periodEnd: request_data.end_date,
      totalHours: stats.internshipProgress,
      regularHours: stats.regularHours,
      overtimeHours: stats.overtimeHours.total,
      requiredHours: request_data.required_hours,
      timeLogsDetails: timeLogsResult.map(log => ({
        date: log.time_in ? new Date(log.time_in).toLocaleDateString() : 'N/A',
        timeIn: log.time_in ? new Date(log.time_in).toLocaleTimeString() : 'N/A',
        timeOut: log.time_out ? new Date(log.time_out).toLocaleTimeString() : 'N/A',
        logType: log.log_type,
        status: log.status,
        overtimeStatus: log.overtime_status
      })),
      adminSignature: admin_signature_name,
      adminTitle: admin_title,
      issueDate: new Date().toLocaleDateString(),
      documentId: dtrDocument[0].id
    }

    return NextResponse.json({
      message: 'DTR document generated successfully',
      document: dtrDocument[0],
      content: dtrContent
    })

  } catch (error) {
    console.error('Error generating DTR document:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
