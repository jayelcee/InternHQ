/**
 * @file API route for fetching and updating user profiles with admin/self access control.
 * 
 * GET: Returns user profile if requester is admin or self.
 *      Returns 404 if not found.
 * 
 * PUT: Updates user profile if requester is admin or self.
 *      Returns 400 for update errors.
 */
import { type NextRequest, NextResponse } from "next/server"
import { withAdminOrSelfAccess, handleApiError } from "@/lib/api-middleware"
import { getUserWithDetails, updateUserProfile } from "@/lib/data-access"

/**
 * Get user profile with admin/self access control
 */
export async function GET(request: NextRequest) {
  const authResult = await withAdminOrSelfAccess(request)
  
  if (!authResult.success) {
    return authResult.response
  }

  try {
    const user = await getUserWithDetails(authResult.targetUserId)
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Update user profile with admin/self access control
 */
export async function PUT(request: NextRequest) {
  const authResult = await withAdminOrSelfAccess(request)
  
  if (!authResult.success) {
    return authResult.response
  }

  try {
    const profileData = await request.json()
    const result = await updateUserProfile(authResult.targetUserId, profileData)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
