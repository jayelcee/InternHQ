/**
 * Database initialization helper
 * Ensures required tables exist with graceful error handling
 */
import { sql } from './database'

export async function ensureTablesExist(): Promise<boolean> {
  try {
    console.log('🔍 Checking if completion requests table exists...')
    
    // Simple check to see if the table exists
    await sql`SELECT 1 FROM internship_completion_requests LIMIT 1`
    
    console.log('✅ Completion requests table exists')
    return true
  } catch (error) {
    console.log('❌ Completion requests table does not exist or other error:', error)
    
    // Check if it's specifically a "relation does not exist" error
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMessage = (error as Error).message?.toLowerCase() || ''
      if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
        console.log('📋 Tables need to be initialized')
        return false
      }
    }
    
    // For other errors, assume tables don't exist
    return false
  }
}

export async function initializeDatabase(): Promise<void> {
  try {
    console.log('🚀 Initializing database tables...')
    
    // Create essential tables for completion requests
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
    
    // Create basic users table if it doesn't exist
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
    
    // Create basic internship_programs table if it doesn't exist
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
    
    // Create basic schools table if it doesn't exist
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
    
    // Create basic departments table if it doesn't exist
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
    
    console.log('✅ Database tables initialized successfully')
  } catch (error) {
    console.error('❌ Error initializing database:', error)
    throw error
  }
}
