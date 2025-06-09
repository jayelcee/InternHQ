import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { getUserWithDetails, deleteIntern } from "@/lib/data-access"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)

    if (!valid || !userId || role !== "hr_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const intern = await getUserWithDetails(params.id)

    if (!intern || intern.role !== "intern") {
      return NextResponse.json({ error: "Intern not found" }, { status: 404 })
    }

    return NextResponse.json({ intern })
  } catch (error) {
    console.error("Error fetching intern:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)

    if (!valid || !userId || role !== "hr_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await deleteIntern(params.id)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting intern:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
