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
    const { admin_signature_name, admin_title } = body

    if (!admin_signature_name || !admin_title) {
      return NextResponse.json({ 
        error: 'Admin signature name and title are required' 
      }, { status: 400 })
    }

    const result = await CompletionService.generateDTRDocument(
      parseInt(id),
      admin_signature_name,
      admin_title,
      userId
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      message: 'DTR document generated successfully',
      document: result.document,
      content: result.content
    })

  } catch (error) {
    console.error('Error generating DTR document:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
