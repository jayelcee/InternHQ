/**
 * @file API route for fetching all interns.
 * 
 * GET: Returns an array of all interns.
 *      Returns 500 on error.
 */
import { NextResponse } from "next/server"
import { getAllInterns } from "@/lib/data-access"

export async function GET() {
  try {
    const interns = await getAllInterns()
    return NextResponse.json(interns)
  } catch {
    return NextResponse.json({ error: "Failed to fetch interns" }, { status: 500 })
  }
}