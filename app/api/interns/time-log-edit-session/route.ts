import { NextRequest, NextResponse } from "next/server"
import { createContinuousSessionEditRequest, processContinuousEditRequests } from "@/lib/data-access"

// POST /api/interns/time-log-edit-session
export async function POST(request: NextRequest) {
  try {
    const { logIds, timeIn, timeOut, userId, isAdminEdit } = await request.json()
    
    if (!logIds || !Array.isArray(logIds) || logIds.length === 0 || !timeIn || !timeOut || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const result = await createContinuousSessionEditRequest({
      logIds,
      requestedBy: userId,
      requestedTimeIn: timeIn,
      requestedTimeOut: timeOut,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to submit edit request" }, { status: 500 })
    }

    // If this is an admin edit, auto-approve it immediately
    if (isAdminEdit && result.editRequestId) {
      const approvalResult = await processContinuousEditRequests([result.editRequestId], "approve")
      if (!approvalResult.success) {
        return NextResponse.json({ error: approvalResult.error || "Failed to auto-approve admin edit" }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error submitting continuous session edit request:", error)
    return NextResponse.json({ error: "Failed to submit edit request" }, { status: 500 })
  }
}
