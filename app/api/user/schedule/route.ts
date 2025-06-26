import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { sql } from "@/lib/database"

/**
 * Updates a user's work schedule
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { valid, userId } = await verifyToken(token)

    if (!valid || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { schedule } = await request.json()

    if (!schedule) {
      return NextResponse.json({ error: "Schedule data is required" }, { status: 400 })
    }

    if (!schedule.start || !schedule.end || !Array.isArray(schedule.days)) {
      return NextResponse.json({ 
        error: "Invalid schedule format. Must include start, end, and days array" 
      }, { status: 400 })
    }

    // Convert frontend format to database format
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const dbSchedule: Record<string, {start: string, end: string}> = {}
    
    schedule.days.forEach((dayNumber: number) => {
      if (dayNumber >= 1 && dayNumber <= 7) {
        const dayName = dayNames[dayNumber - 1]
        dbSchedule[dayName] = {
          start: schedule.start,
          end: schedule.end
        }
      }
    })

    await sql`
      UPDATE users 
      SET work_schedule = ${JSON.stringify(dbSchedule)}, updated_at = NOW()
      WHERE id = ${userId}
    `

    return NextResponse.json({ 
      success: true, 
      message: "Work schedule updated successfully" 
    })

  } catch (error) {
    console.error("Schedule update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Retrieves a user's current work schedule
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { valid, userId } = await verifyToken(token)

    if (!valid || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await sql`
      SELECT work_schedule 
      FROM users 
      WHERE id = ${userId}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    let workSchedule = result[0].work_schedule
    
    if (!workSchedule) {
      return NextResponse.json({ 
        schedule: { start: "09:00", end: "18:00", days: [1,2,3,4,5] }
      })
    }

    if (typeof workSchedule === "string") {
      try {
        workSchedule = JSON.parse(workSchedule)
      } catch {
        return NextResponse.json({ 
          schedule: { start: "09:00", end: "18:00", days: [1,2,3,4,5] }
        })
      }
    }

    if (workSchedule.start && workSchedule.end && Array.isArray(workSchedule.days)) {
      return NextResponse.json({ schedule: workSchedule })
    }

    // Convert from database format to frontend format
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const days: number[] = []
    let start = "09:00"
    let end = "18:00"
    
    dayNames.forEach((dayName, index) => {
      if (workSchedule[dayName]) {
        days.push(index + 1)
        if (days.length === 1) {
          start = workSchedule[dayName].start
          end = workSchedule[dayName].end
        }
      }
    })

    const frontendSchedule = {
      start,
      end,
      days: days.length > 0 ? days : [1,2,3,4,5]
    }

    return NextResponse.json({ schedule: frontendSchedule })

  } catch (error) {
    console.error("Schedule fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
