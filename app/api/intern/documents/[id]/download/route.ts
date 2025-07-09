import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/api-middleware"
import { sql } from "@/lib/database"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await withAuth(request, "intern")
  
  if (!authResult.success) {
    return authResult.response
  }

  const { auth } = authResult
  const userId = parseInt(auth.userId)
  
  // Await params to fix Next.js 15 requirement
  const resolvedParams = await params

  try {
    const documentId = parseInt(resolvedParams.id)

    // Try to find the document in either DTR or certificate tables
    let document = null
    let documentType = null

    // Check DTR documents
    const dtrDocs = await sql`
      SELECT 
        odd.id,
        odd.document_number,
        odd.total_hours,
        odd.regular_hours,
        odd.overtime_hours,
        odd.period_start,
        odd.period_end,
        odd.admin_signature_name,
        odd.admin_title,
        odd.created_at,
        u.first_name,
        u.last_name,
        up.degree,
        s.name as school_name,
        d.name as department_name,
        ip.required_hours,
        'dtr' as type
      FROM official_dtr_documents odd
      JOIN internship_completion_requests icr ON odd.completion_request_id = icr.id
      JOIN users u ON icr.user_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      JOIN internship_programs ip ON icr.internship_program_id = ip.id
      LEFT JOIN schools s ON ip.school_id = s.id
      LEFT JOIN departments d ON ip.department_id = d.id
      WHERE odd.id = ${documentId} AND icr.user_id = ${userId}
    `

    if (dtrDocs.length > 0) {
      document = dtrDocs[0]
      documentType = 'dtr'
    } else {
      // Check certificate documents
      const certDocs = await sql`
        SELECT 
          cc.id,
          cc.certificate_number as document_number,
          cc.total_hours_completed,
          cc.completion_date,
          cc.admin_signature_name,
          cc.admin_title,
          cc.created_at,
          u.first_name,
          u.last_name,
          up.degree,
          s.name as school_name,
          d.name as department_name,
          ip.required_hours,
          ip.start_date as period_start,
          ip.end_date as period_end,
          'certificate' as type
        FROM completion_certificates cc
        JOIN internship_completion_requests icr ON cc.completion_request_id = icr.id
        JOIN users u ON icr.user_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        JOIN internship_programs ip ON icr.internship_program_id = ip.id
        LEFT JOIN schools s ON ip.school_id = s.id
        LEFT JOIN departments d ON ip.department_id = d.id
        WHERE cc.id = ${documentId} AND icr.user_id = ${userId}
      `
      
      if (certDocs.length > 0) {
        document = certDocs[0]
        documentType = 'certificate'
      }
    }

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Generate PDF content based on document type
    const pdfContent = generatePDFContent(document as DocumentData)
    
    return new NextResponse(pdfContent, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="${documentType}-${document.document_number}.html"`
      }
    })
  } catch (error) {
    console.error('Error downloading document:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

interface DocumentData {
  content: {
    documentNumber?: string
    certificateNumber?: string
    internName: string
    school: string
    department: string
    [key: string]: unknown
  }
  type: string
  [key: string]: unknown
}

function generatePDFContent(document: DocumentData): Buffer {
  // Format the issue date as "6th day of July 2025"
  const formatIssueDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    const day = date.getDate()
    const month = date.toLocaleDateString('en-US', { month: 'long' })
    const year = date.getFullYear()
    
    // Add ordinal suffix to day
    const getDayWithSuffix = (day: number): string => {
      if (day >= 11 && day <= 13) return `${day}th`
      switch (day % 10) {
        case 1: return `${day}st`
        case 2: return `${day}nd`
        case 3: return `${day}rd`
        default: return `${day}th`
      }
    }
    
    return `${getDayWithSuffix(day)} day of ${month} ${year}`
  }

  // Format date in user-friendly format (e.g., "January 15, 2025")
  const formatUserFriendlyDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  // For now, we'll create a simple HTML response that the browser can render
  // In a production environment, you'd want to use a proper PDF generation library
  // like puppeteer, jsPDF, or PDFKit
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${document.type === 'dtr' ? 'Daily Time Record' : 'Certificate of Completion'}</title>
      <style>
        @page { size: letter; margin: 0.75in; }
        body { 
          font-family: Arial, sans-serif; 
          margin: 0;
          padding: 0;
          line-height: 1.6;
        }
        .header { 
          text-align: center; 
          margin-bottom: 30px;
          border-bottom: 2px solid #333;
          padding-bottom: 20px;
        }
        .title { 
          font-size: 24px; 
          font-weight: bold; 
          color: #333;
          margin-bottom: 10px;
        }
        .document-info { 
          margin-bottom: 20px;
          background-color: #f5f5f5;
          padding: 15px;
          border-radius: 5px;
        }
        .signature { 
          margin-top: 50px; 
          text-align: center;
          border-top: 1px solid #ccc;
          padding-top: 20px;
        }
        .signature-line { 
          border-bottom: 1px solid #000; 
          width: 300px; 
          margin: 0 auto 10px;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 20px 0;
        }
        th, td { 
          border: 1px solid #ddd; 
          padding: 8px; 
          text-align: left;
        }
        th { 
          background-color: #f2f2f2;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">
          ${document.type === 'dtr' ? 'Official Daily Time Record' : 'Certificate of Completion'}
        </div>
        <div>InternHQ - Internship Management System</div>
      </div>
      
      <div class="document-info">
        <strong>Document Number:</strong> ${document.document_number}<br>
        <strong>Generated:</strong> ${new Date(document.created_at as string).toLocaleDateString()}<br>
        ${document.type === 'dtr' ? 
          `<strong>Period:</strong> ${document.period_start} to ${document.period_end}<br>
           <strong>Total Hours:</strong> ${document.total_hours}<br>
           <strong>Regular Hours:</strong> ${document.regular_hours}<br>
           <strong>Overtime Hours:</strong> ${document.overtime_hours}` :
          `<strong>Completion Date:</strong> ${new Date(document.completion_date as string).toLocaleDateString()}<br>
           <strong>Total Hours Completed:</strong> ${document.total_hours_completed}`
        }
      </div>
      
      ${document.type === 'certificate' ? 
        `<div style="text-align: center; margin: 0; padding: 60px 40px; height: 100vh; display: flex; flex-direction: column; justify-content: space-between;">
          <div style="flex-shrink: 0;">
            <div style="margin-bottom: 40px; height: 120px; display: flex; align-items: center; justify-content: center;">
              <img src="/cybersoft%20logo.png" alt="Cybersoft Logo" style="max-height: 100px; width: auto;" />
            </div>
            
            <h1 style="font-size: 42px; font-weight: bold; color: #1e40af; margin-bottom: 50px; text-decoration: underline; letter-spacing: 2px;">
              Certificate of Completion
            </h1>
          </div>
          
          <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center;">
            <div style="font-size: 22px; line-height: 2; text-align: justify;">
              <p style="margin-bottom: 24px;">
                This is to certify that <span style="font-size: 32px; font-weight: bold; color: #1e40af; text-decoration: underline; margin: 0 4px;">${document.first_name + ' ' + document.last_name || 'Unknown'}</span>, <strong>${document.degree || 'Unknown'}</strong> student from <strong>${document.school_name || 'Unknown Institution'}</strong>, has satisfactorily completed <strong>${document.required_hours || 0} hours</strong> of On-The-Job Training in this company, and has been assigned to the <strong>${document.department_name || 'Unknown Department'}</strong> Department from <strong>${document.period_start ? formatUserFriendlyDate(String(document.period_start)) : 'Unknown'}</strong> until <strong>${document.period_end ? formatUserFriendlyDate(String(document.period_end)) : 'Unknown'}</strong>.
              </p>
              <p style="margin-bottom: 24px;">
                This certification is issued upon the request of the above mentioned name for whatever legal purpose it may serve them best.
              </p>
              <p style="margin-bottom: 24px;">
                Signed this <strong>${formatIssueDate(new Date().toISOString())}</strong>.
              </p>
            </div>
          </div>
          
          <div style="text-align: left; margin-top: 80px; font-size: 20px; flex-shrink: 0;">
            <div style="font-size: 18px; margin-bottom: 30px; font-weight: bold;">Certified by:</div>
            <div style="font-size: 20px; font-weight: bold; margin-bottom: 5px;">${document.admin_signature_name}</div>
            <div style="font-size: 18px; color: #666;">${document.admin_title}</div>
          </div>
         </div>` : ''
      }
      
      <div class="signature">
        <div class="signature-line"></div>
        <strong>${document.admin_signature_name}</strong><br>
        ${document.admin_title}<br>
        <small>Date: ${new Date().toLocaleDateString()}</small>
      </div>
    </body>
    </html>
  `
  
  return Buffer.from(htmlContent)
}
