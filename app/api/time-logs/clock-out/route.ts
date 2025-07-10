/**
 * @file API route for intern clock-out.
 * 
 * POST: Clocks out the authenticated intern.
 *       Accepts optional custom time, discardOvertime, and overtimeNote in request body.
 *       Returns 400 for errors, 200 on success.
 */
import { type NextRequest, NextResponse } from "next/server"
import { withAuth, handleApiError } from "@/lib/api-middleware"
import { clockOut } from "@/lib/data-access"

/**
 * Clock-out endpoint for intern time tracking
 */
export async function POST(request: NextRequest) {
  const authResult = await withAuth(request, "intern")
  
  if (!authResult.success) {
    return authResult.response
  }

  try {
    const body = await request.json().catch(() => ({}))
    const customTime = body?.time
    const discardOvertime = body?.discardOvertime
    const overtimeNote = body?.overtimeNote
    // logType is ignored - system automatically splits based on total hours worked
    
    const result = await clockOut(authResult.auth.userId, customTime, discardOvertime, overtimeNote)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
