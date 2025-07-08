/**
 * @file API route for admin to revert a time log edit request to its original state.
 * 
 * POST: Reverts a single or continuous session edit request by ID.
 *       Requires authentication via 'auth-token' or 'token' cookie.
 *       Returns 400 for invalid ID, 404 if not found, 500 for errors.
 *       On success, returns { success: true }.
 */
import { NextRequest, NextResponse } from "next/server"
import { revertTimeLogToOriginal, processContinuousEditRequests } from "@/lib/data-access"
import { verifyToken } from "@/lib/auth"
import { sql } from "@/lib/database"

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Extract user token from cookies
  const token = request.cookies.get("token")?.value || request.cookies.get("auth-token")?.value
  let currentUserId: number | undefined

  if (token) {
    const verification = await verifyToken(token)
    if (verification.valid && verification.userId) {
      currentUserId = verification.userId
    }
  }

  // Extract the edit request ID from the URL
  const urlParts = request.nextUrl.pathname.split("/").filter(Boolean)
  const idStr = urlParts[urlParts.length - 2]
  const id = Number(idStr)
  if (!id) {
    return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
  }
  try {
    // Fetch edit request metadata
    const editRequestRes = await sql`
      SELECT metadata FROM time_log_edit_requests WHERE id = ${id}
    `
    if (editRequestRes.length === 0) {
      return NextResponse.json({ error: "Edit request not found" }, { status: 404 })
    }
    const metadata = editRequestRes[0].metadata

    let result
    if (metadata && metadata.isContinuousSession) {
      // Handle continuous session edit requests
      result = await processContinuousEditRequests([id], "revert", currentUserId)
    } else {
      // Handle single edit requests
      result = await revertTimeLogToOriginal(id, currentUserId)
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to revert time log" }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch {
    // Gracefully handle unexpected errors
    return NextResponse.json({ error: "Failed to revert time log" }, { status: 500 })
  }
}
