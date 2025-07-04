import { NextRequest, NextResponse } from "next/server"
import { createContinuousSessionEditRequest, processContinuousEditRequests } from "@/lib/data-access"

// POST /api/interns/time-log-edit-session
export async function POST(request: NextRequest) {
  try {
    const { logIds, timeIn, timeOut, userId, isAdminEdit } = await request.json()
    
    console.log(`[CONTINUOUS SESSION API] ${isAdminEdit ? 'Admin' : 'Intern'} ${userId} requesting edit for continuous session`)
    console.log(`[CONTINUOUS SESSION API] Log IDs: ${JSON.stringify(logIds)}`)
    console.log(`[CONTINUOUS SESSION API] Requested time range: ${timeIn} - ${timeOut}`)
    
    if (!logIds || !Array.isArray(logIds) || logIds.length === 0 || !timeIn || !timeOut || !userId) {
      console.error("[CONTINUOUS SESSION API] Missing required fields:", { logIds, timeIn, timeOut, userId })
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const result = await createContinuousSessionEditRequest({
      logIds,
      requestedBy: userId,
      requestedTimeIn: timeIn,
      requestedTimeOut: timeOut,
    })

    if (!result.success) {
      console.error("[CONTINUOUS SESSION API] Failed to create continuous session edit request:", result.error)
      return NextResponse.json({ error: result.error || "Failed to submit edit request" }, { status: 500 })
    }

    console.log(`[CONTINUOUS SESSION API] Successfully created continuous session edit request ${result.editRequestId}`)

    // If this is an admin edit, auto-approve it immediately with the admin as both requester and reviewer
    if (isAdminEdit && result.editRequestId) {
      console.log(`[CONTINUOUS SESSION API] Auto-approving admin continuous session edit ${result.editRequestId} with admin ${userId} as reviewer`)
      // Pass the admin's userId as reviewerId to ensure they are recorded as the approver
      const approvalResult = await processContinuousEditRequests([result.editRequestId], "approve", Number(userId))
      if (!approvalResult.success) {
        console.error("[CONTINUOUS SESSION API] Failed to auto-approve admin continuous session edit:", approvalResult.error)
        return NextResponse.json({ error: approvalResult.error || "Failed to auto-approve admin edit" }, { status: 500 })
      }
      console.log(`[CONTINUOUS SESSION API] Successfully auto-approved admin continuous session edit ${result.editRequestId}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error submitting continuous session edit request:", error)
    return NextResponse.json({ error: "Failed to submit edit request" }, { status: 500 })
  }
}
