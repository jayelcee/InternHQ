/**
 * Reusable API middleware utilities for consistent authentication and error handling
 */

import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"

export interface AuthenticatedRequest {
  userId: string
  role: string
  token: string
}

/**
 * Middleware for authenticating API requests
 * Returns user info if authenticated, otherwise returns error response
 */
export async function withAuth(
  request: NextRequest,
  requiredRole?: "admin" | "intern"
): Promise<{ success: true; auth: AuthenticatedRequest } | { success: false; response: NextResponse }> {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return {
        success: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    const { valid, userId, role } = await verifyToken(token)

    if (!valid || !userId || !role) {
      return {
        success: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    if (requiredRole && role !== requiredRole) {
      return {
        success: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    return {
      success: true,
      auth: {
        userId: String(userId),
        role,
        token
      }
    }
  } catch (error) {
    console.error("Authentication middleware error:", error)
    return {
      success: false,
      response: NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }
}

/**
 * Wrapper for handling API errors consistently
 */
export function handleApiError(error: unknown, operation: string): NextResponse {
  console.error(`${operation} error:`, error)
  
  if (error instanceof Error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    )
  }
  
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  )
}

/**
 * Middleware for admin-only access with optional user targeting
 * Allows admin to operate on other users, or users to operate on themselves
 */
export async function withAdminOrSelfAccess(
  request: NextRequest,
  targetUserId?: string
): Promise<{ success: true; auth: AuthenticatedRequest; targetUserId: string } | { success: false; response: NextResponse }> {
  const authResult = await withAuth(request)
  
  if (!authResult.success) {
    return authResult
  }

  const { auth } = authResult
  const finalTargetUserId = targetUserId || request.nextUrl.searchParams.get("userId") || auth.userId

  // Allow admin to access any user, or user to access themselves
  if (auth.role !== "admin" && finalTargetUserId !== auth.userId) {
    return {
      success: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  return {
    success: true,
    auth,
    targetUserId: finalTargetUserId
  }
}
