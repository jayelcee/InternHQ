import { NextRequest, NextResponse } from "next/server"
import { createTimeLogEditRequest, updateTimeLogEditRequest } from "@/lib/data-access"

// POST /api/interns/time-log-edit
export async function POST(request: NextRequest) {
  try {
    const { logId, time_in, time_out, userId, isAdminEdit } = await request.json()
    
    console.log(`[INTERN EDIT API] ${isAdminEdit ? 'Admin' : 'Intern'} ${userId} requesting edit for log ${logId}`)
    console.log(`[INTERN EDIT API] Requested changes: ${time_in} - ${time_out}`)
    
    if (!logId || (!time_in && !time_out) || !userId) {
      console.error("[INTERN EDIT API] Missing required fields:", { logId, time_in, time_out, userId })
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    
    // Pass as requestedTimeIn/requestedTimeOut to match DB
    const result = await createTimeLogEditRequest({
      logId,
      requestedBy: userId,
      requestedTimeIn: time_in,
      requestedTimeOut: time_out,
    })
    
    if (!result.success) {
      console.error("[INTERN EDIT API] Failed to create edit request:", result.error)
      return NextResponse.json({ error: result.error || "Failed to submit edit request" }, { status: 500 })
    }
    
    console.log(`[INTERN EDIT API] Successfully created edit request ${result.editRequestId}`)
    
    // If this is an admin edit, auto-approve it immediately with the admin as both requester and reviewer
    if (isAdminEdit && result.editRequestId) {
      console.log(`[INTERN EDIT API] Auto-approving admin edit request ${result.editRequestId} with admin ${userId} as reviewer`)
      // Pass the admin's userId as reviewerId to ensure they are recorded as the approver
      const approvalResult = await updateTimeLogEditRequest(result.editRequestId, "approve", Number(userId))
      if (!approvalResult.success) {
        console.error("[INTERN EDIT API] Failed to auto-approve admin edit:", approvalResult.error)
        return NextResponse.json({ error: approvalResult.error || "Failed to auto-approve admin edit" }, { status: 500 })
      }
      console.log(`[INTERN EDIT API] Successfully auto-approved admin edit request ${result.editRequestId}`)
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error submitting edit request:", error)
    return NextResponse.json({ error: "Failed to submit edit request" }, { status: 500 })
  }
}
