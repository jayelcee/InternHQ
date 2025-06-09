import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { getUserWithDetails } from "@/lib/data-access"

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      console.log("No auth token found")
      return NextResponse.json({ user: null })
    }

    const { valid, userId } = await verifyToken(token)
    console.log("Token verification:", { valid, userId })

    if (!valid || !userId) {
      console.log("Invalid token or no userId")
      return NextResponse.json({ user: null })
    }

    const user = await getUserWithDetails(String(userId))
    console.log("User fetched:", !!user)

    return NextResponse.json({ user })
  } catch (error) {
    console.error("Auth check error:", error)
    return NextResponse.json({ user: null })
  }
}
