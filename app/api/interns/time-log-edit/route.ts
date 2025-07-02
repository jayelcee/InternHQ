import { NextRequest, NextResponse } from "next/server"
import { createTimeLogEditRequest, updateTimeLogEditRequest } from "@/lib/data-access"

// POST /api/interns/time-log-edit
export async function POST(request: NextRequest) {
  try {
    const { logId, time_in, time_out, userId, isAdminEdit } = await request.json()
    if (!logId || (!time_in && !time_out) || !userId) {
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
      return NextResponse.json({ error: result.error || "Failed to submit edit request" }, { status: 500 })
    }
    
    // If this is an admin edit, auto-approve it immediately
    if (isAdminEdit && result.editRequestId) {
      const approvalResult = await updateTimeLogEditRequest(result.editRequestId, "approve")
      if (!approvalResult.success) {
        return NextResponse.json({ error: approvalResult.error || "Failed to auto-approve admin edit" }, { status: 500 })
      }
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error submitting edit request:", error)
    return NextResponse.json({ error: "Failed to submit edit request" }, { status: 500 })
  }
}
