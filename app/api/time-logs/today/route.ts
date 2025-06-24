import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { getTodayTimeLog } from "@/lib/data-access"

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)

    if (!valid || !userId || role !== "intern") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const logTypeParam = request.nextUrl.searchParams.get("logType")
    const logType = logTypeParam === "overtime" ? "overtime" : "regular"

    const timeLog = await getTodayTimeLog(String(userId), logType)

    return NextResponse.json({ timeLog })
  } catch (error) {
    console.error("Error fetching today time log:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
