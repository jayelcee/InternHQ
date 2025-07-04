import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/database"
import { revertTimeLogToOriginal, updateTimeLogEditRequest, processContinuousEditRequests } from "@/lib/data-access"
import { verifyToken } from "@/lib/auth"

/**
 * PUT /api/admin/time-log-edit-requests/[id]
 * Handles approval, rejection, or revert of a single or continuous time log edit request.
 * Requires reviewer authentication via token.
 * 
 * Request body: { action: "approve" | "reject" | "revert" }
 */
export async function PUT(request: NextRequest) {
  // Get current user from token (supports both "token" and "auth-token" cookies)
  const token = request.cookies.get("token")?.value || request.cookies.get("auth-token")?.value
  let currentUserId: number | undefined

  if (token) {
    const verification = await verifyToken(token)
    if (verification.valid && verification.userId) {
      currentUserId = verification.userId
    }
  }

  // Extract id from the dynamic route using nextUrl
  const idStr = request.nextUrl.pathname.split("/").pop()
  const id = Number(idStr)
  if (!id) {
    return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
  }
  
  try {
    const { action } = await request.json()
    if (!["approve", "reject", "revert"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
    // Fetch the edit request to check if it's a continuous session
    const reqRows = await sql`
      SELECT * FROM time_log_edit_requests WHERE id = ${id}
    `
    if (reqRows.length === 0) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }
    const editReq = reqRows[0]
    // Handle continuous session edit requests
    if (editReq.metadata && editReq.metadata.isContinuousSession) {
      const result = await processContinuousEditRequests([id], action, currentUserId)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }
    } else {
      // Handle individual/legacy edit requests
      if (action === "approve" || action === "reject") {
        const result = await updateTimeLogEditRequest(id, action, currentUserId)
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 500 })
        }
      } else if (action === "revert") {
        const result = await revertTimeLogToOriginal(id, currentUserId)
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 500 })
        }
      }
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 })
  }
}

export const dynamic = "force-dynamic"; // Ensure Next.js treats both PUT and POST as valid

/**
 * POST /api/admin/time-log-edit-requests/[id]/revert
 * Reverts a time log edit request to its original state.
 * Requires reviewer authentication via token.
 */
export async function POST(request: NextRequest) {
  // Check if the path ends with /revert
  const url = request.nextUrl.pathname
  if (!url.endsWith("/revert")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  // Extract the id from the path (second to last segment)
  const urlParts = url.split("/").filter(Boolean)
  const idStr = urlParts[urlParts.length - 2]
  const id = Number(idStr)
  if (!id) {
    return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
  }
  // Get current user from token for reviewer ID
  const token = request.cookies.get("token")?.value || request.cookies.get("auth-token")?.value
  let reviewerId: number | undefined
  if (token) {
    const verification = await verifyToken(token)
    if (verification.valid && verification.userId) {
      reviewerId = verification.userId
    }
  }
  try {
    const result = await revertTimeLogToOriginal(id, reviewerId)
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to revert time log" }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to revert time log" }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/time-log-edit-requests/[id]
 * Deletes a time log edit request.
 * Requires authentication via token.
 */
export async function DELETE(request: NextRequest) {
  // Get current user from token - check both token names
  const token = request.cookies.get("token")?.value || request.cookies.get("auth-token")?.value
  if (token) {
    const verification = await verifyToken(token)
    if (!verification.valid || !verification.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  } else {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // Extract id from the dynamic route using nextUrl
  const idStr = request.nextUrl.pathname.split("/").pop()
  const id = Number(idStr)
  if (!id) {
    return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
  }
  try {
    // Delete the edit request
    const result = await sql`
      DELETE FROM time_log_edit_requests WHERE id = ${id}
      RETURNING id
    `
    if (result.length === 0) {
      return NextResponse.json({ error: "Request not found or already deleted" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete edit request" }, { status: 500 })
  }
}
