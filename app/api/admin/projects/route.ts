/**
 * @file (Stub) API route for admin to fetch or create projects.
 * 
 * GET: Intended to fetch all projects (not currently active).
 * POST: Intended to create a new project (not currently active).
 * 
 * All methods require admin authentication via 'auth-token' cookie.
 * Returns 401 if unauthorized.
 * Implementation is commented out for future use.
 */
import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
// import { getAllProjects, createProject } from "@/lib/data-access"

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)

    if (!valid || !userId || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Implementation for fetching all projects is currently commented out.
    // To enable, uncomment and implement as needed.
    // const projects = await getAllProjects()
    // return NextResponse.json({ projects })

    // Placeholder response for now
    return NextResponse.json({ message: "Not implemented" }, { status: 501 })
  } catch {
    // Gracefully handle unexpected errors
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)

    if (!valid || !userId || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Implementation for creating a project is currently commented out.
    // To enable, uncomment and implement as needed.
    // const projectData = await request.json()
    // const result = await createProject(projectData)
    // if (!result.success) {
    //   return NextResponse.json({ error: result.error }, { status: 400 })
    // }
    // return NextResponse.json({ success: true, project: result.project })

    // Placeholder response for now
    return NextResponse.json({ message: "Not implemented" }, { status: 501 })
  } catch {
    // Gracefully handle unexpected errors
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
