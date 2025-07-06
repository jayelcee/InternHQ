/**
 * Centralized service for handling internship completion requests and document generation
 * This service consolidates all completion-related logic to reduce code duplication
 */
import { sql } from "@/lib/database"
import { calculateTimeStatistics } from "@/lib/time-utils"
import { ensureTablesExist, initializeDatabase } from "@/lib/database-init"

export interface CompletionRequestData {
  id: number
  user_id: number
  internship_program_id: number
  total_hours_completed: number
  completion_date: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_at?: string
  reviewed_by?: number
  admin_notes?: string
  required_hours: number
  start_date: string
  end_date: string
  first_name: string
  last_name: string
  email: string
  degree?: string
  school_name?: string
  department_name?: string
}

export interface DocumentContent {
  documentNumber: string
  internName: string
  school: string
  department: string
  periodStart: string
  periodEnd: string
  totalHours: number
  regularHours: number
  overtimeHours: number
  requiredHours: number
  adminSignature: string
  adminTitle: string
  issueDate: string
  documentId: number
}

export interface CertificateContent {
  certificateNumber: string
  internName: string
  degree: string
  school: string
  department: string
  periodStart: string
  periodEnd: string
  completionDate: string
  totalHoursCompleted: number
  requiredHours: number
  adminSignature: string
  adminTitle: string
  issueDate: string
  certificateId: number
}

export interface DocumentRecord {
  id: number
  completion_request_id: number
  document_type: string
  document_path: string
  document_number: string
  generated_at: string
  admin_signature_name: string
  admin_title: string
  issued_by: number
  content: DocumentContent | CertificateContent
}

interface UserCompletionStatus {
  request: {
    id: number
    status: string
    created_at: string
    reviewed_at?: string
    admin_notes?: string
    total_hours_completed: number
    [key: string]: unknown
  } | null
  documents: {
    id: number
    type: string
    document_number: string
    created_at: string
    admin_signature_name: string
    content: DocumentContent | CertificateContent
  }[]
}

export class CompletionService {
  
  /**
   * Gets completion request with all related data
   */
  static async getCompletionRequestById(id: number): Promise<CompletionRequestData | null> {
    const result = await sql`
      SELECT cr.*, 
             ip.required_hours, ip.start_date, ip.end_date,
             u.first_name, u.last_name, u.email,
             up.degree,
             s.name as school_name,
             d.name as department_name
      FROM internship_completion_requests cr
      JOIN internship_programs ip ON cr.internship_program_id = ip.id
      JOIN users u ON cr.user_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN schools s ON ip.school_id = s.id
      LEFT JOIN departments d ON ip.department_id = d.id
      WHERE cr.id = ${id}
    `
    
    return result[0] as CompletionRequestData || null
  }

  /**
   * Gets all completion requests with pagination
   */
  static async getAllCompletionRequests(
    limit: number = 50, 
    offset: number = 0,
    status?: 'pending' | 'approved' | 'rejected'
  ): Promise<CompletionRequestData[]> {
    try {
      console.log('🔍 CompletionService.getAllCompletionRequests called with:', { limit, offset, status })
      
      // Ensure tables exist before querying
      const tablesExist = await ensureTablesExist()
      if (!tablesExist) {
        console.log('📋 Initializing database tables...')
        await initializeDatabase()
      }
      
      const statusFilter = status ? sql`AND cr.status = ${status}` : sql``
      
      console.log('📝 Executing SQL query...')
      const result = await sql`
        SELECT cr.*, 
               ip.required_hours, ip.start_date, ip.end_date,
               u.first_name, u.last_name, u.email,
               up.degree,
               s.name as school_name,
               d.name as department_name,
               reviewer.first_name as reviewer_first_name,
               reviewer.last_name as reviewer_last_name
        FROM internship_completion_requests cr
        JOIN internship_programs ip ON cr.internship_program_id = ip.id
        JOIN users u ON cr.user_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        LEFT JOIN schools s ON ip.school_id = s.id
        LEFT JOIN departments d ON ip.department_id = d.id
        LEFT JOIN users reviewer ON cr.reviewed_by = reviewer.id
        WHERE 1=1 ${statusFilter}
        ORDER BY cr.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      
      console.log('✅ SQL query executed, got', result.length, 'rows')
      
      const formattedResult = result.map(row => ({
        ...row,
        total_hours_completed: Number(row.total_hours_completed),
        required_hours: Number(row.required_hours),
        user_id: Number(row.user_id),
        internship_program_id: Number(row.internship_program_id)
      })) as CompletionRequestData[]
      
      console.log('📊 Formatted result:', formattedResult.length, 'completion requests')
      
      return formattedResult
    } catch (error) {
      console.error('❌ Error in getAllCompletionRequests:', error)
      
      // For any errors, return empty array to prevent crashes
      console.log('🔄 Returning empty array due to error')
      return []
    }
  }

  /**
   * Creates a new completion request
   */
  static async createCompletionRequest(
    userId: number,
    internshipProgramId: number,
    totalHoursCompleted: number
  ): Promise<{ success: boolean; request?: CompletionRequestData; error?: string }> {
    try {
      // Check for existing pending request
      const existingRequest = await sql`
        SELECT id FROM internship_completion_requests 
        WHERE user_id = ${userId} AND status = 'pending'
      `
      
      if (existingRequest.length > 0) {
        return { success: false, error: "A pending completion request already exists" }
      }

      // Create the request
      const request = await sql`
        INSERT INTO internship_completion_requests (
          user_id, internship_program_id, total_hours_completed, completion_date, status
        ) VALUES (
          ${userId}, ${internshipProgramId}, ${totalHoursCompleted}, NOW(), 'pending'
        ) RETURNING *
      `

      // Update internship program status
      try {
        await sql`
          UPDATE internship_programs 
          SET status = 'pending_completion', completion_requested_at = NOW()
          WHERE id = ${internshipProgramId}
        `
      } catch (dbError) {
        console.warn('Could not update internship program status - table may not exist yet:', dbError)
        // Continue anyway - this is not critical for the completion request creation
      }

      return { success: true, request: request[0] as CompletionRequestData }
    } catch (error) {
      console.error('Error creating completion request:', error)
      return { success: false, error: "Failed to create completion request" }
    }
  }

  /**
   * Processes a completion request (approve/reject)
   */
  static async processCompletionRequest(
    requestId: number,
    action: 'approve' | 'reject',
    reviewerId: number,
    adminNotes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const request = await this.getCompletionRequestById(requestId)
      
      if (!request || request.status !== 'pending') {
        return { success: false, error: "Request not found or already processed" }
      }

      if (action === 'approve') {
        // Update completion request
        await sql`
          UPDATE internship_completion_requests 
          SET status = 'approved', reviewed_by = ${reviewerId}, 
              reviewed_at = NOW(), admin_notes = ${adminNotes || null}
          WHERE id = ${requestId}
        `

        // Update internship program
        await sql`
          UPDATE internship_programs 
          SET status = 'completed', completion_approved_at = NOW(),
              completion_approved_by = ${reviewerId}
          WHERE id = ${request.internship_program_id}
        `
      } else {
        // Update completion request
        await sql`
          UPDATE internship_completion_requests 
          SET status = 'rejected', reviewed_by = ${reviewerId}, 
              reviewed_at = NOW(), admin_notes = ${adminNotes || null}
          WHERE id = ${requestId}
        `

        // Reset internship program status
        await sql`
          UPDATE internship_programs 
          SET status = 'active', completion_requested_at = null
          WHERE id = ${request.internship_program_id}
        `
      }

      return { success: true }
    } catch (error) {
      console.error('Error processing completion request:', error)
      return { success: false, error: "Failed to process request" }
    }
  }

  /**
   * Generates DTR document
   */
  static async generateDTRDocument(
    requestId: number,
    adminSignatureName: string,
    adminTitle: string,
    issuedBy: number
  ): Promise<{ success: boolean; document?: DocumentRecord; content?: DocumentContent; error?: string }> {
    try {
      const request = await this.getCompletionRequestById(requestId)
      
      if (!request || request.status !== 'approved') {
        return { success: false, error: "Approved request not found" }
      }

      // Check if DTR already exists
      const existingDTR = await sql`
        SELECT id FROM official_dtr_documents 
        WHERE completion_request_id = ${requestId}
      `
      
      if (existingDTR.length > 0) {
        return { success: false, error: "DTR document already exists" }
      }

      // Get time logs and calculate statistics
      const timeLogsResult = await sql`
        SELECT * FROM time_logs 
        WHERE user_id = ${request.user_id} 
        ORDER BY time_in
      `

      // Transform time logs to the format expected by the document viewer
      const timeLogsDetails = timeLogsResult.map(log => ({
        date: new Date(log.time_in).toISOString().split('T')[0],
        timeIn: new Date(log.time_in).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true 
        }),
        timeOut: log.time_out ? new Date(log.time_out).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true 
        }) : '',
        logType: log.log_type || 'regular',
        status: log.status || 'completed',
        overtimeStatus: log.overtime_status || null
      }))

      const stats = await calculateTimeStatistics(
        timeLogsResult,
        String(request.user_id),
        { includeEditRequests: false, requiredHours: request.required_hours }
      )

      // Generate document number
      const documentNumber = `DTR-${new Date().getFullYear()}-${String(request.user_id).padStart(4, '0')}-${Date.now().toString().slice(-6)}`

      // Create DTR document
      const dtrDocument = await sql`
        INSERT INTO official_dtr_documents 
        (user_id, internship_program_id, completion_request_id, document_number, 
         total_hours, regular_hours, overtime_hours, period_start, period_end,
         issued_by, admin_signature_name, admin_title)
        VALUES (${request.user_id}, ${request.internship_program_id}, ${requestId}, 
                ${documentNumber}, ${stats.internshipProgress}, ${stats.regularHours}, 
                ${stats.overtimeHours.total}, ${request.start_date}, ${request.end_date},
                ${issuedBy}, ${adminSignatureName}, ${adminTitle})
        RETURNING *
      `

      // Generate content
      const content: DocumentContent & { timeLogsDetails: unknown[] } = {
        documentNumber,
        internName: `${request.first_name} ${request.last_name}`,
        school: request.school_name || 'Unknown School',
        department: request.department_name || 'Unknown Department',
        periodStart: request.start_date,
        periodEnd: request.end_date,
        totalHours: stats.internshipProgress,
        regularHours: stats.regularHours,
        overtimeHours: stats.overtimeHours.total,
        requiredHours: request.required_hours,
        adminSignature: adminSignatureName,
        adminTitle: adminTitle,
        issueDate: new Date().toLocaleDateString(),
        documentId: dtrDocument[0].id,
        timeLogsDetails: timeLogsDetails
      }

      return { success: true, document: dtrDocument[0] as DocumentRecord, content }
    } catch (error) {
      console.error('Error generating DTR document:', error)
      return { success: false, error: "Failed to generate DTR document" }
    }
  }

  /**
   * Generates certificate document
   */
  static async generateCertificate(
    requestId: number,
    adminSignatureName: string,
    adminTitle: string,
    issuedBy: number
  ): Promise<{ success: boolean; certificate?: DocumentRecord; content?: CertificateContent; error?: string }> {
    try {
      const request = await this.getCompletionRequestById(requestId)
      
      if (!request || request.status !== 'approved') {
        return { success: false, error: "Approved request not found" }
      }

      // Check if certificate already exists
      const existingCert = await sql`
        SELECT id FROM completion_certificates 
        WHERE completion_request_id = ${requestId}
      `
      
      if (existingCert.length > 0) {
        return { success: false, error: "Certificate already exists" }
      }

      // Generate certificate number
      const certificateNumber = `CERT-${new Date().getFullYear()}-${String(request.user_id).padStart(4, '0')}-${Date.now().toString().slice(-6)}`

      // Create certificate
      const certificate = await sql`
        INSERT INTO completion_certificates 
        (user_id, internship_program_id, completion_request_id, certificate_number, 
         completion_date, total_hours_completed, issued_by, admin_signature_name, admin_title)
        VALUES (${request.user_id}, ${request.internship_program_id}, ${requestId}, 
                ${certificateNumber}, ${request.completion_date}, ${request.total_hours_completed},
                ${issuedBy}, ${adminSignatureName}, ${adminTitle})
        RETURNING *
      `

      // Generate content
      const content: CertificateContent = {
        certificateNumber,
        internName: `${request.first_name} ${request.last_name}`,
        degree: request.degree || 'Unknown Degree',
        school: request.school_name || 'Unknown School',
        department: request.department_name || 'Unknown Department',
        periodStart: request.start_date,
        periodEnd: request.end_date,
        completionDate: request.completion_date,
        totalHoursCompleted: request.total_hours_completed,
        requiredHours: request.required_hours,
        adminSignature: adminSignatureName,
        adminTitle: adminTitle,
        issueDate: new Date().toLocaleDateString(),
        certificateId: certificate[0].id
      }

      return { success: true, certificate: certificate[0] as DocumentRecord, content }
    } catch (error) {
      console.error('Error generating certificate:', error)
      return { success: false, error: "Failed to generate certificate" }
    }
  }

  /**
   * Gets user's completion status including documents
   */
  static async getUserCompletionStatus(userId: number): Promise<UserCompletionStatus> {
    try {
      // Get latest completion request
      const completionRequests = await sql`
        SELECT * FROM internship_completion_requests
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 1
      `

      const completionRequest = completionRequests[0] || null
      const documents = []

      if (completionRequest) {
        // Get user details with degree from user_profiles
        const userDetails = await sql`
          SELECT u.first_name, u.last_name, u.email, up.degree, 
                 ip.*, s.name as school_name, d.name as department_name
          FROM users u
          JOIN internship_programs ip ON u.id = ip.user_id
          LEFT JOIN user_profiles up ON u.id = up.user_id
          LEFT JOIN schools s ON ip.school_id = s.id
          LEFT JOIN departments d ON ip.department_id = d.id
          WHERE u.id = ${userId}
          ORDER BY ip.created_at DESC
          LIMIT 1
        `
        
        const user = userDetails[0]

        // Get DTR documents
        const dtrDocs = await sql`
          SELECT * FROM official_dtr_documents
          WHERE completion_request_id = ${completionRequest.id}
        `

        // Get certificate documents
        const certDocs = await sql`
          SELECT * FROM completion_certificates
          WHERE completion_request_id = ${completionRequest.id}
        `

        // Format documents
        for (const doc of dtrDocs) {
          // Get time logs for this DTR
          const timeLogsForDTR = await sql`
            SELECT * FROM time_logs 
            WHERE user_id = ${userId} 
            ORDER BY time_in
          `

          const timeLogsDetails = timeLogsForDTR.map(log => ({
            date: new Date(log.time_in).toISOString().split('T')[0],
            timeIn: new Date(log.time_in).toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit', 
              hour12: true 
            }),
            timeOut: log.time_out ? new Date(log.time_out).toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit', 
              hour12: true 
            }) : '',
            logType: log.log_type || 'regular',
            status: log.status || 'completed',
            overtimeStatus: log.overtime_status || null
          }))

          documents.push({
            id: doc.id as number,
            type: 'dtr',
            document_number: doc.document_number as string,
            created_at: doc.created_at as string,
            admin_signature_name: doc.admin_signature_name as string,
            content: {
              documentNumber: doc.document_number,
              internName: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
              school: user?.school_name || 'Unknown School',
              department: user?.department_name || 'Unknown Department',
              periodStart: doc.period_start || '',
              periodEnd: doc.period_end || '',
              totalHours: doc.total_hours || 0,
              regularHours: doc.regular_hours || 0,
              overtimeHours: doc.overtime_hours || 0,
              requiredHours: user?.required_hours || 0,
              adminSignature: doc.admin_signature_name,
              adminTitle: doc.admin_title || 'Administrator',
              issueDate: doc.created_at,
              documentId: doc.id,
              timeLogsDetails: timeLogsDetails
            } as DocumentContent & { timeLogsDetails: unknown[] }
          })
        }

        for (const doc of certDocs) {
          documents.push({
            id: doc.id as number,
            type: 'certificate',
            document_number: doc.certificate_number as string,
            created_at: doc.created_at as string,
            admin_signature_name: doc.admin_signature_name as string,
            content: {
              certificateNumber: doc.certificate_number,
              internName: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
              degree: user?.degree || 'Unknown Degree',
              school: user?.school_name || 'Unknown School',
              department: user?.department_name || 'Unknown Department',
              periodStart: doc.period_start || user?.start_date || '',
              periodEnd: doc.period_end || user?.end_date || '',
              completionDate: doc.completion_date || '',
              totalHoursCompleted: doc.total_hours_completed || 0,
              requiredHours: user?.required_hours || 0,
              adminSignature: doc.admin_signature_name,
              adminTitle: doc.admin_title || 'Administrator',
              issueDate: doc.created_at,
              certificateId: doc.id
            } as CertificateContent
          })
        }
      }

      return {
        request: completionRequest ? {
          id: completionRequest.id as number,
          status: completionRequest.status as string,
          created_at: completionRequest.created_at as string,
          reviewed_at: completionRequest.reviewed_at as string,
          admin_notes: completionRequest.admin_notes as string,
          total_hours_completed: parseFloat(completionRequest.total_hours_completed) || 0,
          ...completionRequest
        } : null,
        documents
      }
    } catch (error) {
      console.error('Error getting completion status:', error)
      return { request: null, documents: [] }
    }
  }

  /**
   * Reverts a processed completion request to pending (admin only)
   */
  static async revertCompletionRequest(requestId: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Only allow revert if status is approved or rejected
      const request = await this.getCompletionRequestById(requestId)
      if (!request || (request.status !== 'approved' && request.status !== 'rejected')) {
        return { success: false, error: 'Request not found or not processed' }
      }
      // Set status to pending, clear reviewed_by and reviewed_at
      await sql`
        UPDATE internship_completion_requests
        SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL, admin_notes = NULL
        WHERE id = ${requestId}
      `
      // Optionally reset internship_program status if needed
      await sql`
        UPDATE internship_programs
        SET status = 'active', completion_approved_at = NULL, completion_approved_by = NULL, completion_requested_at = NULL
        WHERE id = ${request.internship_program_id}
      `
      return { success: true }
    } catch (error) {
      console.error('Error reverting completion request:', error)
      return { success: false, error: 'Failed to revert request' }
    }
  }

  /**
   * Deletes a completion request (admin only)
   */
  static async deleteCompletionRequest(requestId: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if request exists
      const request = await this.getCompletionRequestById(requestId)
      if (!request) {
        return { success: false, error: 'Request not found' }
      }
      // Delete the request
      await sql`
        DELETE FROM internship_completion_requests WHERE id = ${requestId}
      `
      // Optionally reset internship_program status if needed
      await sql`
        UPDATE internship_programs
        SET status = 'active', completion_approved_at = NULL, completion_approved_by = NULL, completion_requested_at = NULL
        WHERE id = ${request.internship_program_id}
      `
      return { success: true }
    } catch (error) {
      console.error('Error deleting completion request:', error)
      return { success: false, error: 'Failed to delete request' }
    }
  }
}
