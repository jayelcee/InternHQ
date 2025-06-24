import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { clockIn } from "@/lib/data-access"

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { valid, userId, role } = await verifyToken(token)
    if (!valid || !userId || role !== "intern") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const customTime = body?.time
    const logType = body?.logType === "overtime" ? "overtime" : "regular"

    const result = await clockIn(String(userId), customTime, logType)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Clock in error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
