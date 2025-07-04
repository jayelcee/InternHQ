import { NextRequest, NextResponse } from "next/server"
import { processContinuousEditRequests } from "@/lib/data-access"
import { verifyToken } from "@/lib/auth"

// POST /api/admin/time-log-edit-requests/batch
export async function POST(request: NextRequest) {
  try {
    // Get current user from token
    const token = request.cookies.get("token")?.value
    let currentUserId: number | undefined
    if (token) {
      const verification = await verifyToken(token)
      if (verification.valid && verification.userId) {
        currentUserId = verification.userId
      }
    }

    const { requestIds, action } = await request.json()
    
    console.log(`[BATCH API] Processing batch edit requests: action=${action}, requestIds=${JSON.stringify(requestIds)}`)
    
    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      console.error("[BATCH API] Invalid request IDs:", requestIds)
      return NextResponse.json({ error: "Invalid request IDs" }, { status: 400 })
    }
    
    if (!["approve", "reject", "revert"].includes(action)) {
      console.error("[BATCH API] Invalid action:", action)
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
    
    const result = await processContinuousEditRequests(requestIds, action, currentUserId)
    
    if (!result.success) {
      console.error(`[BATCH API] Batch processing failed: ${result.error}`)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    
    console.log(`[BATCH API] Batch processing succeeded for action=${action}`)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[BATCH API] Error processing batch edit requests:", err)
    return NextResponse.json({ error: "Failed to process batch edit requests" }, { status: 500 })
  }
}
