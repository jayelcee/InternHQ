import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { getUserWithDetails } from "@/lib/data-access"
import { updateUserProfile } from "@/lib/data-access"

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

    // Support ?userId= for admin
    const searchId = request.nextUrl.searchParams.get("userId") || userId

    // Only allow admin to fetch other users' profiles
    if (searchId !== userId && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const user = await getUserWithDetails(String(searchId))
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error("Profile fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)

    if (!valid || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Support ?userId= for admin
    const searchId = request.nextUrl.searchParams.get("userId") || userId

    // Only allow admin to update other users' profiles
    if (searchId !== userId && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const profileData = await request.json()
    const result = await updateUserProfile(String(searchId), profileData)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Profile update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
