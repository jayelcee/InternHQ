import { NextRequest, NextResponse } from "next/server"
import { createTimeLogEditRequest, updateTimeLogEditRequest } from "@/lib/data-access"

/**
 * Handles POST requests to /api/interns/time-log-edit.
 * Allows interns or admins to request edits to a time log.
 * If isAdminEdit is true, the edit is auto-approved.
 * 
 * Request body:
 * - logId: string | number (required)
 * - time_in: string (optional)
 * - time_out: string (optional)
 * - userId: string | number (required)
 * - isAdminEdit: boolean (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const { logId, time_in, time_out, userId, isAdminEdit } = await request.json()
    
    if (!logId || (!time_in && !time_out) || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    
    const result = await createTimeLogEditRequest({
      logId,
      requestedBy: userId,
      requestedTimeIn: time_in,
      requestedTimeOut: time_out,
    })
    
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to submit edit request" }, { status: 500 })
    }
    
    // If this is an admin edit, auto-approve it immediately with the admin as both requester and reviewer
    if (isAdminEdit && result.editRequestId) {
      // Pass the admin's userId as reviewerId to ensure they are recorded as the approver
      const approvalResult = await updateTimeLogEditRequest(result.editRequestId, "approve", Number(userId))
      if (!approvalResult.success) {
        return NextResponse.json({ error: approvalResult.error || "Failed to auto-approve admin edit" }, { status: 500 })
      }
    }
    
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to submit edit request" }, { status: 500 })
  }
}
