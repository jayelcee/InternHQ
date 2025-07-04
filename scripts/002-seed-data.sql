-- ================================================================
-- InternHQ Database Seed Data
-- ================================================================
-- Populates the database with initial test data for development and testing
-- 
-- Seeding Order:
-- 1. Enable required extensions
-- 2. Core entities (users, schools, supervisors)
-- 3. Organizational entities (departments, projects)
-- 4. Relationship entities (internship_programs)
-- 5. Operational data (time_logs)
-- 6. Configuration updates (work_schedules)
--
-- ================================================================

-- ================================================================
-- EXTENSIONS AND SETUP
-- ================================================================

-- Enable password hashing extension for secure password storage
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ================================================================
-- CORE ENTITIES
-- ================================================================

-- USERS
-- Insert admin and intern users with hashed passwords
INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES
    ('rhea.masiglat@cybersoftbpo.com', crypt('admin123', gen_salt('bf')), 'Rhea', 'Masiglat', 'admin'),
    ('jasmine.camasura@cybersoftbpo.com', crypt('intern123', gen_salt('bf')), 'Jasmine', 'Camasura', 'intern'),
    ('jireh.sodsod@cybersoftbpo.com', crypt('intern123', gen_salt('bf')), 'Jireh Walter', 'Sodsod', 'intern')
ON CONFLICT (email) DO NOTHING;

-- SCHOOLS
-- Insert educational institutions
INSERT INTO schools (name, address, contact_email, contact_phone) VALUES
    ('FEU Institute of Technology', 'P. Paredes St, Sampaloc, Manila', 'info@feutech.edu.ph', '+63-2-8735-5471'),
    ('University of Caloocan', 'Biglang-Awa St, Caloocan, Metro Manila', 'info@uc.edu.ph', '+63-2-8361-9713')
ON CONFLICT (name) DO NOTHING;

-- SUPERVISORS
-- Insert supervisors who oversee departments and interns
INSERT INTO supervisors (email, first_name, last_name) VALUES
    ('carlo.lagrama@cybersoftbpo.com', 'Carlo', 'Lagrama')
ON CONFLICT (email) DO NOTHING;

-- ================================================================
-- ORGANIZATIONAL ENTITIES
-- ================================================================

-- DEPARTMENTS
-- Insert departments with supervisor assignments
INSERT INTO departments (name, description, supervisor_id) VALUES
    ('MIS', 'Management Information Systems - Handles IT infrastructure and development projects', 
     (SELECT id FROM supervisors WHERE email = 'carlo.lagrama@cybersoftbpo.com')),
    ('HR', 'Human Resources - Manages employee relations and organizational development', 
     (SELECT id FROM supervisors WHERE email = 'carlo.lagrama@cybersoftbpo.com'))
ON CONFLICT (name) DO NOTHING;

-- PROJECTS
-- Insert sample projects for intern assignments
INSERT INTO projects (name, description, department_id, status, start_date, end_date) VALUES
    ('InternHQ Development', 'Development and maintenance of the InternHQ internship management system',
     (SELECT id FROM departments WHERE name = 'MIS'), 'active', '2025-04-01', '2025-08-31'),
    ('Database Optimization', 'Performance optimization and maintenance of company databases',
     (SELECT id FROM departments WHERE name = 'MIS'), 'active', '2025-05-01', '2025-07-31'),
    ('Employee Onboarding System', 'Digital transformation of the employee onboarding process',
     (SELECT id FROM departments WHERE name = 'HR'), 'active', '2025-04-15', '2025-09-15')
ON CONFLICT (name) DO NOTHING;

-- ================================================================
-- RELATIONSHIP ENTITIES
-- ================================================================

-- INTERNSHIP PROGRAMS
-- Create internship programs linking interns to schools, departments, and supervisors
INSERT INTO internship_programs (user_id, school_id, department_id, supervisor_id, required_hours, start_date, end_date, status) VALUES
    -- Jasmine Camasura - FEU Institute of Technology  
    ((SELECT id FROM users WHERE email = 'jasmine.camasura@cybersoftbpo.com'),
     (SELECT id FROM schools WHERE name = 'FEU Institute of Technology'),
     (SELECT id FROM departments WHERE name = 'MIS'),
     (SELECT id FROM supervisors WHERE email = 'carlo.lagrama@cybersoftbpo.com'),
     520, '2025-04-24', '2025-07-18', 'active'),
    
    -- Jireh Walter Sodsod - University of Caloocan
    ((SELECT id FROM users WHERE email = 'jireh.sodsod@cybersoftbpo.com'),
     (SELECT id FROM schools WHERE name = 'University of Caloocan'),
     (SELECT id FROM departments WHERE name = 'MIS'),
     (SELECT id FROM supervisors WHERE email = 'carlo.lagrama@cybersoftbpo.com'),
     480, '2025-05-01', '2025-07-25', 'active')
ON CONFLICT DO NOTHING;

-- PROJECT ASSIGNMENTS
-- Assign interns to projects
INSERT INTO intern_project_assignments (user_id, project_id, assigned_date, role) VALUES
    -- Jasmine Camasura to InternHQ Development project
    ((SELECT id FROM users WHERE email = 'jasmine.camasura@cybersoftbpo.com'),
     (SELECT id FROM projects WHERE name = 'InternHQ Development'),
     '2025-04-24', 'Frontend Developer'),
    
    ((SELECT id FROM users WHERE email = 'jireh.sodsod@cybersoftbpo.com'),
     (SELECT id FROM projects WHERE name = 'Database Optimization'),
     '2025-05-01', 'Database Assistant')
ON CONFLICT (user_id, project_id) DO NOTHING;

-- ================================================================
-- OPERATIONAL DATA
-- ================================================================

-- TIME LOGS
-- Only last 2 weeks of June 2025 for Jasmine Camasura
INSERT INTO time_logs (user_id, time_in, time_out, status, log_type) 
SELECT 
    (SELECT id FROM users WHERE email = 'jasmine.camasura@cybersoftbpo.com'),
    (date_value || ' ' || time_in)::timestamptz,
    (date_value || ' ' || time_out)::timestamptz,
    'completed',
    CASE 
        WHEN (time_out::time - time_in::time) > interval '9 hours' THEN 'overtime'
        ELSE 'regular'
    END
FROM (VALUES
    -- June 2025 (last 2 weeks)
    ('2025-06-11', '09:00:00', '18:37:00'),  -- Regular + 37 min
    ('2025-06-12', '09:00:00', '18:33:00'),  -- Regular + 33 min
    ('2025-06-13', '09:00:00', '21:12:00'),  -- OVERTIME: 12h 12m
    ('2025-06-16', '09:04:00', '20:11:00'),  -- OVERTIME: 11h 7m
    ('2025-06-17', '09:00:00', '21:00:00'),  -- OVERTIME: 12h
    ('2025-06-18', '09:01:00', '18:10:00'),  -- Regular + 9 min
    ('2025-06-19', '09:00:00', '21:09:00'),  -- OVERTIME: 12h 9m
    ('2025-06-20', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-06-23', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-06-24', '09:00:00', '18:00:00')   -- Regular 9h
) AS logs(date_value, time_in, time_out);

-- Only last 2 weeks of June 2025 for Jireh Walter Sodsod
INSERT INTO time_logs (user_id, time_in, time_out, status, log_type)
SELECT 
    (SELECT id FROM users WHERE email = 'jireh.sodsod@cybersoftbpo.com'),
    (date_value || ' ' || time_in)::timestamptz,
    (date_value || ' ' || time_out)::timestamptz,
    'completed',
    CASE 
        WHEN (time_out::time - time_in::time) > interval '9 hours' THEN 'overtime'
        ELSE 'regular'
    END
FROM (VALUES
    -- June 2025 (last 2 weeks)
    ('2025-06-11', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-06-12', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-06-13', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-06-16', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-06-17', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-06-18', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-06-19', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-06-20', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-06-23', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-06-24', '09:00:00', '18:00:00')   -- Regular 9h
) AS logs(date_value, time_in, time_out);

-- ================================================================
-- CONFIGURATION UPDATES
-- ================================================================

-- Update work schedules for all seeded interns
-- Standard 9AM-6PM schedule (Monday to Friday) for all interns
UPDATE users 
SET work_schedule = jsonb_build_object(
    'monday',    jsonb_build_object('start', '09:00', 'end', '18:00'),
    'tuesday',   jsonb_build_object('start', '09:00', 'end', '18:00'),
    'wednesday', jsonb_build_object('start', '09:00', 'end', '18:00'),
    'thursday',  jsonb_build_object('start', '09:00', 'end', '18:00'),
    'friday',    jsonb_build_object('start', '09:00', 'end', '18:00')
)
WHERE email IN (
    'jasmine.camasura@cybersoftbpo.com',
    'jireh.sodsod@cybersoftbpo.com'
) AND role = 'intern';

-- Update overtime logs that exceed regular hours to have proper overtime status
UPDATE time_logs 
SET overtime_status = 'pending' 
WHERE log_type = 'overtime' 
  AND overtime_status IS NULL;

-- ================================================================
-- DATA VERIFICATION
-- ================================================================

-- Verify seeded data counts
DO $$
DECLARE
    user_count INTEGER;
    school_count INTEGER;
    supervisor_count INTEGER;
    department_count INTEGER;
    program_count INTEGER;
    project_count INTEGER;
    assignment_count INTEGER;
    time_log_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO school_count FROM schools;
    SELECT COUNT(*) INTO supervisor_count FROM supervisors;
    SELECT COUNT(*) INTO department_count FROM departments;
    SELECT COUNT(*) INTO program_count FROM internship_programs;
    SELECT COUNT(*) INTO project_count FROM projects;
    SELECT COUNT(*) INTO assignment_count FROM intern_project_assignments;
    SELECT COUNT(*) INTO time_log_count FROM time_logs;
    
    RAISE NOTICE 'InternHQ Database Seeded Successfully:';
    RAISE NOTICE '  - Users: %', user_count;
    RAISE NOTICE '  - Schools: %', school_count;
    RAISE NOTICE '  - Supervisors: %', supervisor_count;
    RAISE NOTICE '  - Departments: %', department_count;
    RAISE NOTICE '  - Internship Programs: %', program_count;
    RAISE NOTICE '  - Projects: %', project_count;
    RAISE NOTICE '  - Project Assignments: %', assignment_count;
    RAISE NOTICE '  - Time Logs: %', time_log_count;
END $$;