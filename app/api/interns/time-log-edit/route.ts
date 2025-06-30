import { NextRequest, NextResponse } from "next/server"
import { createTimeLogEditRequest } from "@/lib/data-access"

// POST /api/interns/time-log-edit
export async function POST(request: NextRequest) {
  try {
    const { logId, time_in, time_out, userId } = await request.json()
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
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error submitting edit request:", error)
    return NextResponse.json({ error: "Failed to submit edit request" }, { status: 500 })
  }
}
