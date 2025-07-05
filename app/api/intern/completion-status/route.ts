import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/api-middleware"
import { sql } from "@/lib/database"

export async function GET(request: NextRequest) {
  const authResult = await withAuth(request, "intern")
  
  if (!authResult.success) {
    return authResult.response
  }

  const { auth } = authResult
  const userId = parseInt(auth.userId)

  try {
    // Get completion request
    const completionRequests = await sql`
      SELECT * FROM internship_completion_requests
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 1
    `

    const completionRequest = completionRequests[0] || null

    // Get generated documents
    const documents = []
    if (completionRequest) {
      // Get user details for document formatting
      const userDetails = await sql`
        SELECT u.first_name, u.last_name, ip.*, s.name as school_name, d.name as department_name
        FROM users u
        JOIN internship_programs ip ON u.id = ip.user_id
        LEFT JOIN schools s ON ip.school_id = s.id
        LEFT JOIN departments d ON ip.department_id = d.id
        WHERE u.id = ${userId}
      `
      
      const user = userDetails[0]
      
      // Get DTR documents
      const dtrDocs = await sql`
        SELECT 
          id,
          document_number,
          created_at,
          admin_signature_name,
          admin_title,
          file_path as document_path,
          total_hours,
          regular_hours,
          overtime_hours,
          period_start,
          period_end
        FROM official_dtr_documents
        WHERE completion_request_id = ${completionRequest.id}
        ORDER BY created_at DESC
      `
      
      // Get certificate documents
      const certDocs = await sql`
        SELECT 
          id,
          certificate_number as document_number,
          created_at,
          admin_signature_name,
          admin_title,
          file_path as document_path,
          total_hours_completed,
          completion_date
        FROM completion_certificates
        WHERE completion_request_id = ${completionRequest.id}
        ORDER BY created_at DESC
      `
      
      // Format DTR documents
      for (const doc of dtrDocs) {
        // Get the actual time logs for this completion request period
        let timeLogs = await sql`
          SELECT 
            tl.time_in,
            tl.time_out,
            tl.log_type,
            tl.status,
            tl.overtime_status,
            DATE(tl.time_in) as log_date
          FROM time_logs tl
          WHERE tl.user_id = ${userId}
          AND tl.time_in >= ${doc.period_start}
          AND tl.time_in <= ${doc.period_end}
          AND tl.status = 'completed'
          AND tl.time_out IS NOT NULL
          ORDER BY tl.time_in ASC
        `

        // If no logs found with the document period, get all completed logs for the user
        if (timeLogs.length === 0) {
          timeLogs = await sql`
            SELECT 
              tl.time_in,
              tl.time_out,
              tl.log_type,
              tl.status,
              tl.overtime_status,
              DATE(tl.time_in) as log_date
            FROM time_logs tl
            WHERE tl.user_id = ${userId}
            AND tl.status = 'completed'
            AND tl.time_out IS NOT NULL
            ORDER BY tl.time_in ASC
          `
        }

        // Format time logs for the DTR
        const timeLogsDetails = timeLogs.map(log => ({
          date: log.log_date,
          timeIn: new Date(log.time_in).toLocaleTimeString('en-US', { 
            hour12: true, 
            hour: 'numeric', 
            minute: '2-digit' 
          }),
          timeOut: new Date(log.time_out).toLocaleTimeString('en-US', { 
            hour12: true, 
            hour: 'numeric', 
            minute: '2-digit' 
          }),
          logType: log.log_type,
          status: log.status,
          overtimeStatus: log.overtime_status
        }))

        documents.push({
          id: doc.id,
          type: 'dtr',
          document_number: doc.document_number,
          created_at: doc.created_at,
          admin_signature_name: doc.admin_signature_name,
          document_path: doc.document_path,
          content: {
            documentNumber: doc.document_number,
            internName: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
            school: user?.school_name || 'Unknown School',
            department: user?.department_name || 'Unknown Department',
            periodStart: doc.period_start,
            periodEnd: doc.period_end,
            totalHours: parseFloat(doc.total_hours) || 0,
            regularHours: parseFloat(doc.regular_hours) || 0,
            overtimeHours: parseFloat(doc.overtime_hours) || 0,
            requiredHours: user?.required_hours || 0,
            timeLogsDetails: timeLogsDetails,
            adminSignature: doc.admin_signature_name,
            adminTitle: doc.admin_title,
            issueDate: doc.created_at,
            documentId: doc.id
          }
        })
      }
      
      // Format certificate documents
      for (const doc of certDocs) {
        documents.push({
          id: doc.id,
          type: 'certificate',
          document_number: doc.document_number,
          created_at: doc.created_at,
          admin_signature_name: doc.admin_signature_name,
          document_path: doc.document_path,
          content: {
            certificateNumber: doc.document_number,
            internName: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
            school: user?.school_name || 'Unknown School',
            department: user?.department_name || 'Unknown Department',
            periodStart: user?.start_date || '',
            periodEnd: user?.end_date || '',
            completionDate: doc.completion_date,
            totalHoursCompleted: parseFloat(doc.total_hours_completed) || 0,
            requiredHours: user?.required_hours || 0,
            adminSignature: doc.admin_signature_name,
            adminTitle: doc.admin_title,
            issueDate: doc.created_at,
            certificateId: doc.id
          }
        })
      }
    }

    return NextResponse.json({
      request: completionRequest ? {
        ...completionRequest,
        total_hours_completed: parseFloat(completionRequest.total_hours_completed) || 0
      } : null,
      documents: documents
    })
  } catch (error) {
    console.error('Error fetching completion status:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
