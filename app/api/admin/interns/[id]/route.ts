import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { getUserWithDetails, deleteIntern } from "@/lib/data-access"

export async function GET(
  request: NextRequest,
  context: { params: Record<string, string | string[]> }
) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)

    if (!valid || !userId || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const id = Array.isArray(context.params.id) ? context.params.id[0] : context.params.id
    const intern = await getUserWithDetails(id)

    if (!intern || intern.role !== "intern") {
      return NextResponse.json({ error: "Intern not found" }, { status: 404 })
    }

    return NextResponse.json({ intern })
  } catch (error) {
    console.error("Error fetching intern:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Record<string, string | string[]> }
) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)

    if (!valid || !userId || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const id = Array.isArray(context.params.id) ? context.params.id[0] : context.params.id
    const result = await deleteIntern(id)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting intern:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
