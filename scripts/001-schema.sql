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
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'suspended', 'pending_completion')),
    
    -- Program timeline
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Completion tracking
    completion_requested_at TIMESTAMP WITH TIME ZONE,
    completion_approved_at TIMESTAMP WITH TIME ZONE,
    completion_approved_by INTEGER REFERENCES users(id),
    
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
    log_type VARCHAR(20) DEFAULT 'regular' CHECK (log_type IN ('regular', 'overtime', 'extended_overtime')),
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

CREATE TABLE IF NOT EXISTS time_log_edit_requests (
    id SERIAL PRIMARY KEY,
    log_id INTEGER NOT NULL REFERENCES time_logs(id) ON DELETE RESTRICT,
    original_time_in TIMESTAMP WITH TIME ZONE,
    original_time_out TIMESTAMP WITH TIME ZONE,
    requested_time_in TIMESTAMP WITH TIME ZONE,
    requested_time_out TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT NULL
);

-- INTERNSHIP COMPLETION REQUESTS TABLE
-- Tracks requests for internship completion approval
CREATE TABLE IF NOT EXISTS internship_completion_requests (
    -- Primary key
    id SERIAL PRIMARY KEY,
    
    -- Foreign key relationships
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    internship_program_id INTEGER NOT NULL REFERENCES internship_programs(id) ON DELETE CASCADE,
    
    -- Request details
    total_hours_completed DECIMAL(10,2) NOT NULL,
    completion_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    
    -- Approval workflow
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    admin_notes TEXT,
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure only one pending request per internship program
    UNIQUE(internship_program_id, status) DEFERRABLE INITIALLY DEFERRED
);

-- OFFICIAL DTR DOCUMENTS TABLE
-- Stores official DTR documents issued by admin
CREATE TABLE IF NOT EXISTS official_dtr_documents (
    -- Primary key
    id SERIAL PRIMARY KEY,
    
    -- Foreign key relationships
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    internship_program_id INTEGER NOT NULL REFERENCES internship_programs(id) ON DELETE CASCADE,
    completion_request_id INTEGER NOT NULL REFERENCES internship_completion_requests(id) ON DELETE CASCADE,
    
    -- Document details
    document_number VARCHAR(50) NOT NULL UNIQUE,
    total_hours DECIMAL(10,2) NOT NULL,
    regular_hours DECIMAL(10,2) NOT NULL,
    overtime_hours DECIMAL(10,2) NOT NULL,
    
    -- Period covered
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Signing details
    issued_by INTEGER NOT NULL REFERENCES users(id),
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    admin_signature_name VARCHAR(255) NOT NULL,
    admin_title VARCHAR(255) NOT NULL,
    
    -- Document metadata
    document_hash VARCHAR(64), -- For document integrity verification
    file_path VARCHAR(500), -- Path to generated PDF file
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- COMPLETION CERTIFICATES TABLE
-- Stores completion certificates issued by admin
CREATE TABLE IF NOT EXISTS completion_certificates (
    -- Primary key
    id SERIAL PRIMARY KEY,
    
    -- Foreign key relationships
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    internship_program_id INTEGER NOT NULL REFERENCES internship_programs(id) ON DELETE CASCADE,
    completion_request_id INTEGER NOT NULL REFERENCES internship_completion_requests(id) ON DELETE CASCADE,
    
    -- Certificate details
    certificate_number VARCHAR(50) NOT NULL UNIQUE,
    completion_date DATE NOT NULL,
    total_hours_completed DECIMAL(10,2) NOT NULL,
    
    -- Signing details
    issued_by INTEGER NOT NULL REFERENCES users(id),
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    admin_signature_name VARCHAR(255) NOT NULL,
    admin_title VARCHAR(255) NOT NULL,
    
    -- Certificate metadata
    certificate_hash VARCHAR(64), -- For certificate integrity verification
    file_path VARCHAR(500), -- Path to generated PDF file
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

CREATE INDEX IF NOT EXISTS idx_time_log_edit_requests_metadata 
ON time_log_edit_requests USING GIN (metadata);

-- Completion request indexes
CREATE INDEX IF NOT EXISTS idx_internship_completion_requests_user_id ON internship_completion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_internship_completion_requests_program_id ON internship_completion_requests(internship_program_id);
CREATE INDEX IF NOT EXISTS idx_internship_completion_requests_status ON internship_completion_requests(status);

-- Official DTR document indexes
CREATE INDEX IF NOT EXISTS idx_official_dtr_documents_user_id ON official_dtr_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_official_dtr_documents_program_id ON official_dtr_documents(internship_program_id);
CREATE INDEX IF NOT EXISTS idx_official_dtr_documents_number ON official_dtr_documents(document_number);

-- Completion certificate indexes
CREATE INDEX IF NOT EXISTS idx_completion_certificates_user_id ON completion_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_completion_certificates_program_id ON completion_certificates(internship_program_id);
CREATE INDEX IF NOT EXISTS idx_completion_certificates_number ON completion_certificates(certificate_number);

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

CREATE TRIGGER update_internship_completion_requests_updated_at 
    BEFORE UPDATE ON internship_completion_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- SCHEMA VALIDATION
-- ================================================================
-- ================================================================

-- Add any additional constraints or validation rules here
-- Currently all validation is handled through CHECK constraints in table definitions