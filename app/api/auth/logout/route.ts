/**
 * @file API route for user logout.
 * 
 * POST: Clears the 'auth-token' cookie to log out the user.
 *       Always returns { success: true }.
 */
import { NextResponse } from "next/server"

export async function POST() {
  try {
    const response = NextResponse.json({ success: true })

    response.cookies.set("auth-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0,
      path: "/",
    })

    return response
  } catch {
    // Always succeed logout, even on error
    return NextResponse.json({ success: true })
  }
}
