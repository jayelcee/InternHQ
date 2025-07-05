import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/api-middleware"
import { sql } from "@/lib/database"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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
        'dtr' as type
      FROM official_dtr_documents odd
      JOIN internship_completion_requests icr ON odd.completion_request_id = icr.id
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
          'certificate' as type
        FROM completion_certificates cc
        JOIN internship_completion_requests icr ON cc.completion_request_id = icr.id
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
    const pdfContent = generatePDFContent(document)
    
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

function generatePDFContent(document: any): Buffer {
  // For now, we'll create a simple HTML response that the browser can render
  // In a production environment, you'd want to use a proper PDF generation library
  // like puppeteer, jsPDF, or PDFKit
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${document.type === 'dtr' ? 'Daily Time Record' : 'Certificate of Completion'}</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 20px; 
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
        <strong>Generated:</strong> ${new Date(document.created_at).toLocaleDateString()}<br>
        ${document.type === 'dtr' ? 
          `<strong>Period:</strong> ${document.period_start} to ${document.period_end}<br>
           <strong>Total Hours:</strong> ${document.total_hours}<br>
           <strong>Regular Hours:</strong> ${document.regular_hours}<br>
           <strong>Overtime Hours:</strong> ${document.overtime_hours}` :
          `<strong>Completion Date:</strong> ${new Date(document.completion_date).toLocaleDateString()}<br>
           <strong>Total Hours Completed:</strong> ${document.total_hours_completed}`
        }
      </div>
      
      ${document.type === 'certificate' ? 
        `<div style="text-align: center; margin: 40px 0;">
          <h2>This is to certify that the above-mentioned intern has successfully completed their internship program.</h2>
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
