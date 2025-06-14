import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
// import { assignInternToProject } from "@/lib/data-access"

export async function POST(request: NextRequest, { params: { id: _id } }: { params: { id: string } }) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)

    if (!valid || !userId || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // const { internId, role: internRole } = await request.json()
    // const result = await assignInternToProject(internId, params.id, internRole)

    // if (!result.success) {
    //   return NextResponse.json({ error: result.error }, { status: 400 })
    // }

    // return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error assigning intern to project:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
