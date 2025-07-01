import { NextRequest, NextResponse } from "next/server"
import { processContinuousEditRequests } from "@/lib/data-access"

// POST /api/admin/time-log-edit-requests/batch
export async function POST(request: NextRequest) {
  try {
    const { requestIds, action } = await request.json()
    
    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return NextResponse.json({ error: "Invalid request IDs" }, { status: 400 })
    }
    
    if (!["approve", "reject", "revert"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
    
    const result = await processContinuousEditRequests(requestIds, action)
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error processing batch edit requests:", err)
    return NextResponse.json({ error: "Failed to process batch edit requests" }, { status: 500 })
  }
}
