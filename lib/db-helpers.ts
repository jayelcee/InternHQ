/**
 * Database helper utilities for common queries, validation, and transactions.
 *
 * Exports:
 * - getUserById: Fetch user by ID
 * - validators: Common validation helpers
 * - withTransaction: Transaction wrapper for async operations
 */

import { sql } from "./database"
import type { User } from "./database"

export async function getUserById(userId: number | string): Promise<User | null> {
  try {
    const userIdNum = typeof userId === 'string' ? Number(userId) : userId
    const users = await sql`
      SELECT id, email, first_name, last_name, role, work_schedule, created_at, updated_at
      FROM users 
      WHERE id = ${userIdNum}
    `
    return users.length > 0 ? users[0] as User : null
  } catch {
    return null
  }
}

export const validators = {
  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  },
  hasRequiredFields<T extends Record<string, unknown>>(
    data: T, 
    fields: (keyof T)[]
  ): { valid: boolean; missing: string[] } {
    const missing = fields.filter(field => !data[field])
    return {
      valid: missing.length === 0,
      missing: missing as string[]
    }
  },
  isPositiveNumber(value: unknown): boolean {
    return typeof value === 'number' && value > 0
  },
  isValidDateString(dateStr: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr))
  }
}

export async function withTransaction<T>(
  operation: () => Promise<T>
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const result = await operation()
    return { success: true, data: result }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Transaction failed' 
    }
  }
}
