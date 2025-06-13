import { NextResponse } from "next/server"
import { sql } from "@/lib/database"

type Supervisor = {
  id: number
  first_name: string
  last_name: string
}

export async function GET() {
  try {
    const supervisors: Supervisor[] = await sql`
      SELECT id, first_name, last_name FROM supervisors
    `
    return NextResponse.json(
      supervisors.map((sup) => ({
        id: sup.id,
        first_name: sup.first_name,
        last_name: sup.last_name,
      }))
    )
  } catch {
    return NextResponse.json({ error: "Failed to fetch supervisors" }, { status: 500 })
  }
}