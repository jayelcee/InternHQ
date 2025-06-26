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
    const logType = body?.logType === "overtime" ? "overtime" : "regular"

    const result = await clockOut(authResult.auth.userId, customTime, logType)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, "Clock out")
  }
}
