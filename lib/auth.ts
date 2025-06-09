import type { User } from "./database"
import { sql } from "./database"

// Simple JWT-like token creation without external dependencies
function createSimpleToken(payload: any): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const payloadStr = btoa(JSON.stringify(payload))
  const signature = btoa(`${header}.${payloadStr}.simple-signature`)
  return `${header}.${payloadStr}.${signature}`
}

function verifySimpleToken(token: string): any {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null

    const payload = JSON.parse(atob(parts[1]))

    // Check if token is expired (24 hours)
    if (payload.exp && Date.now() > payload.exp) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

export interface AuthResult {
  success: boolean
  user?: User
  token?: string
  error?: string
}

export async function authenticateUser(email: string, password: string): Promise<AuthResult> {
  try {
    // Fetch user by email
    const users: User[] = await sql`
      SELECT id, email, first_name, last_name, role, created_at, updated_at
      FROM users
      WHERE email = ${email}
    `
    const user = users[0]
    if (!user) {
      return { success: false, error: "Invalid email or password" }
    }

    // Fetch password_hash for verification
    const [{ password_hash }] = await sql`
      SELECT password_hash FROM users WHERE id = ${user.id}
    `

    // Use PostgreSQL's crypt to verify password
    const [{ valid }] = await sql`
      SELECT (password_hash = crypt(${password}, password_hash)) AS valid
      FROM users
      WHERE id = ${user.id}
    `
    if (!valid) {
      return { success: false, error: "Invalid email or password" }
    }

    // Create simple token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    }

    const token = createSimpleToken(tokenPayload)

    return {
      success: true,
      user,
      token,
    }
  } catch (error) {
    console.error("Authentication error:", error)
    return { success: false, error: "Authentication failed" }
  }
}

export async function verifyToken(token: string): Promise<{ valid: boolean; userId?: number; role?: string }> {
  try {
    const decoded = verifySimpleToken(token)

    if (!decoded) {
      return { valid: false }
    }

    // Optionally, check if user still exists and is active
    const users: User[] = await sql`
      SELECT id, role FROM users WHERE id = ${decoded.userId}
    `
    if (!users[0]) {
      return { valid: false }
    }

    return { valid: true, userId: decoded.userId, role: decoded.role }
  } catch (error) {
    console.error("Token verification error:", error)
    return { valid: false }
  }
}

export async function getUserById(userId: number): Promise<User | null> {
  try {
    const users: User[] = await sql`
      SELECT id, email, first_name, last_name, role, created_at, updated_at
      FROM users
      WHERE id = ${userId}
    `
    return users[0] || null
  } catch (error) {
    console.error("Error fetching user:", error)
    return null
  }
}
