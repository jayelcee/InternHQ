-- ================================================================
-- InternHQ Database Schema
-- ================================================================
-- Complete database schema for the InternHQ internship management system
-- 
-- Table Creation Order:
-- 1. Core entities (users, schools, supervisors)
-- 2. Organizational entities (departments, projects)
-- 3. Relationship entities (internship_programs, user_profiles)
-- 4. Operational entities (time_logs, project_assignments)
--
-- ================================================================

-- ================================================================
-- CORE ENTITIES
-- ================================================================

-- USERS TABLE
-- Core user authentication and basic information
CREATE TABLE IF NOT EXISTS users (
    -- Primary key and identification
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    
    -- Personal information
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    
    -- System information
    role TEXT NOT NULL CHECK (role IN ('intern', 'admin')),
    work_schedule JSONB DEFAULT NULL,
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SCHOOLS TABLE
-- Educational institutions participating in the internship program
CREATE TABLE IF NOT EXISTS schools (
    -- Primary key
    id SERIAL PRIMARY KEY,
    
    -- School information
    name VARCHAR(255) NOT NULL UNIQUE,
    address TEXT,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SUPERVISORS TABLE
-- Supervisors who oversee interns and departments
CREATE TABLE IF NOT EXISTS supervisors (
    -- Primary key
    id SERIAL PRIMARY KEY,
    
    -- Supervisor information
    email TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- ORGANIZATIONAL ENTITIES
-- ================================================================

-- DEPARTMENTS TABLE
-- Organizational departments where interns work
CREATE TABLE IF NOT EXISTS departments (
    -- Primary key
    id SERIAL PRIMARY KEY,
    
    -- Department information
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    
    -- Foreign key relationships
    supervisor_id INTEGER REFERENCES supervisors(id),
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PROJECTS TABLE
-- Work projects that interns can be assigned to
CREATE TABLE IF NOT EXISTS projects (
    -- Primary key
    id SERIAL PRIMARY KEY,
    
    -- Project information
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on-hold', 'cancelled')),
    
    -- Project timeline
    start_date DATE,
    end_date DATE,
    
    -- Foreign key relationships
    department_id INTEGER REFERENCES departments(id),
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- RELATIONSHIP ENTITIES
-- ================================================================

-- INTERNSHIP PROGRAMS TABLE
-- Links users to their internship program details
CREATE TABLE IF NOT EXISTS internship_programs (
    -- Primary key
    id SERIAL PRIMARY KEY,
    
    -- Foreign key relationships
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    school_id INTEGER REFERENCES schools(id),
    department_id INTEGER REFERENCES departments(id),
    supervisor_id INTEGER REFERENCES supervisors(id),
    
    -- Program details
    required_hours INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'suspended')),
    
    -- Program timeline
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- USER PROFILES TABLE
-- Extended profile information for users
CREATE TABLE IF NOT EXISTS user_profiles (
    -- Primary key
    id SERIAL PRIMARY KEY,
    
    -- Foreign key relationship (one-to-one with users)
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    
    -- Contact information
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(50),
    zip_code VARCHAR(20),
    
    -- Personal information
    date_of_birth DATE,
    bio TEXT,
    
    -- Academic information
    degree VARCHAR(255),
    gpa DECIMAL(3,2),
    graduation_date DATE,
    
    -- Skills and interests (arrays)
    skills TEXT[],
    interests TEXT[],
    languages TEXT[],
    
    -- Emergency contact information
    emergency_contact_name VARCHAR(255),
    emergency_contact_relation VARCHAR(100),
    emergency_contact_phone VARCHAR(50),
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- OPERATIONAL ENTITIES
-- ================================================================

-- TIME LOGS TABLE
-- Tracks intern work hours (regular and overtime sessions)
CREATE TABLE IF NOT EXISTS time_logs (
    -- Primary key
    id SERIAL PRIMARY KEY,
    
    -- Foreign key relationships
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Time tracking
    time_in TIMESTAMP WITH TIME ZONE,
    time_out TIMESTAMP WITH TIME ZONE,
    
    -- Log classification and status
    log_type VARCHAR(20) DEFAULT 'regular' CHECK (log_type IN ('regular', 'overtime')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    
    -- Overtime approval workflow
    overtime_status VARCHAR(20) DEFAULT NULL CHECK (overtime_status IN ('pending', 'approved', 'rejected')),
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Additional information
    notes TEXT,
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INTERN PROJECT ASSIGNMENTS TABLE
-- Links interns to their assigned projects
CREATE TABLE IF NOT EXISTS intern_project_assignments (
    -- Primary key
    id SERIAL PRIMARY KEY,
    
    -- Foreign key relationships
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Assignment details
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    role VARCHAR(100),
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique user-project combinations
    UNIQUE(user_id, project_id)
);

-- ================================================================
-- CONSTRAINTS AND INDEXES
-- ================================================================

-- UNIQUE CONSTRAINTS
-- Ensure only one active (pending) log per user at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_time_logs_user_pending
ON time_logs (user_id)
WHERE status = 'pending';

-- PERFORMANCE INDEXES
-- Indexes for frequently queried columns and foreign keys

-- User-related indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Time logs indexes (most frequently queried table)
CREATE INDEX IF NOT EXISTS idx_time_logs_user_id ON time_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_status ON time_logs(status);
CREATE INDEX IF NOT EXISTS idx_time_logs_log_type ON time_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_time_logs_overtime_status ON time_logs(log_type, overtime_status) 
WHERE log_type = 'overtime';
CREATE INDEX IF NOT EXISTS idx_time_logs_date ON time_logs(time_in);

-- Internship program indexes
CREATE INDEX IF NOT EXISTS idx_internship_programs_user_id ON internship_programs(user_id);
CREATE INDEX IF NOT EXISTS idx_internship_programs_status ON internship_programs(status);
CREATE INDEX IF NOT EXISTS idx_internship_programs_dates ON internship_programs(start_date, end_date);

-- Project assignment indexes
CREATE INDEX IF NOT EXISTS idx_intern_project_assignments_user_id ON intern_project_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_intern_project_assignments_project_id ON intern_project_assignments(project_id);

-- Project indexes
CREATE INDEX IF NOT EXISTS idx_projects_department_id ON projects(department_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- ================================================================
-- TRIGGERS AND FUNCTIONS
-- ================================================================

-- TRIGGER FUNCTION FOR UPDATED_AT TIMESTAMPS
-- Automatically updates the updated_at column when records are modified
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- Apply the updated_at trigger to all tables that have this column

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_internship_programs_updated_at 
    BEFORE UPDATE ON internship_programs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_logs_updated_at 
    BEFORE UPDATE ON time_logs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_intern_project_assignments_updated_at 
    BEFORE UPDATE ON intern_project_assignments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- SCHEMA VALIDATION
-- ================================================================

-- Add any additional constraints or validation rules here
-- Currently all validation is handled through CHECK constraints in table definitions