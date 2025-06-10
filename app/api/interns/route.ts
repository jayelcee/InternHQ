import { NextResponse } from "next/server"
import { getAllInterns } from "@/lib/data-access"

export async function GET() {
  try {
    const interns = await getAllInterns()
    return NextResponse.json(interns)
  } catch (error) {
    console.error("API /api/interns error:", error)
    return NextResponse.json({ error: "Failed to fetch interns" }, { status: 500 })
  }
}