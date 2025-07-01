import { NextRequest, NextResponse } from "next/server"
import { createContinuousSessionEditRequest } from "@/lib/data-access"

// POST /api/interns/time-log-edit-session
export async function POST(request: NextRequest) {
  try {
    const { logIds, timeIn, timeOut, userId } = await request.json()
    
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error submitting continuous session edit request:", error)
    return NextResponse.json({ error: "Failed to submit edit request" }, { status: 500 })
  }
}
