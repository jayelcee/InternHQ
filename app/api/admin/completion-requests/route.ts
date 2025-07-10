/**
 * @file API route for admin to manage internship completion requests.
 * 
 * GET: Returns all completion requests with intern details.
 *      Supports pagination (limit, offset) and status filtering.
 *      Requires admin authentication via 'auth-token' cookie.
 *      Returns 401 if unauthorized, otherwise an array of requests (may be empty).
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { CompletionService } from '@/lib/completion-service'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)
    if (!valid || !userId || role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters for pagination and filtering
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const status = url.searchParams.get('status') as 'pending' | 'approved' | 'rejected' | undefined

    try {
      const requests = await CompletionService.getAllCompletionRequests(limit, offset, status)
      return NextResponse.json(requests)
    } catch {
      // Gracefully handle service errors by returning an empty array
      return NextResponse.json([])
    }

  } catch {
    // Gracefully handle unexpected errors by returning an empty array
    return NextResponse.json([])
  }
}