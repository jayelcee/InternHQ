/**
 * Database initialization utilities for ensuring and creating essential tables.
 *
 * Exports:
 * - ensureTablesExist: Checks if required tables exist, returns true if present, false otherwise.
 * - initializeDatabase: Creates essential tables if they do not exist.
 */
import { sql } from './database'

export async function ensureTablesExist(): Promise<boolean> {
  try {
    await sql`SELECT 1 FROM internship_completion_requests LIMIT 1`
    return true
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMessage = (error as Error).message?.toLowerCase() || ''
      if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
        return false
      }
    }
    return false
  }
}

export async function initializeDatabase(): Promise<void> {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS internship_completion_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        internship_program_id INTEGER NOT NULL,
        total_hours_completed DECIMAL(10,2) NOT NULL,
        completion_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        reviewed_by INTEGER,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        admin_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('intern', 'admin')),
        work_schedule JSONB DEFAULT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS internship_programs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        required_hours INTEGER NOT NULL DEFAULT 480,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        school_id INTEGER,
        department_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS schools (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        address TEXT,
        contact_email VARCHAR(255),
        contact_phone VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        head_user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `
  } catch (error) {
    throw error
  }
}
