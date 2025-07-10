/**
 * @file (Stub) API route for admin to fetch intern statistics.
 * 
 * GET: Intended to fetch intern stats (not currently active).
 *      Requires admin authentication via 'auth-token' cookie.
 *      Returns 401 if unauthorized.
 *      Implementation is commented out for future use.
 */
import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
// import { getInternStats } from "@/lib/data-access"

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)

    if (!valid || !userId || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Implementation for fetching intern stats is currently commented out.
    // To enable, uncomment and implement as needed.
    // const stats = await getInternStats()
    // return NextResponse.json({ stats })

    // Placeholder response for now
    return NextResponse.json({ message: "Not implemented" }, { status: 501 })
  } catch {
    // Gracefully handle unexpected errors
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
