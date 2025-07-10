/**
 * Reusable API middleware utilities for consistent authentication and error handling
 */

import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"

/**
 * Represents an authenticated API request.
 */
export interface AuthenticatedRequest {
  userId: string
  role: string
  token: string
}

/**
 * Authenticates API requests using the 'auth-token' cookie.
 * Optionally enforces a required user role.
 * Returns user info if authenticated, otherwise returns an error response.
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
  } catch {
    return {
      success: false,
      response: NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }
}

/**
 * Handles API errors and returns a standardized error response.
 * @param error The error thrown
 * @param operation The operation being performed (for logging)
 */
export function handleApiError(error: unknown, operation: string): NextResponse {
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
 * Middleware for admin-only or self-access.
 * Allows admins to operate on any user, or users to operate on themselves.
 * @param request The API request
 * @param targetUserId Optional userId to target (defaults to self or query param)
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
