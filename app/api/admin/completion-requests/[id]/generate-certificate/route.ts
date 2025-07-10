/**
 * @file API route for admin to generate a completion certificate for a specific request.
 * 
 * POST: Generates a certificate for the given completion request ID.
 *       Requires admin authentication via 'auth-token' cookie.
 *       Expects JSON body with 'admin_signature_name' and 'admin_title'.
 *       Returns 401 if unauthorized, 400 for missing fields or service errors.
 *       On success, returns the generated certificate and content.
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
    const { admin_signature_name, admin_title } = body

    if (!admin_signature_name || !admin_title) {
      return NextResponse.json({ 
        error: 'Admin signature name and title are required' 
      }, { status: 400 })
    }

    const result = await CompletionService.generateCertificate(
      parseInt(id),
      admin_signature_name,
      admin_title,
      userId
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      message: 'Certificate generated successfully',
      certificate: result.certificate,
      content: result.content
    })

  } catch {
    // Gracefully handle unexpected errors
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
