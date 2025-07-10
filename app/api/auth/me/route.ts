/**
 * @file API route for fetching the authenticated user's details.
 * 
 * GET: Returns the user object if authenticated, otherwise { user: null }.
 *      Checks 'auth-token' cookie for authentication.
 */
import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { getUserWithDetails } from "@/lib/data-access"

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ user: null })
    }

    const { valid, userId } = await verifyToken(token)

    if (!valid || !userId) {
      return NextResponse.json({ user: null })
    }

    const user = await getUserWithDetails(String(userId))

    return NextResponse.json({ user })
  } catch {
    // Gracefully handle unexpected errors
    return NextResponse.json({ user: null })
  }
}
