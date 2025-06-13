import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { getAllInterns, createIntern } from "@/lib/data-access"

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

    const interns = await getAllInterns()

    return NextResponse.json({ interns })
  } catch (error) {
    console.error("Error fetching interns:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

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

    const internData = await request.json()
    const result = await createIntern(internData)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, intern: result.intern })
  } catch (error) {
    console.error("Error creating intern:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
