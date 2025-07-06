/**
 * API route for managing internship completion requests (Admin only)
 * GET: Fetch all completion requests with intern details
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { CompletionService } from '@/lib/completion-service'

export async function GET(request: NextRequest) {
  try {
    console.log('📥 Admin completion requests API called')
    
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      console.log('❌ No auth token found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)
    if (!valid || !userId || role !== 'admin') {
      console.log('❌ Invalid token or not admin role:', { valid, userId, role })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('✅ Admin authenticated, fetching requests...')

    // Get query parameters for pagination and filtering
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const status = url.searchParams.get('status') as 'pending' | 'approved' | 'rejected' | undefined

    console.log('📊 Query params:', { limit, offset, status })

    try {
      const requests = await CompletionService.getAllCompletionRequests(limit, offset, status)
      
      console.log('✅ Fetched completion requests:', requests.length)

      return NextResponse.json(requests)
    } catch {
      // If the service returns an empty array (handled gracefully), return it
      console.log('🔄 Service error handled, returning empty array')
      return NextResponse.json([])
    }

  } catch (error) {
    console.error('❌ Error fetching completion requests:', error)
    
    // Return empty array instead of error for graceful degradation
    return NextResponse.json([])
  }
}
