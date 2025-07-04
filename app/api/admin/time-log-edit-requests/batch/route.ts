import { NextRequest, NextResponse } from "next/server"
import { processContinuousEditRequests } from "@/lib/data-access"
import { verifyToken } from "@/lib/auth"

/**
 * API Route: POST /api/admin/time-log-edit-requests/batch
 * Processes batch actions (approve, reject, revert) for continuous session edit requests.
 * Requires authentication via token in cookies.
 */
export async function POST(request: NextRequest) {
  try {
    // Extract user token from cookies
    const token = request.cookies.get("token")?.value
    let currentUserId: number | undefined
    if (token) {
      const verification = await verifyToken(token)
      if (verification.valid && verification.userId) {
        currentUserId = verification.userId
      }
    }

    const { requestIds, action } = await request.json()

    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return NextResponse.json({ error: "Invalid request IDs" }, { status: 400 })
    }

    if (!["approve", "reject", "revert"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const result = await processContinuousEditRequests(requestIds, action, currentUserId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    // Log only essential error information
    console.error("Error processing batch edit requests:", err)
    return NextResponse.json({ error: "Failed to process batch edit requests" }, { status: 500 })
  }
}
