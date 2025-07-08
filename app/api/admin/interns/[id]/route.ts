/**
 * @file API route for admin to fetch or delete a specific intern.
 *
 * GET: Returns intern details for the given ID.
 *      Requires admin authentication via 'auth-token' cookie.
 *      Returns 401 if unauthorized, 404 if not found or not an intern.
 *
 * DELETE: Deletes the intern with the given ID.
 *         Requires admin authentication via 'auth-token' cookie.
 *         Returns 401 if unauthorized, 400 for service errors.
 *         On success, returns { success: true }.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getUserWithDetails, deleteIntern } from "@/lib/data-access";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const token = request.cookies.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { valid, userId, role } = await verifyToken(token);

    if (!valid || !userId || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const intern = await getUserWithDetails(id);

    if (!intern || intern.role !== "intern") {
      return NextResponse.json({ error: "Intern not found" }, { status: 404 });
    }

    return NextResponse.json({ intern });
  } catch {
    // Gracefully handle unexpected errors
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const token = request.cookies.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { valid, userId, role } = await verifyToken(token);

    if (!valid || !userId || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await deleteIntern(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    // Gracefully handle unexpected errors
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
