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

    // Check if certificate already exists
    const existingCertificate = await sql`
      SELECT * FROM completion_certificates 
      WHERE completion_request_id = ${id}
    `

    if (existingCertificate.length > 0) {
      return NextResponse.json({ 
        error: 'Certificate already exists for this completion request' 
      }, { status: 400 })
    }

    // Generate certificate number
    const certificateNumber = `CERT-${new Date().getFullYear()}-${String(request_data.intern_id).padStart(4, '0')}-${Date.now().toString().slice(-6)}`

    // Create completion certificate record
    const certificate = await sql`
      INSERT INTO completion_certificates 
      (user_id, internship_program_id, completion_request_id, certificate_number, 
       completion_date, total_hours_completed, issued_by, admin_signature_name, admin_title)
      VALUES (${request_data.intern_id}, ${request_data.internship_program_id}, ${id}, 
              ${certificateNumber}, ${request_data.completion_date}, ${request_data.total_hours_completed},
              ${userId}, ${admin_signature_name}, ${admin_title})
      RETURNING *
    `

    // Generate certificate content
    const certificateContent = {
      certificateNumber: certificateNumber,
      internName: `${request_data.first_name} ${request_data.last_name}`,
      school: request_data.school_name,
      department: request_data.department_name,
      periodStart: request_data.start_date,
      periodEnd: request_data.end_date,
      completionDate: request_data.completion_date,
      totalHoursCompleted: request_data.total_hours_completed,
      requiredHours: request_data.required_hours,
      adminSignature: admin_signature_name,
      adminTitle: admin_title,
      issueDate: new Date().toLocaleDateString(),
      certificateId: certificate[0].id
    }

    return NextResponse.json({
      message: 'Certificate generated successfully',
      certificate: certificate[0],
      content: certificateContent
    })

  } catch (error) {
    console.error('Error generating certificate:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
