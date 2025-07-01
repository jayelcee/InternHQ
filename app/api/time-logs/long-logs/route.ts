import { NextResponse } from "next/server"
import { checkLongLogs, migrateLongLogs } from "@/lib/data-access"

// Optionally, add authentication middleware here if needed

export async function GET() {
  try {
    const result = await checkLongLogs()
    return NextResponse.json(result)
  } catch (err) {
    console.error("Error checking long logs:", err)
    return NextResponse.json({ error: "Failed to check long logs" }, { status: 500 })
  }
}

export async function POST() {
  try {
    const result = await migrateLongLogs()
    return NextResponse.json(result)
  } catch (err) {
    console.error("Error migrating long logs:", err)
    return NextResponse.json({ error: "Failed to migrate long logs" }, { status: 500 })
  }
}
