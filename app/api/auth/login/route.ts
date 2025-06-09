import { type NextRequest, NextResponse } from "next/server"
import { authenticateUser } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    // Parse request body safely
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError)
      return NextResponse.json({ success: false, error: "Invalid request format" }, { status: 400 })
    }

    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Email and password are required" }, { status: 400 })
    }

    console.log("Attempting login for:", email)

    const result = await authenticateUser(email, password)
    console.log("Authentication result:", result.success ? "success" : result.error)

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
      console.log("Auth token set in cookie")
    }

    return response
  } catch (error) {
    console.error("Login API error:", error)
    return NextResponse.json({ success: false, error: "Server error occurred" }, { status: 500 })
  }
}
