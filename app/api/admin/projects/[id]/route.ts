import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
// import { getProjectById, updateProject, deleteProject } from "@/lib/data-access"

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

    // const project = await getProjectById(params.id)

    // if (!project) {
    //   return NextResponse.json({ error: "Project not found" }, { status: 404 })
    // }

    // return NextResponse.json({ project })
  } catch (error) {
    console.error("Error fetching project:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)

    if (!valid || !userId || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // const projectData = await request.json()
    // const result = await updateProject(params.id, projectData)

    // if (!result.success) {
    //   return NextResponse.json({ error: result.error }, { status: 400 })
    // }

    // return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating project:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { valid, userId, role } = await verifyToken(token)

    if (!valid || !userId || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // const result = await deleteProject(params.id)

    // if (!result.success) {
    //   return NextResponse.json({ error: result.error }, { status: 400 })
    // }

    // return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting project:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
