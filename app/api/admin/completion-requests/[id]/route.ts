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

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

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

  } catch (error) {
    console.error('Error processing completion request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
