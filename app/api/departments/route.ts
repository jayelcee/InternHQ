/**
 * @file API route for fetching all departments.
 * 
 * GET: Returns an array of department objects.
 *      On error, returns 500 with error message.
 */
import { NextResponse } from "next/server"
import { sql } from "@/lib/database"

type Department = {
  id: number
  name: string
  description: string | null
  supervisor_id: number | null
}

export async function GET() {
  try {
    const departments: Department[] = await sql`
      SELECT id, name, description, supervisor_id FROM departments
    `
    return NextResponse.json(
      departments.map((dept) => ({
        id: dept.id,
        name: dept.name,
        description: dept.description,
        supervisor_id: dept.supervisor_id,
      }))
    )
  } catch {
    return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 })
  }
}
