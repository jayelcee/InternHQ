import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
// import { removeInternFromProject } from "@/lib/data-access"

export async function POST(request: NextRequest, { params: _params }: { params: { id: string } }) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)

    if (!valid || !userId || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // const { internId } = await request.json()
    // const result = await removeInternFromProject(internId, params.id)

    // if (!result.success) {
    //   return NextResponse.json({ error: result.error }, { status: 400 })
    // }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing intern from project:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
