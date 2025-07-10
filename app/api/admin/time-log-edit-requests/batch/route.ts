/**
 * @file API route for admin to process batch actions on continuous session edit requests.
 * 
 * POST: Processes batch approve, reject, or revert actions for given request IDs.
 *       Requires authentication via 'token' cookie.
 *       Expects JSON body: { requestIds: number[], action: "approve" | "reject" | "revert" }
 *       Returns 400 for invalid input, 500 for errors.
 *       On success, returns { success: true }.
 */
import { NextRequest, NextResponse } from "next/server"
import { processContinuousEditRequests } from "@/lib/data-access"
import { verifyToken } from "@/lib/auth"

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
  } catch {
    // Gracefully handle unexpected errors
    return NextResponse.json({ error: "Failed to process batch edit requests" }, { status: 500 })
  }
}
