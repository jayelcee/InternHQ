import { NextResponse } from "next/server"

/**
 * Admin continuous session editing has been moved to the edit request system for consistency.
 * Admin edits now go through /api/interns/time-log-edit-session with isAdminEdit=true for auto-approval.
 * This ensures both admin and intern edits use the exact same logic.
 */
export async function PUT() {
  return NextResponse.json({ 
    error: "Admin continuous session editing has been moved to the edit request system. Use /api/interns/time-log-edit-session with isAdminEdit=true." 
  }, { status: 410 })
}
