/**
 * @file API route for user login.
 * 
 * POST: Authenticates user with email and password.
 *       On success, returns user data and sets 'auth-token' cookie.
 *       Returns 400 for invalid input, 401 for authentication failure, 500 for server error.
 */
import { type NextRequest, NextResponse } from "next/server"
import { authenticateUser } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    // Parse request body safely
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: "Invalid request format" }, { status: 400 })
    }

    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Email and password are required" }, { status: 400 })
    }

    const result = await authenticateUser(email, password)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || "Authentication failed" }, { status: 401 })
    }

    // Create response with user data
    const response = NextResponse.json({
      success: true,
      user: result.user,
    })

    // Set cookie if token exists
    if (result.token) {
      response.cookies.set("auth-token", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60, // 24 hours
        path: "/",
      })
    }

    return response
  } catch {
    return NextResponse.json({ success: false, error: "Server error occurred" }, { status: 500 })
  }
}
