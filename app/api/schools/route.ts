import { NextResponse } from "next/server"
import { sql } from "@/lib/database"

type School = {
  id: number
  name: string
  address: string | null
  contact_email: string | null
  contact_phone: string | null
}

export async function GET() {
  try {
    const schools: School[] = await sql`
      SELECT id, name, address, contact_email, contact_phone FROM schools
    `
    return NextResponse.json(
      schools.map((school) => ({
        id: school.id,
        name: school.name,
        address: school.address,
        contact_email: school.contact_email,
        contact_phone: school.contact_phone,
      }))
    )
  } catch {
    return NextResponse.json({ error: "Failed to fetch schools" }, { status: 500 })
  }
}
