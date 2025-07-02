import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/database"
import { revertTimeLogToOriginal, updateTimeLogEditRequest, processContinuousEditRequests } from "@/lib/data-access"

// PUT /api/admin/time-log-edit-requests/[id]
export async function PUT(request: NextRequest) {
  // Extract id from the dynamic route using nextUrl
  const idStr = request.nextUrl.pathname.split("/").pop()
  const id = Number(idStr)
  if (!id) {
    console.error("[INDIVIDUAL EDIT API] Invalid request ID:", idStr)
    return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
  }
  
  try {
    const { action } = await request.json()
    
    console.log(`[INDIVIDUAL EDIT API] Processing individual edit request ${id} with action: ${action}`)
    
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
      console.log(`[INDIVIDUAL EDIT API] Edit request ${id} is a continuous session, delegating to batch handler`)
      // Use the continuous session handler for all actions
      const result = await processContinuousEditRequests([id], action)
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
        const result = await updateTimeLogEditRequest(id, "approve")
        if (!result.success) {
          console.error(`[INDIVIDUAL EDIT API] Failed to approve edit request ${id}:`, result.error)
          return NextResponse.json({ error: result.error }, { status: 500 })
        }
        console.log(`[INDIVIDUAL EDIT API] Successfully approved edit request ${id}`)
      } else if (action === "reject") {
        // Use the centralized rejection logic
        const result = await updateTimeLogEditRequest(id, "reject")
        if (!result.success) {
          console.error(`[INDIVIDUAL EDIT API] Failed to reject edit request ${id}:`, result.error)
          return NextResponse.json({ error: result.error }, { status: 500 })
        }
        console.log(`[INDIVIDUAL EDIT API] Successfully rejected edit request ${id}`)
      } else if (action === "revert") {
        // Use the revert function that properly handles status updates
        const result = await revertTimeLogToOriginal(id)
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
  try {
    const result = await revertTimeLogToOriginal(id)
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to revert time log" }, { status: 500 })
    }
    await sql`
      UPDATE time_log_edit_requests
      SET status = 'pending', reviewed_at = NULL, reviewed_by = NULL
      WHERE id = ${id}
    `
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error reverting time log:", err)
    return NextResponse.json({ error: "Failed to revert time log" }, { status: 500 })
  }
}
