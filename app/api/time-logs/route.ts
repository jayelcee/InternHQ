import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { getTimeLogsForUser, getAllTimeLogsWithDetails } from "@/lib/data-access"

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)

    if (!valid || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const logTypeParam = request.nextUrl.searchParams.get("logType")
    const logType = logTypeParam === "overtime" ? "overtime" : 
                   logTypeParam === "extended_overtime" ? "extended_overtime" : 
                   logTypeParam === "regular" ? "regular" : null
    const userIdParam = request.nextUrl.searchParams.get("userId")

    if (role === "admin") {
      if (userIdParam) {
        // Admin requesting logs for a specific user
        const logs = await getTimeLogsForUser(userIdParam, logType)
        return NextResponse.json({ logs })
      } else {
        // Admin can see all logs
        const logs = await getAllTimeLogsWithDetails()
        return NextResponse.json({ logs })
      }
    } else {
      // Intern can only see their own logs
      const logs = await getTimeLogsForUser(String(userId), logType)
      return NextResponse.json({ logs })
    }
  } catch (error) {
    console.error("Error fetching time logs:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
