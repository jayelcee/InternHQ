/**
 * @file (Stub) API route for admin to assign an intern to a project.
 * 
 * POST: Intended to assign an intern to a project (not currently active).
 *       Requires admin authentication via 'auth-token' cookie.
 *       Returns 401 if unauthorized.
 *       Implementation is commented out for future use.
 */
import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
// import { assignInternToProject } from "@/lib/data-access"

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)

    if (!valid || !userId || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Implementation for assigning intern to project is currently commented out.
    // To enable, uncomment and implement as needed.
    // const { internId, role: internRole } = await request.json()
    // const result = await assignInternToProject(internId, params.id, internRole)
    // if (!result.success) {
    //   return NextResponse.json({ error: result.error }, { status: 400 })
    // }
    // return NextResponse.json({ success: true })

    // Placeholder response for now
    return NextResponse.json({ message: "Not implemented" }, { status: 501 })
  } catch {
    // Gracefully handle unexpected errors
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
