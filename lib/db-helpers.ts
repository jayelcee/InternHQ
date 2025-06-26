/**
 * Common database operation helpers to reduce code duplication
 */

import { sql } from "./database"
import type { User } from "./database"

/**
 * Gets a user by ID with error handling
 */
export async function getUserById(userId: number | string): Promise<User | null> {
  try {
    const userIdNum = typeof userId === 'string' ? Number(userId) : userId
    const users = await sql`
      SELECT id, email, first_name, last_name, role, work_schedule, created_at, updated_at
      FROM users 
      WHERE id = ${userIdNum}
    `
    return users.length > 0 ? users[0] as User : null
  } catch (error) {
    console.error('Error fetching user:', error)
    return null
  }
}

/**
 * Common validation helpers
 */
export const validators = {
  /**
   * Validates email format
   */
  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  },

  /**
   * Validates required fields are present
   */
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

  /**
   * Validates positive number
   */
  isPositiveNumber(value: unknown): boolean {
    return typeof value === 'number' && value > 0
  },

  /**
   * Validates date string format (YYYY-MM-DD)
   */
  isValidDateString(dateStr: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr))
  }
}

/**
 * Transaction wrapper for complex operations
 */
export async function withTransaction<T>(
  operation: () => Promise<T>
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const result = await operation()
    return { success: true, data: result }
  } catch (error) {
    console.error('Transaction failed:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Transaction failed' 
    }
  }
}
