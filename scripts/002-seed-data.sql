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
    ('giro.manzano@cybersoftbpo.com', crypt('intern123', gen_salt('bf')), 'Giro', 'Manzano', 'intern'),
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
    -- Giro Manzano - FEU Institute of Technology
    ((SELECT id FROM users WHERE email = 'giro.manzano@cybersoftbpo.com'),
     (SELECT id FROM schools WHERE name = 'FEU Institute of Technology'),
     (SELECT id FROM departments WHERE name = 'MIS'),
     (SELECT id FROM supervisors WHERE email = 'carlo.lagrama@cybersoftbpo.com'),
     520, '2025-04-23', '2025-07-18', 'active'),
    
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
    -- Assign all interns to InternHQ Development project
    ((SELECT id FROM users WHERE email = 'giro.manzano@cybersoftbpo.com'),
     (SELECT id FROM projects WHERE name = 'InternHQ Development'),
     '2025-04-23', 'Full-Stack Developer'),
    
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
-- Historical time tracking data for all interns

-- Jasmine Camasura Time Logs (April 24 - June 24, 2025)
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
    -- April 2025 (Start of internship)
    ('2025-04-24', '09:00:00', '18:00:00'),  -- Regular 9-hour day
    ('2025-04-25', '09:00:00', '18:00:00'),  -- Regular 9-hour day
    ('2025-04-28', '09:00:00', '18:03:00'),  -- Regular + 3 min
    ('2025-04-29', '09:03:00', '18:05:00'),  -- Regular + slight variation
    ('2025-04-30', '09:00:00', '18:11:00'),  -- Regular + 11 min
    
    -- May 2025 (Mixed regular and overtime)
    ('2025-05-01', '09:01:00', '18:14:00'),  -- Regular + 14 min
    ('2025-05-02', '09:05:00', '20:13:00'),  -- OVERTIME: 11h 8m
    ('2025-05-05', '09:02:00', '19:46:00'),  -- OVERTIME: 10h 44m
    ('2025-05-06', '09:00:00', '19:26:00'),  -- OVERTIME: 10h 26m
    ('2025-05-07', '09:01:00', '18:22:00'),  -- Regular + 21 min
    ('2025-05-08', '09:00:00', '21:00:00'),  -- OVERTIME: 12h
    ('2025-05-09', '08:42:00', '18:20:00'),  -- Regular + early start
    ('2025-05-13', '09:00:00', '21:00:00'),  -- OVERTIME: 12h
    ('2025-05-14', '09:09:00', '18:55:00'),  -- Regular + 46 min
    ('2025-05-15', '09:00:00', '21:08:00'),  -- OVERTIME: 12h 8m
    ('2025-05-16', '08:59:00', '21:04:00'),  -- OVERTIME: 12h 5m
    ('2025-05-19', '09:00:00', '20:06:00'),  -- OVERTIME: 11h 6m
    ('2025-05-20', '09:00:00', '18:48:00'),  -- Regular + 48 min
    ('2025-05-21', '09:00:00', '21:00:00'),  -- OVERTIME: 12h
    ('2025-05-22', '09:00:00', '21:00:00'),  -- OVERTIME: 12h
    ('2025-05-23', '09:00:00', '21:00:00'),  -- OVERTIME: 12h
    ('2025-05-24', '09:02:00', '18:51:00'),  -- Regular + 49 min
    ('2025-05-26', '08:58:00', '21:13:00'),  -- OVERTIME: 12h 15m
    ('2025-05-27', '09:00:00', '19:22:00'),  -- OVERTIME: 10h 22m
    ('2025-05-28', '09:00:00', '19:41:00'),  -- OVERTIME: 10h 41m
    ('2025-05-29', '09:00:00', '21:00:00'),  -- OVERTIME: 12h
    ('2025-05-30', '09:00:00', '21:00:00'),  -- OVERTIME: 12h
    
    -- June 2025 (Continued mixed schedule)
    ('2025-06-02', '09:01:00', '21:01:00'),  -- OVERTIME: 12h
    ('2025-06-03', '09:00:00', '19:22:00'),  -- OVERTIME: 10h 22m
    ('2025-06-04', '09:00:00', '18:20:00'),  -- Regular + 20 min
    ('2025-06-05', '09:01:00', '21:00:00'),  -- OVERTIME: 11h 59m
    ('2025-06-06', '09:00:00', '21:00:00'),  -- OVERTIME: 12h
    ('2025-06-07', '09:16:00', '20:07:00'),  -- OVERTIME: 10h 51m
    ('2025-06-09', '09:00:00', '21:01:00'),  -- OVERTIME: 12h 1m
    ('2025-06-10', '09:00:00', '21:00:00'),  -- OVERTIME: 12h
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

-- Giro Manzano Time Logs (April 23 - June 24, 2025)
-- Note: Giro has a different schedule (afternoon/evening shift)
INSERT INTO time_logs (user_id, time_in, time_out, status, log_type)
SELECT 
    (SELECT id FROM users WHERE email = 'giro.manzano@cybersoftbpo.com'),
    (date_value || ' ' || time_in)::timestamptz,
    (date_value || ' ' || time_out)::timestamptz,
    'completed',
    CASE 
        WHEN (time_out::time - time_in::time) > interval '10 hours' THEN 'overtime'
        ELSE 'regular'
    END
FROM (VALUES
    -- April 2025 (Start of internship - irregular schedule)
    ('2025-04-23', '11:43:00', '22:33:00'),  -- OVERTIME: 10h 50m
    ('2025-04-24', '11:53:00', '22:00:00'),  -- OVERTIME: 10h 7m
    ('2025-04-25', '13:01:00', '22:40:00'),  -- Regular 9h 39m
    ('2025-04-28', '11:00:00', '23:08:00'),  -- OVERTIME: 12h 8m
    ('2025-04-29', '12:51:00', '03:18:00'),  -- OVERTIME: 14h 27m (next day)
    ('2025-04-30', '11:24:00', '23:34:00'),  -- OVERTIME: 12h 10m
    
    -- May 2025 (More consistent afternoon schedule)
    ('2025-05-02', '12:47:00', '21:29:00'),  -- Regular 8h 42m
    ('2025-05-05', '09:47:00', '21:43:00'),  -- OVERTIME: 11h 56m
    ('2025-05-06', '12:51:00', '21:41:00'),  -- Regular 8h 50m
    ('2025-05-07', '10:55:00', '22:28:00'),  -- OVERTIME: 11h 33m
    ('2025-05-08', '12:48:00', '22:29:00'),  -- Regular 9h 41m
    ('2025-05-09', '13:01:00', '23:12:00'),  -- OVERTIME: 10h 11m
    ('2025-05-13', '12:44:00', '23:22:00'),  -- OVERTIME: 10h 38m
    ('2025-05-14', '09:53:00', '01:07:00'),  -- OVERTIME: 15h 14m (next day)
    ('2025-05-15', '12:30:00', '23:32:00'),  -- OVERTIME: 11h 2m
    ('2025-05-16', '12:41:00', '23:37:00'),  -- OVERTIME: 10h 56m
    ('2025-05-19', '10:14:00', '20:20:00'),  -- OVERTIME: 10h 6m
    ('2025-05-20', '12:41:00', '01:00:00'),  -- OVERTIME: 12h 19m (next day)
    ('2025-05-21', '09:59:00', '21:01:00'),  -- OVERTIME: 11h 2m
    ('2025-05-22', '12:56:00', '01:33:00'),  -- OVERTIME: 12h 37m (next day)
    ('2025-05-23', '13:00:00', '22:00:00'),  -- Regular 9h
    
    -- Late May/June 2025 (Standardized 13:00-23:00 schedule)
    ('2025-05-26', '13:00:00', '23:00:00'),  -- OVERTIME: 10h
    ('2025-05-27', '13:00:00', '23:00:00'),  -- OVERTIME: 10h
    ('2025-05-28', '13:00:00', '23:00:00'),  -- OVERTIME: 10h
    ('2025-05-29', '13:00:00', '23:00:00'),  -- OVERTIME: 10h
    ('2025-05-30', '13:00:00', '23:00:00'),  -- OVERTIME: 10h
    ('2025-06-02', '13:00:00', '23:00:00'),  -- OVERTIME: 10h
    ('2025-06-03', '13:00:00', '23:00:00'),  -- OVERTIME: 10h
    ('2025-06-04', '13:00:00', '23:00:00'),  -- OVERTIME: 10h
    ('2025-06-05', '13:00:00', '23:00:00'),  -- OVERTIME: 10h
    ('2025-06-06', '13:00:00', '23:00:00'),  -- OVERTIME: 10h
    ('2025-06-09', '13:00:00', '23:00:00'),  -- OVERTIME: 10h
    ('2025-06-10', '13:00:00', '23:00:00'),  -- OVERTIME: 10h
    ('2025-06-11', '13:00:00', '23:00:00'),  -- OVERTIME: 10h
    ('2025-06-12', '13:00:00', '23:00:00'),  -- OVERTIME: 10h
    ('2025-06-13', '13:00:00', '23:00:00'),  -- OVERTIME: 10h
    ('2025-06-16', '13:00:00', '23:00:00'),  -- OVERTIME: 10h
    ('2025-06-17', '13:00:00', '23:00:00'),  -- OVERTIME: 10h
    ('2025-06-18', '13:00:00', '23:00:00'),  -- OVERTIME: 10h
    ('2025-06-19', '13:00:00', '23:00:00'),  -- OVERTIME: 10h
    ('2025-06-20', '13:00:00', '23:00:00'),  -- OVERTIME: 10h
    ('2025-06-23', '13:00:00', '23:00:00'),  -- OVERTIME: 10h
    ('2025-06-24', '13:00:00', '23:00:00')   -- OVERTIME: 10h
) AS logs(date_value, time_in, time_out);

-- Jireh Walter Sodsod Time Logs (May 1 - June 24, 2025)
-- Note: Jireh follows a standard 9-6 schedule with minimal overtime
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
    -- May 2025 (Start of internship - consistent 9-6 schedule)
    ('2025-05-01', '09:05:00', '18:10:00'),  -- Regular 9h 5m
    ('2025-05-02', '09:00:00', '18:15:00'),  -- Regular 9h 15m
    ('2025-05-05', '09:10:00', '18:05:00'),  -- Regular 8h 55m
    ('2025-05-06', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-05-07', '09:03:00', '18:20:00'),  -- Regular 9h 17m
    ('2025-05-08', '09:00:00', '18:10:00'),  -- Regular 9h 10m
    ('2025-05-09', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-05-12', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-05-13', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-05-14', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-05-15', '09:00:00', '21:00:00'),  -- OVERTIME: 12h (rare overtime)
    ('2025-05-16', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-05-19', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-05-20', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-05-21', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-05-22', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-05-23', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-05-26', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-05-27', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-05-28', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-05-29', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-05-30', '09:00:00', '18:00:00'),  -- Regular 9h
    
    -- June 2025 (Continued standard schedule)
    ('2025-06-02', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-06-03', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-06-04', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-06-05', '09:00:00', '21:00:00'),  -- OVERTIME: 12h (rare overtime)
    ('2025-06-06', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-06-09', '09:00:00', '18:00:00'),  -- Regular 9h
    ('2025-06-10', '09:00:00', '18:00:00'),  -- Regular 9h
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
    'giro.manzano@cybersoftbpo.com',
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
