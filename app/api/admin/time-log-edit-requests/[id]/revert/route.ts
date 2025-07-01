import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/database"
import { revertTimeLogToOriginal } from "@/lib/data-access"

export const dynamic = "force-dynamic";

// Use the new Next.js 13+ convention for dynamic route params
export async function POST(request: NextRequest) {
  // The id param is in the pathname, extract it
  const urlParts = request.nextUrl.pathname.split("/").filter(Boolean)
  const idStr = urlParts[urlParts.length - 2]
  const id = Number(idStr)
  if (!id) {
    return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
  }
  try {
    const result = await revertTimeLogToOriginal(id)
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to revert time log" }, { status: 500 })
    }
    await sql`
      UPDATE time_log_edit_requests
      SET status = 'pending', reviewed_at = NULL, reviewed_by = NULL
      WHERE id = ${id}
    `
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error reverting time log edit request:", err)
    return NextResponse.json({ error: "Failed to revert time log" }, { status: 500 })
  }
}
