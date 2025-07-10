import type { User } from "./database"
import { sql } from "./database"

/**
 * Creates a simple JWT-like token (base64-encoded, unsigned).
 * @param payload Token payload
 */
function createSimpleToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const payloadStr = btoa(JSON.stringify(payload))
  const signature = btoa(`${header}.${payloadStr}.simple-signature`)
  return `${header}.${payloadStr}.${signature}`
}

/**
 * Verifies a simple token and checks expiration.
 * @param token Token string
 * @returns Decoded payload or null if invalid/expired
 */
function verifySimpleToken(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1])) as Record<string, unknown>
    if (payload.exp && typeof payload.exp === "number" && Date.now() > payload.exp) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

/**
 * Result of an authentication attempt.
 */
export interface AuthResult {
  success: boolean
  user?: User
  token?: string
  error?: string
}

/**
 * Authenticates a user by email and password.
 * Returns user and token if successful, otherwise error.
 */
export async function authenticateUser(email: string, password: string): Promise<AuthResult> {
  try {
    const users: User[] = await sql`
      SELECT id, email, first_name, last_name, role, created_at, updated_at
      FROM users
      WHERE email = ${email}
    `
    const user = users[0]
    if (!user) {
      return { success: false, error: "Invalid email or password" }
    }
    const [{ valid }]: { valid: boolean }[] = await sql`
      SELECT (password_hash = crypt(${password}, password_hash)) AS valid
      FROM users
      WHERE id = ${user.id}
    `
    if (!valid) {
      return { success: false, error: "Invalid email or password" }
    }
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
  } catch {
    return { success: false, error: "Authentication failed" }
  }
}

/**
 * Verifies a token and returns userId and role if valid.
 * @param token Token string
 */
export async function verifyToken(token: string): Promise<{ valid: boolean; userId?: number; role?: string }> {
  try {
    const decoded = verifySimpleToken(token)
    if (!decoded || typeof decoded.userId !== "number" || typeof decoded.role !== "string") {
      return { valid: false }
    }
    const users: User[] = await sql`
      SELECT id, role FROM users WHERE id = ${decoded.userId}
    `
    if (!users[0]) {
      return { valid: false }
    }
    return { valid: true, userId: decoded.userId, role: decoded.role }
  } catch {
    return { valid: false }
  }
}

/**
 * Fetches a user by their ID.
 * @param userId User ID
 */
export async function getUserById(userId: number): Promise<User | null> {
  try {
    const users: User[] = await sql`
      SELECT id, email, first_name, last_name, role, created_at, updated_at
      FROM users
      WHERE id = ${userId}
    `
    return users[0] || null
  } catch {
    return null
  }
}
