/**
 * @file API route for intern clock-in.
 * 
 * POST: Clocks in the authenticated intern.
 *       Accepts optional custom time in request body.
 *       Returns 400 for errors, 200 on success.
 */
import { type NextRequest, NextResponse } from "next/server"
import { withAuth, handleApiError } from "@/lib/api-middleware"
import { clockIn } from "@/lib/data-access"

/**
 * Clock-in endpoint for intern time tracking
 */
export async function POST(request: NextRequest) {
  const authResult = await withAuth(request, "intern")
  
  if (!authResult.success) {
    return authResult.response
  }

  try {
    const body = await request.json().catch(() => ({}))
    const customTime = body?.time

    const result = await clockIn(authResult.auth.userId, customTime)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, "Clock in")
  }
}
