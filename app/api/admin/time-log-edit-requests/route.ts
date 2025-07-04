import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/database"

// GET /api/admin/time-log-edit-requests
export async function GET(request: NextRequest) {
  // Log the token to debug auth issues
  console.log(`[EDIT REQUESTS LIST] auth-token:`, request.cookies.get("auth-token")?.value ? "exists" : "missing")
  console.log(`[EDIT REQUESTS LIST] token:`, request.cookies.get("token")?.value ? "exists" : "missing")
  
  // Fetch edit requests with user whose log is being adjusted, requester info, and reviewer info
  try {
    console.log("[EDIT REQUESTS API] Fetching all time log edit requests")
    
    // First get raw data about the reviewed_by field to debug
    const reviewerData = await sql`
      SELECT id, status, reviewed_by, reviewed_at 
      FROM time_log_edit_requests 
      WHERE status != 'pending'
      ORDER BY created_at DESC LIMIT 10
    `
    console.log("[EDIT REQUESTS API] Sample reviewed_by data:", JSON.stringify(reviewerData))
    
    const requests = await sql`
      SELECT 
        r.id, 
        r.log_id as "logId", 
        r.reviewed_by as "raw_reviewed_by", -- For debugging
        -- User whose log is being adjusted (from time_logs.user_id)
        log_owner.first_name || ' ' || log_owner.last_name as "internName",
        log_owner.role as "userRole",
        -- Requester information
        requester.id as "requestedById", -- Add requester ID
        requester.first_name || ' ' || requester.last_name as "requestedBy",
        requester.role as "requesterRole",
        -- Reviewer information
        r.reviewed_by as "reviewedById", -- Add reviewer ID
        reviewer.first_name || ' ' || reviewer.last_name as "reviewedBy",
        r.reviewed_at as "reviewedAt",
        -- Request details
        r.requested_time_in as "requestedTimeIn", 
        r.requested_time_out as "requestedTimeOut",
        r.original_time_in as "originalTimeIn", 
        r.original_time_out as "originalTimeOut",
        r.status, 
        r.created_at as "requestedAt"
      FROM time_log_edit_requests r
      JOIN time_logs t ON r.log_id = t.id
      JOIN users log_owner ON t.user_id = log_owner.id  -- User whose log is being adjusted
      JOIN users requester ON r.requested_by = requester.id  -- User who made the request
      LEFT JOIN users reviewer ON r.reviewed_by = reviewer.id  -- User who reviewed the request
      ORDER BY r.created_at DESC
    `
    
    // Log a few entries to see what's happening with reviewedBy
    console.log("[EDIT REQUESTS API] First few results:", requests.slice(0, 3).map(r => ({
      id: r.id,
      status: r.status,
      userRole: r.userRole,
      requestedById: r.requestedById,
      requestedBy: r.requestedBy,
      reviewedById: r.reviewedById,
      raw_reviewed_by: r.raw_reviewed_by,
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt
    })))
    
    return NextResponse.json(requests)
  } catch (err) {
    console.error("Error fetching edit requests:", err)
    return NextResponse.json({ error: "Failed to fetch edit requests" }, { status: 500 })
  }
}
