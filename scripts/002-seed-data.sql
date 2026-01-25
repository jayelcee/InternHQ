-- InternHQ Seed Data
-- Minimal seed for development/testing

-- SET TIMEZONE TO PHILIPPINES
SET timezone = 'Asia/Manila';

-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- USERS
INSERT INTO users (email, password_hash, first_name, last_name, role, work_schedule) VALUES
    ('admin@internhq.com', crypt('admin123', gen_salt('bf')), 'Test', 'Admin', 'admin', NULL),
    ('intern@internhq.com', crypt('intern123', gen_salt('bf')), 'Test', 'Intern', 'intern',
     jsonb_build_object(
        'monday',    jsonb_build_object('start', '08:30', 'end', '17:30'),
        'tuesday',   jsonb_build_object('start', '08:30', 'end', '17:30'),
        'wednesday', jsonb_build_object('start', '08:30', 'end', '17:30'),
        'thursday',  jsonb_build_object('start', '08:30', 'end', '17:30'),
        'friday',    jsonb_build_object('start', '08:30', 'end', '17:30')
     )),
    ('jasmine.camasura@internhq.com', crypt('intern123', gen_salt('bf')), 'Jasmine', 'Camasura', 'intern', 
     jsonb_build_object(
        'monday',    jsonb_build_object('start', '09:00', 'end', '18:00'),
        'tuesday',   jsonb_build_object('start', '09:00', 'end', '18:00'),
        'wednesday', jsonb_build_object('start', '09:00', 'end', '18:00'),
        'thursday',  jsonb_build_object('start', '09:00', 'end', '18:00'),
        'friday',    jsonb_build_object('start', '09:00', 'end', '18:00')
     )),
    ('quinn.atkins@internhq.com', crypt('intern123', gen_salt('bf')), 'Quinn', 'Atkins', 'intern',
     jsonb_build_object(
        'monday',    jsonb_build_object('start', '09:00', 'end', '18:00'),
        'tuesday',   jsonb_build_object('start', '09:00', 'end', '18:00'),
        'wednesday', jsonb_build_object('start', '09:00', 'end', '18:00'),
        'thursday',  jsonb_build_object('start', '09:00', 'end', '18:00'),
        'friday',    jsonb_build_object('start', '09:00', 'end', '18:00')
     )),
    ('austin.ford@internhq.com', crypt('intern123', gen_salt('bf')), 'Austin', 'Ford', 'intern',
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
    ('UP Diliman', 'Quezon City, Metro Manila', 'info@upd.edu.ph', '+63-2-8361-9713')
ON CONFLICT (name) DO NOTHING;

-- SUPERVISORS
INSERT INTO supervisors (email, first_name, last_name) VALUES
    ('hong.minki@internhq.com', 'Minki', 'Hong')
ON CONFLICT (email) DO NOTHING;

-- DEPARTMENTS
INSERT INTO departments (name, description, supervisor_id) VALUES
    ('MIS', 'IT infrastructure and development', (SELECT id FROM supervisors WHERE email = 'hong.minki@internhq.com')),
    ('Data Engineering', 'Data pipelines and analytics', (SELECT id FROM supervisors WHERE email = 'hong.minki@internhq.com')),
    ('TSA', 'Technical Support and Assistance', (SELECT id FROM supervisors WHERE email = 'hong.minki@internhq.com'))
ON CONFLICT (name) DO NOTHING;

-- PROJECTS
INSERT INTO projects (name, description, department_id, status, start_date, end_date) VALUES
    ('InternHQ Development', 'InternHQ system development',
     (SELECT id FROM departments WHERE name = 'MIS'), 'active', '2025-04-01', '2025-08-31'),
    ('Database Optimization', 'Database performance optimization',
     (SELECT id FROM departments WHERE name = 'Data Engineering'), 'active', '2025-05-01', '2025-07-31'),
    ('Employee Onboarding System', 'Digital onboarding process',
     (SELECT id FROM departments WHERE name = 'TSA'), 'active', '2025-04-15', '2025-09-15')
ON CONFLICT (name) DO NOTHING;

-- INTERNSHIP PROGRAMS
INSERT INTO internship_programs (user_id, school_id, department_id, supervisor_id, required_hours, start_date, end_date, status) VALUES
    ((SELECT id FROM users WHERE email = 'intern@internhq.com'),
     (SELECT id FROM schools WHERE name = 'FEU Institute of Technology'),
     (SELECT id FROM departments WHERE name = 'MIS'),
     (SELECT id FROM supervisors WHERE email = 'hong.minki@internhq.com'),
     450, '2025-04-15', '2025-07-05', 'active'),
    ((SELECT id FROM users WHERE email = 'jasmine.camasura@internhq.com'),
     (SELECT id FROM schools WHERE name = 'FEU Institute of Technology'),
     (SELECT id FROM departments WHERE name = 'MIS'),
     (SELECT id FROM supervisors WHERE email = 'hong.minki@internhq.com'),
     520, '2025-04-24', '2025-07-18', 'active'),
    ((SELECT id FROM users WHERE email = 'quinn.atkins@internhq.com'),
     (SELECT id FROM schools WHERE name = 'UP Diliman'),
     (SELECT id FROM departments WHERE name = 'Data Engineering'),
     (SELECT id FROM supervisors WHERE email = 'hong.minki@internhq.com'),
     480, '2025-05-01', '2025-07-25', 'active'),
    ((SELECT id FROM users WHERE email = 'austin.ford@internhq.com'),
     (SELECT id FROM schools WHERE name = 'FEU Institute of Technology'),
     (SELECT id FROM departments WHERE name = 'TSA'),
     (SELECT id FROM supervisors WHERE email = 'hong.minki@internhq.com'),
     500, '2025-05-10', '2025-08-10', 'active')
ON CONFLICT DO NOTHING;

-- USER PROFILES
INSERT INTO user_profiles (user_id, degree, phone, bio) VALUES
    ((SELECT id FROM users WHERE email = 'intern@internhq.com'),
     'Bachelor of Science in Information Technology',
     '+63-999-888-7777',
     'Test intern user for development and QA.'),
    ((SELECT id FROM users WHERE email = 'jasmine.camasura@internhq.com'),
     'Bachelor of Science in Computer Science',
     '+63-912-345-6789',
     'Computer Science student with a passion for web development and software engineering.'),
    ((SELECT id FROM users WHERE email = 'quinn.atkins@internhq.com'),
     'Bachelor of Science in Information Technology',
     '+63-923-456-7890',
     'IT student focused on database management and system optimization.'),
    ((SELECT id FROM users WHERE email = 'austin.ford@internhq.com'),
     'Bachelor of Science in Information Systems',
     '+63-900-111-2222',
     'Information Systems student interested in support and automation.')
ON CONFLICT (user_id) DO NOTHING;

-- PROJECT ASSIGNMENTS
INSERT INTO intern_project_assignments (user_id, project_id, assigned_date, role) VALUES
    ((SELECT id FROM users WHERE email = 'intern@internhq.com'),
     (SELECT id FROM projects WHERE name = 'InternHQ Development'),
     '2025-04-15', 'Backend Developer'),
    ((SELECT id FROM users WHERE email = 'jasmine.camasura@internhq.com'),
     (SELECT id FROM projects WHERE name = 'InternHQ Development'),
     '2025-04-24', 'Frontend Developer'),
    ((SELECT id FROM users WHERE email = 'quinn.atkins@internhq.com'),
     (SELECT id FROM projects WHERE name = 'Database Optimization'),
     '2025-05-01', 'Database Assistant'),
    ((SELECT id FROM users WHERE email = 'austin.ford@internhq.com'),
     (SELECT id FROM projects WHERE name = 'Employee Onboarding System'),
     '2025-05-10', 'Support Specialist')
ON CONFLICT (user_id, project_id) DO NOTHING;

INSERT INTO time_logs (user_id, time_in, time_out, status, log_type)
SELECT 
    (SELECT id FROM users WHERE email = 'intern@internhq.com'),
    (date_value || ' ' || time_in || ' Asia/Manila')::timestamptz,
    (date_value_out || ' ' || time_out || ' Asia/Manila')::timestamptz,
    'completed',
    'regular'
FROM (VALUES
    ('2026-01-13', '08:30:00', '2026-01-13', '17:30:00'),
    ('2026-01-14', '08:30:00', '2026-01-14', '17:30:00'),
    ('2026-01-15', '08:30:00', '2026-01-15', '17:35:00'),
    ('2026-01-16', '08:32:00', '2026-01-16', '17:33:00'),
    ('2026-01-17', '08:30:00', '2026-01-17', '17:30:00'),
    ('2026-01-20', '08:28:00', '2026-01-20', '17:38:00'),
    ('2026-01-21', '08:30:00', '2026-01-21', '17:30:00')
) AS logs(date_value, time_in, date_value_out, time_out);

INSERT INTO time_logs (user_id, time_in, time_out, status, log_type)
SELECT 
    (SELECT id FROM users WHERE email = 'jasmine.camasura@internhq.com'),
    (date_value || ' ' || time_in || ' Asia/Manila')::timestamptz,
    (date_value_out || ' ' || time_out || ' Asia/Manila')::timestamptz,
    'completed',
    'regular'
FROM (VALUES
    ('2026-01-13', '09:00:00', '2026-01-13', '18:00:00'),
    ('2026-01-14', '09:00:00', '2026-01-14', '18:00:00'),
    ('2026-01-15', '09:00:00', '2026-01-15', '18:03:00'),
    ('2026-01-16', '09:03:00', '2026-01-16', '18:05:00'),
    ('2026-01-17', '09:00:00', '2026-01-17', '18:11:00'),
    ('2026-01-20', '09:01:00', '2026-01-20', '18:14:00'),
    ('2026-01-21', '09:05:00', '2026-01-21', '20:13:00'),
    ('2026-01-22', '09:02:00', '2026-01-22', '19:46:00'),
    ('2026-01-23', '09:00:00', '2026-01-23', '19:26:00'),
    ('2026-01-24', '09:01:00', '2026-01-24', '18:22:00'),
    ('2026-01-27', '09:00:00', '2026-01-27', '21:00:00'),
    ('2026-01-28', '08:42:00', '2026-01-28', '18:20:00'),
    ('2026-01-29', '09:00:00', '2026-01-29', '18:00:00'),
    ('2026-01-30', '09:00:00', '2026-01-30', '21:00:00'),
    ('2026-01-31', '09:09:00', '2026-01-31', '18:55:00'),
    ('2026-02-03', '09:00:00', '2026-02-03', '21:08:00'),
    ('2026-02-04', '08:59:00', '2026-02-04', '21:04:00'),
    ('2026-02-05', '09:00:00', '2026-02-05', '20:06:00'),
    ('2026-02-06', '09:00:00', '2026-02-06', '18:48:00'),
    ('2026-02-07', '09:00:00', '2026-02-07', '21:00:00'),
    ('2026-02-10', '09:00:00', '2026-02-10', '21:00:00'),
    ('2026-02-11', '08:57:00', '2026-02-11', '21:12:00'),
    ('2026-02-12', '09:00:00', '2026-02-12', '19:22:00'),
    ('2026-02-13', '09:00:00', '2026-02-13', '19:41:00'),
    ('2026-02-14', '09:00:00', '2026-02-14', '21:00:00'),
    ('2026-02-17', '09:00:00', '2026-02-17', '21:00:00'),
    ('2026-02-18', '09:00:00', '2026-02-18', '21:01:00'),
    ('2026-02-19', '09:00:00', '2026-02-19', '19:22:00'),
    ('2026-02-20', '09:00:00', '2026-02-20', '18:20:00'),
    ('2026-02-21', '09:00:00', '2026-02-21', '21:00:00'),
    ('2026-02-24', '09:15:00', '2026-02-24', '20:07:00'),
    ('2026-02-25', '09:00:00', '2026-02-25', '21:00:00'),
    ('2026-02-26', '09:00:00', '2026-02-26', '21:00:00'),
    ('2026-02-27', '09:00:00', '2026-02-27', '18:37:00'),
    ('2026-02-28', '09:00:00', '2026-02-28', '18:33:00'),
    ('2026-03-02', '09:00:00', '2026-03-02', '21:12:00'),
    ('2026-03-03', '09:03:00', '2026-03-03', '20:11:00'),
    ('2026-03-04', '09:00:00', '2026-03-04', '21:00:00'),
    ('2026-03-05', '09:00:00', '2026-03-05', '18:10:00'),
    ('2026-03-06', '09:00:00', '2026-03-07', '01:08:00'),
    ('2026-03-09', '09:00:00', '2026-03-09', '20:46:00'),
    ('2026-03-10', '09:00:00', '2026-03-10', '20:21:00'),
    ('2026-03-11', '09:00:00', '2026-03-11', '19:31:00'),
    ('2026-03-12', '09:01:00', '2026-03-12', '21:00:00'),
    ('2026-03-13', '09:00:00', '2026-03-14', '01:00:00'),
    ('2026-03-16', '09:00:00', '2026-03-16', '21:00:00'),
    ('2026-03-17', '12:00:00', '2026-03-17', '21:43:00'),
    ('2026-03-18', '12:00:00', '2026-03-18', '21:00:00'),
    ('2026-03-19', '09:00:00', '2026-03-19', '18:07:00'),
    ('2026-03-20', '09:00:00', '2026-03-20', '18:31:00')
) AS logs(date_value, time_in, date_value_out, time_out);

INSERT INTO time_logs (user_id, time_in, time_out, status, log_type)
SELECT 
    (SELECT id FROM users WHERE email = 'quinn.atkins@internhq.com'),
    (date_value || ' ' || time_in || ' Asia/Manila')::timestamptz,
    (date_value_out || ' ' || time_out || ' Asia/Manila')::timestamptz,
    'completed',
    'regular'
FROM (VALUES
    ('2026-01-13', '09:00:00', '2026-01-13', '18:00:00'),
    ('2026-01-14', '09:00:00', '2026-01-14', '18:00:00'),
    ('2026-01-15', '09:00:00', '2026-01-15', '18:00:00'),
    ('2026-01-16', '09:00:00', '2026-01-16', '18:00:00'),
    ('2026-01-17', '09:00:00', '2026-01-17', '18:00:00'),
    ('2026-01-20', '09:00:00', '2026-01-20', '18:00:00'),
    ('2026-01-21', '09:00:00', '2026-01-21', '18:00:00'),
    ('2026-01-22', '09:00:00', '2026-01-22', '18:00:00'),
    ('2026-01-23', '09:00:00', '2026-01-23', '18:00:00'),
    ('2026-01-24', '09:00:00', '2026-01-24', '18:00:00')
) AS logs(date_value, time_in, date_value_out, time_out);

INSERT INTO time_logs (user_id, time_in, time_out, status, log_type)
SELECT 
    (SELECT id FROM users WHERE email = 'austin.ford@internhq.com'),
    (date_value || ' ' || time_in || ' Asia/Manila')::timestamptz,
    (date_value_out || ' ' || time_out || ' Asia/Manila')::timestamptz,
    'completed',
    'regular'
FROM (VALUES
    ('2026-01-13', '09:00:00', '2026-01-13', '18:00:00'),
    ('2026-01-14', '09:00:00', '2026-01-14', '18:00:00'),
    ('2026-01-15', '09:00:00', '2026-01-15', '18:00:00'),
    ('2026-01-16', '09:00:00', '2026-01-16', '18:00:00'),
    ('2026-01-17', '09:00:00', '2026-01-17', '18:00:00'),
    ('2026-01-20', '09:00:00', '2026-01-20', '18:00:00'),
    ('2026-01-21', '09:00:00', '2026-01-21', '18:00:00'),
    ('2026-01-22', '09:00:00', '2026-01-22', '18:00:00'),
    ('2026-01-23', '09:00:00', '2026-01-23', '18:00:00'),
    ('2026-01-24', '09:00:00', '2026-01-24', '18:00:00')
) AS logs(date_value, time_in, date_value_out, time_out);

-- Remove the old overtime status update since it's not needed anymore
-- The migration function will handle setting proper overtime_status values

-- NOTES:
-- 1. Jasmine has 7 long logs (>9h), with 2 having extended overtime (>12h)
-- 2. Quinn has only regular 9h logs
-- 3. Use the migration system to properly split these logs after seeding
-- 4. The migration will create proper regular/overtime/extended_overtime segments

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