import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/api-middleware"
import { CompletionService } from "@/lib/completion-service"

export async function GET(request: NextRequest) {
  const authResult = await withAuth(request, "intern")
  
  if (!authResult.success) {
    return authResult.response
  }

  const { auth } = authResult
  const userId = parseInt(auth.userId)

  try {
    const result = await CompletionService.getUserCompletionStatus(userId)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching completion status:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
