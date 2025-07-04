import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/database"
import { revertTimeLogToOriginal, updateTimeLogEditRequest, processContinuousEditRequests } from "@/lib/data-access"
import { verifyToken } from "@/lib/auth"

// PUT /api/admin/time-log-edit-requests/[id]
export async function PUT(request: NextRequest) {
  // Get current user from token - FIXED: Need to check both "token" and "auth-token" cookies
  const token = request.cookies.get("token")?.value || request.cookies.get("auth-token")?.value
  let currentUserId: number | undefined
  
  console.log(`[INDIVIDUAL EDIT API] Token from cookie:`, token ? "Token exists" : "No token")
  
  if (token) {
    const verification = await verifyToken(token)
    console.log(`[INDIVIDUAL EDIT API] Token verification:`, JSON.stringify(verification))
    
    if (verification.valid && verification.userId) {
      currentUserId = verification.userId
      console.log(`[INDIVIDUAL EDIT API] Current user ID set to:`, currentUserId)
    } else {
      console.log(`[INDIVIDUAL EDIT API] Invalid token or missing userId`)
    }
  } else {
    console.log(`[INDIVIDUAL EDIT API] No token found in request cookies`)
  }
  // Extract id from the dynamic route using nextUrl
  const idStr = request.nextUrl.pathname.split("/").pop()
  const id = Number(idStr)
  if (!id) {
    console.error("[INDIVIDUAL EDIT API] Invalid request ID:", idStr)
    return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
  }
  
  try {
    const { action } = await request.json()
    
    console.log(`[INDIVIDUAL EDIT API] Processing individual edit request ${id} with action: ${action}, reviewerId: ${currentUserId}`)
    
    if (!["approve", "reject", "revert"].includes(action)) {
      console.error("[INDIVIDUAL EDIT API] Invalid action:", action)
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
    
    // Fetch the edit request to check if it's a continuous session
    const reqRows = await sql`
      SELECT * FROM time_log_edit_requests WHERE id = ${id}
    `
    if (reqRows.length === 0) {
      console.error(`[INDIVIDUAL EDIT API] Edit request ${id} not found`)
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }
    
    const editReq = reqRows[0]
    
    // Check if this is a continuous session edit request
    if (editReq.metadata && editReq.metadata.isContinuousSession) {
      console.log(`[INDIVIDUAL EDIT API] Edit request ${id} is a continuous session, delegating to batch handler with reviewerId: ${currentUserId}`)
      // Use the continuous session handler for all actions
      const result = await processContinuousEditRequests([id], action, currentUserId)
      if (!result.success) {
        console.error(`[INDIVIDUAL EDIT API] Failed to process continuous session ${id}:`, result.error)
        return NextResponse.json({ error: result.error }, { status: 500 })
      }
      console.log(`[INDIVIDUAL EDIT API] Successfully processed continuous session ${id}`)
    } else {
      console.log(`[INDIVIDUAL EDIT API] Edit request ${id} is individual, using single edit handlers`)
      // Handle individual/legacy edit requests
      if (action === "approve") {
        // Use the centralized approval logic that handles splitting and overtime properly
        console.log(`[INDIVIDUAL EDIT API] Approving edit request ${id} with reviewer ID: ${currentUserId}`)
        const result = await updateTimeLogEditRequest(id, "approve", currentUserId)
        if (!result.success) {
          console.error(`[INDIVIDUAL EDIT API] Failed to approve edit request ${id}:`, result.error)
          return NextResponse.json({ error: result.error }, { status: 500 })
        }
        console.log(`[INDIVIDUAL EDIT API] Successfully approved edit request ${id}`)
      } else if (action === "reject") {
        // Use the centralized rejection logic
        console.log(`[INDIVIDUAL EDIT API] Rejecting edit request ${id} with reviewer ID: ${currentUserId}`)
        const result = await updateTimeLogEditRequest(id, "reject", currentUserId)
        if (!result.success) {
          console.error(`[INDIVIDUAL EDIT API] Failed to reject edit request ${id}:`, result.error)
          return NextResponse.json({ error: result.error }, { status: 500 })
        }
        console.log(`[INDIVIDUAL EDIT API] Successfully rejected edit request ${id}`)
      } else if (action === "revert") {
        // Use the revert function that properly handles status updates
        console.log(`[INDIVIDUAL EDIT API] Reverting individual edit request ${id}`)
        const result = await revertTimeLogToOriginal(id, currentUserId)
        if (!result.success) {
          console.error(`[INDIVIDUAL EDIT API] Failed to revert edit request ${id}:`, result.error)
          return NextResponse.json({ error: result.error }, { status: 500 })
        }
        console.log(`[INDIVIDUAL EDIT API] Successfully reverted edit request ${id}`)
      }
    }
    
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(`[INDIVIDUAL EDIT API] Error updating request ${id}:`, err)
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 })
  }
}

// --- Add this at the end of the file to support /api/admin/time-log-edit-requests/[id]/revert ---

export const dynamic = "force-dynamic"; // Ensure Next.js treats both PUT and POST as valid

// This POST handler will only respond to /api/admin/time-log-edit-requests/[id]/revert
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
    // Status update is handled by revertTimeLogToOriginal function
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error reverting time log:", err)
    return NextResponse.json({ error: "Failed to revert time log" }, { status: 500 })
  }
}

// DELETE /api/admin/time-log-edit-requests/[id]
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
  } catch (err) {
    console.error("Error deleting edit request:", err)
    return NextResponse.json({ error: "Failed to delete edit request" }, { status: 500 })
  }
}
