/**
 * @file API route for submitting continuous session time log edit requests.
 * 
 * POST: Submits a continuous session edit request for intern time logs.
 *       If isAdminEdit is true, the edit is auto-approved.
 *       Request body:
 *         - logIds: number[] (required)
 *         - timeIn: string (required)
 *         - timeOut: string (required)
 *         - userId: string | number (required)
 *         - isAdminEdit: boolean (optional)
 *       Returns 400 for missing fields, 500 for errors.
 *       On success, returns { success: true }.
 */
import { NextRequest, NextResponse } from "next/server"
import { createContinuousSessionEditRequest, processContinuousEditRequests } from "@/lib/data-access"

export async function POST(request: NextRequest) {
  try {
    const { logIds, timeIn, timeOut, userId, isAdminEdit } = await request.json()

    // Validate required fields
    if (!logIds || !Array.isArray(logIds) || logIds.length === 0 || !timeIn || !timeOut || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Create edit request
    const result = await createContinuousSessionEditRequest({
      logIds,
      requestedBy: userId,
      requestedTimeIn: timeIn,
      requestedTimeOut: timeOut,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to submit edit request" }, { status: 500 })
    }

    // Auto-approve if admin edit
    if (isAdminEdit && result.editRequestId) {
      const approvalResult = await processContinuousEditRequests([result.editRequestId], "approve", Number(userId))
      if (!approvalResult.success) {
        return NextResponse.json({ error: approvalResult.error || "Failed to auto-approve admin edit" }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    // Gracefully handle unexpected errors
    return NextResponse.json({ error: "Failed to submit edit request" }, { status: 500 })
  }
}
