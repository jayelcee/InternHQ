-- InternHQ Seed Data
-- Minimal seed for development/testing

-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- USERS
INSERT INTO users (email, password_hash, first_name, last_name, role, work_schedule) VALUES
    ('rhea.masiglat@cybersoftbpo.com', crypt('admin123', gen_salt('bf')), 'Rhea', 'Masiglat', 'admin', NULL),
    ('jasmine.camasura@cybersoftbpo.com', crypt('intern123', gen_salt('bf')), 'Jasmine', 'Camasura', 'intern', 
     jsonb_build_object(
        'monday',    jsonb_build_object('start', '09:00', 'end', '18:00'),
        'tuesday',   jsonb_build_object('start', '09:00', 'end', '18:00'),
        'wednesday', jsonb_build_object('start', '09:00', 'end', '18:00'),
        'thursday',  jsonb_build_object('start', '09:00', 'end', '18:00'),
        'friday',    jsonb_build_object('start', '09:00', 'end', '18:00')
     )),
    ('jireh.sodsod@cybersoftbpo.com', crypt('intern123', gen_salt('bf')), 'Jireh Walter', 'Sodsod', 'intern',
     jsonb_build_object(
        'monday',    jsonb_build_object('start', '09:00', 'end', '18:00'),
        'tuesday',   jsonb_build_object('start', '09:00', 'end', '18:00'),
        'wednesday', jsonb_build_object('start', '09:00', 'end', '18:00'),
        'thursday',  jsonb_build_object('start', '09:00', 'end', '18:00'),
        'friday',    jsonb_build_object('start', '09:00', 'end', '18:00')
     ))
ON CONFLICT (email) DO NOTHING;

-- SCHOOLS
INSERT INTO schools (name, address, contact_email, contact_phone) VALUES
    ('FEU Institute of Technology', 'P. Paredes St, Sampaloc, Manila', 'info@feutech.edu.ph', '+63-2-8735-5471'),
    ('University of Caloocan', 'Biglang-Awa St, Caloocan, Metro Manila', 'info@uc.edu.ph', '+63-2-8361-9713')
ON CONFLICT (name) DO NOTHING;

-- SUPERVISORS
INSERT INTO supervisors (email, first_name, last_name) VALUES
    ('carlo.lagrama@cybersoftbpo.com', 'Carlo', 'Lagrama')
ON CONFLICT (email) DO NOTHING;

-- DEPARTMENTS
INSERT INTO departments (name, description, supervisor_id) VALUES
    ('MIS', 'IT infrastructure and development', (SELECT id FROM supervisors WHERE email = 'carlo.lagrama@cybersoftbpo.com')),
    ('HR', 'Employee relations and development', (SELECT id FROM supervisors WHERE email = 'carlo.lagrama@cybersoftbpo.com'))
ON CONFLICT (name) DO NOTHING;

-- PROJECTS
INSERT INTO projects (name, description, department_id, status, start_date, end_date) VALUES
    ('InternHQ Development', 'InternHQ system development',
     (SELECT id FROM departments WHERE name = 'MIS'), 'active', '2025-04-01', '2025-08-31'),
    ('Database Optimization', 'Database performance optimization',
     (SELECT id FROM departments WHERE name = 'MIS'), 'active', '2025-05-01', '2025-07-31'),
    ('Employee Onboarding System', 'Digital onboarding process',
     (SELECT id FROM departments WHERE name = 'HR'), 'active', '2025-04-15', '2025-09-15')
ON CONFLICT (name) DO NOTHING;

-- INTERNSHIP PROGRAMS
INSERT INTO internship_programs (user_id, school_id, department_id, supervisor_id, required_hours, start_date, end_date, status) VALUES
    ((SELECT id FROM users WHERE email = 'jasmine.camasura@cybersoftbpo.com'),
     (SELECT id FROM schools WHERE name = 'FEU Institute of Technology'),
     (SELECT id FROM departments WHERE name = 'MIS'),
     (SELECT id FROM supervisors WHERE email = 'carlo.lagrama@cybersoftbpo.com'),
     520, '2025-04-24', '2025-07-18', 'active'),
    ((SELECT id FROM users WHERE email = 'jireh.sodsod@cybersoftbpo.com'),
     (SELECT id FROM schools WHERE name = 'University of Caloocan'),
     (SELECT id FROM departments WHERE name = 'MIS'),
     (SELECT id FROM supervisors WHERE email = 'carlo.lagrama@cybersoftbpo.com'),
     480, '2025-05-01', '2025-07-25', 'active')
ON CONFLICT DO NOTHING;

-- USER PROFILES
INSERT INTO user_profiles (user_id, degree, phone, bio) VALUES
    ((SELECT id FROM users WHERE email = 'jasmine.camasura@cybersoftbpo.com'),
     'Bachelor of Science in Computer Science',
     '+63-912-345-6789',
     'Computer Science student with a passion for web development and software engineering.'),
    ((SELECT id FROM users WHERE email = 'jireh.sodsod@cybersoftbpo.com'),
     'Bachelor of Science in Information Technology',
     '+63-923-456-7890',
     'IT student focused on database management and system optimization.')
ON CONFLICT (user_id) DO NOTHING;

-- PROJECT ASSIGNMENTS
INSERT INTO intern_project_assignments (user_id, project_id, assigned_date, role) VALUES
    ((SELECT id FROM users WHERE email = 'jasmine.camasura@cybersoftbpo.com'),
     (SELECT id FROM projects WHERE name = 'InternHQ Development'),
     '2025-04-24', 'Frontend Developer'),
    ((SELECT id FROM users WHERE email = 'jireh.sodsod@cybersoftbpo.com'),
     (SELECT id FROM projects WHERE name = 'Database Optimization'),
     '2025-05-01', 'Database Assistant')
ON CONFLICT (user_id, project_id) DO NOTHING;

-- TIME LOGS (last 2 weeks June 2025)
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
    ('2025-06-11', '09:00:00', '18:37:00'),
    ('2025-06-12', '09:00:00', '18:33:00'),
    ('2025-06-13', '09:00:00', '21:12:00'),
    ('2025-06-16', '09:04:00', '20:11:00'),
    ('2025-06-17', '09:00:00', '21:00:00'),
    ('2025-06-18', '09:01:00', '18:10:00'),
    ('2025-06-19', '09:00:00', '21:09:00'),
    ('2025-06-20', '09:00:00', '18:00:00'),
    ('2025-06-23', '09:00:00', '18:00:00'),
    ('2025-06-24', '09:00:00', '18:00:00')
) AS logs(date_value, time_in, time_out);

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
    ('2025-06-11', '09:00:00', '18:00:00'),
    ('2025-06-12', '09:00:00', '18:00:00'),
    ('2025-06-13', '09:00:00', '18:00:00'),
    ('2025-06-16', '09:00:00', '18:00:00'),
    ('2025-06-17', '09:00:00', '18:00:00'),
    ('2025-06-18', '09:00:00', '18:00:00'),
    ('2025-06-19', '09:00:00', '18:00:00'),
    ('2025-06-20', '09:00:00', '18:00:00'),
    ('2025-06-23', '09:00:00', '18:00:00'),
    ('2025-06-24', '09:00:00', '18:00:00')
) AS logs(date_value, time_in, time_out);

-- OVERTIME STATUS
UPDATE time_logs 
SET overtime_status = 'pending' 
WHERE log_type = 'overtime' 
  AND overtime_status IS NULL;

-- DATA VERIFICATION
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
    
    RAISE NOTICE 'InternHQ Database Seeded:';
    RAISE NOTICE '  Users: %', user_count;
    RAISE NOTICE '  Schools: %', school_count;
    RAISE NOTICE '  Supervisors: %', supervisor_count;
    RAISE NOTICE '  Departments: %', department_count;
    RAISE NOTICE '  Internship Programs: %', program_count;
    RAISE NOTICE '  Projects: %', project_count;
    RAISE NOTICE '  Project Assignments: %', assignment_count;
    RAISE NOTICE '  Time Logs: %', time_log_count;
END $$;