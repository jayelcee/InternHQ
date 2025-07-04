import { NextRequest, NextResponse } from "next/server"
import { revertTimeLogToOriginal, processContinuousEditRequests } from "@/lib/data-access"
import { verifyToken } from "@/lib/auth"
import { sql } from "@/lib/database"

export const dynamic = "force-dynamic";

// Use the new Next.js 13+ convention for dynamic route params
export async function POST(request: NextRequest) {
  // Get current user from token - check both token names
  const token = request.cookies.get("token")?.value || request.cookies.get("auth-token")?.value
  let currentUserId: number | undefined
  
  console.log(`[REVERT API] Token from cookie:`, token ? "Token exists" : "No token")
  
  if (token) {
    const verification = await verifyToken(token)
    console.log(`[REVERT API] Token verification:`, JSON.stringify(verification))
    
    if (verification.valid && verification.userId) {
      currentUserId = verification.userId
      console.log(`[REVERT API] Current user ID set to:`, currentUserId)
    } else {
      console.log(`[REVERT API] Invalid token or missing userId`)
    }
  } else {
    console.log(`[REVERT API] No token found in request cookies`)
  }

  // The id param is in the pathname, extract it
  const urlParts = request.nextUrl.pathname.split("/").filter(Boolean)
  const idStr = urlParts[urlParts.length - 2]
  const id = Number(idStr)
  if (!id) {
    return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
  }
  try {
    // First check if this is a continuous session edit request
    const editRequestRes = await sql`
      SELECT metadata FROM time_log_edit_requests WHERE id = ${id}
    `
    
    if (editRequestRes.length === 0) {
      return NextResponse.json({ error: "Edit request not found" }, { status: 404 })
    }
    
    const metadata = editRequestRes[0].metadata
    
    let result
    if (metadata && metadata.isContinuousSession) {
      console.log(`[REVERT API] Processing continuous session edit request ${id}`)
      // For continuous sessions, use the batch processing function
      result = await processContinuousEditRequests([id], "revert", currentUserId)
    } else {
      console.log(`[REVERT API] Processing single edit request ${id}`)
      // For single edit requests, use the original function
      result = await revertTimeLogToOriginal(id, currentUserId)
    }
    
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to revert time log" }, { status: 500 })
    }
    // Status update is handled by the revert functions
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error reverting time log edit request:", err)
    return NextResponse.json({ error: "Failed to revert time log" }, { status: 500 })
  }
}
