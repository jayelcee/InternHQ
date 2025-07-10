/**
 * @file API route for admin to process a specific completion request.
 * 
 * POST: Processes a completion request by approving, rejecting, reverting, or deleting.
 *       Requires admin authentication via 'auth-token' cookie.
 *       Expects JSON body with 'action' and optional 'admin_notes'.
 *       Returns 401 if unauthorized, 400 for invalid actions or service errors.
 *       On success, returns a message indicating the performed action.
 * 
 * DELETE: Deletes a specific completion request.
 *         Requires admin authentication via 'auth-token' cookie.
 *         Returns 401 if unauthorized, 400 for service errors.
 *         On success, returns a message indicating deletion.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { CompletionService } from '@/lib/completion-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)
    if (!valid || !userId || role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { action, admin_notes } = body

    if (['approve', 'reject'].includes(action)) {
      const result = await CompletionService.processCompletionRequest(
        parseInt(id),
        action as 'approve' | 'reject',
        userId,
        admin_notes
      )
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json({
        message: `Completion request ${action}d successfully`
      })
    } else if (action === 'revert') {
      const result = await CompletionService.revertCompletionRequest(parseInt(id))
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json({ message: 'Completion request reverted to pending' })
    } else if (action === 'delete') {
      const result = await CompletionService.deleteCompletionRequest(parseInt(id))
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json({ message: 'Completion request deleted' })
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch {
    // Gracefully handle unexpected errors
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("auth-token")?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { valid, userId, role } = await verifyToken(token)
    if (!valid || !userId || role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const result = await CompletionService.deleteCompletionRequest(parseInt(id))
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ message: 'Completion request deleted' })
  } catch {
    // Gracefully handle unexpected errors
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
