CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insert admin and intern users
INSERT INTO users (email, password_hash, first_name, last_name, role)
VALUES
    ('rhea.masiglat@cybersoftbpo.com', crypt('admin123', gen_salt('bf')), 'Rhea', 'Masiglat', 'admin'),
    ('jasmine.camasura@cybersoftbpo.com', crypt('intern123', gen_salt('bf')), 'Jasmine', 'Camasura', 'intern'),
    ('giro.manzano@cybersoftbpo.com', crypt('intern123', gen_salt('bf')), 'Giro', 'Manzano', 'intern'),
    ('jireh.sodsod@cybersoftbpo.com', crypt('intern123', gen_salt('bf')), 'Jireh Walter', 'Sodsod', 'intern');

-- Insert supervisor
INSERT INTO supervisors (email, first_name, last_name)
VALUES ('carlo.lagrama@cybersoftbpo.com', 'Carlo', 'Lagrama')
ON CONFLICT (email) DO NOTHING;

-- Seed school, department, and internship for FEU Institute of Technology
WITH
    supervisor_row AS (
        SELECT id FROM supervisors WHERE email = 'carlo.lagrama@cybersoftbpo.com'
    ),
    school_insert AS (
        INSERT INTO schools (name)
        VALUES ('FEU Institute of Technology')
        ON CONFLICT (name) DO NOTHING
        RETURNING id
    ),
    department_insert AS (
        INSERT INTO departments (name, supervisor_id)
        SELECT 'MIS', supervisor_row.id FROM supervisor_row
        ON CONFLICT (name) DO NOTHING
        RETURNING id
    )
SELECT 'School and department seeded';

-- Seed school for University of Caloocan
INSERT INTO schools (name)
VALUES ('University of Caloocan')
ON CONFLICT (name) DO NOTHING;

-- Internships
INSERT INTO internship_programs (user_id, school_id, department_id, required_hours, start_date, end_date, supervisor_id)
SELECT u.id, s.id, d.id, 520, '2025-04-23', '2025-07-18', d.supervisor_id
FROM users u
JOIN schools s ON s.name = 'FEU Institute of Technology'
JOIN departments d ON d.name = 'MIS'
WHERE u.email = 'giro.manzano@cybersoftbpo.com';

INSERT INTO internship_programs (user_id, school_id, department_id, required_hours, start_date, end_date, supervisor_id)
SELECT u.id, s.id, d.id, 520, '2025-04-24', '2025-07-18', d.supervisor_id
FROM users u
JOIN schools s ON s.name = 'FEU Institute of Technology'
JOIN departments d ON d.name = 'MIS'
WHERE u.email = 'jasmine.camasura@cybersoftbpo.com';

INSERT INTO internship_programs (user_id, school_id, department_id, required_hours, start_date, end_date, supervisor_id)
SELECT u.id, s.id, d.id, 480, '2025-05-01', '2025-07-25', d.supervisor_id
FROM users u
JOIN schools s ON s.name = 'University of Caloocan'
JOIN departments d ON d.name = 'MIS'
WHERE u.email = 'jireh.sodsod@cybersoftbpo.com';

-- Jasmine Camasura time logs
INSERT INTO time_logs (user_id, time_in, time_out, status)
SELECT
    u.id,
    (d::date || ' ' || t_in)::timestamptz,
    (d::date || ' ' || t_out)::timestamptz,
    'completed'
FROM
    (SELECT id FROM users WHERE email = 'jasmine.camasura@cybersoftbpo.com') u,
    (VALUES
        ('2025-04-24', '09:00:00', '18:00:00'),
        ('2025-04-25', '09:00:00', '18:00:00'),
        ('2025-04-28', '09:00:00', '18:03:00'),
        ('2025-04-29', '09:03:00', '18:05:00'),
        ('2025-04-30', '09:00:00', '18:11:00'),
        ('2025-05-01', '09:01:00', '18:14:00'),
        ('2025-05-02', '09:05:00', '20:13:00'),
        ('2025-05-05', '09:02:00', '19:46:00'),
        ('2025-05-06', '09:00:00', '19:26:00'),
        ('2025-05-07', '09:01:00', '18:22:00'),
        ('2025-05-08', '09:00:00', '21:00:00'),
        ('2025-05-09', '08:42:00', '18:20:00'),
        ('2025-05-13', '09:00:00', '21:00:00'),
        ('2025-05-14', '09:09:00', '18:55:00'),
        ('2025-05-15', '09:00:00', '21:08:00'),
        ('2025-05-16', '08:59:00', '21:04:00'),
        ('2025-05-19', '09:00:00', '20:06:00'),
        ('2025-05-20', '09:00:00', '18:48:00'),
        ('2025-05-21', '09:00:00', '21:00:00'),
        ('2025-05-22', '09:00:00', '21:00:00'),
        ('2025-05-23', '09:00:00', '21:00:00'),
        ('2025-05-24', '09:02:00', '18:51:00'),
        ('2025-05-26', '08:58:00', '21:13:00'),
        ('2025-05-27', '09:00:00', '19:22:00'),
        ('2025-05-28', '09:00:00', '19:41:00'),
        ('2025-05-29', '09:00:00', '21:00:00'),
        ('2025-05-30', '09:00:00', '21:00:00'),
        ('2025-06-02', '09:01:00', '21:01:00'),
        ('2025-06-03', '09:00:00', '19:22:00'),
        ('2025-06-04', '09:00:00', '18:20:00'),
        ('2025-06-05', '09:01:00', '21:00:00'),
        ('2025-06-06', '09:00:00', '21:00:00'),
        ('2025-06-07', '09:16:00', '20:07:00'),
        ('2025-06-09', '09:00:00', '21:01:00'),
        ('2025-06-10', '09:00:00', '21:00:00'),
        ('2025-06-11', '09:00:00', '18:37:00'),
        ('2025-06-12', '09:00:00', '18:33:00'),
        ('2025-06-13', '09:00:00', '21:12:00'),
        ('2025-06-16', '09:04:00', '20:11:00'),
        ('2025-06-17', '09:00:00', '21:00:00'),
        ('2025-06-18', '09:01:00', '18:10:00'),
        ('2025-06-19', '09:00:00', '21:09:00')
    ) AS logs(d, t_in, t_out);

-- Giro Manzano time logs
INSERT INTO time_logs (user_id, time_in, time_out, status)
SELECT
    u.id,
    (d::date || ' ' || t_in)::timestamptz,
    (d::date || ' ' || t_out)::timestamptz,
    'completed'
FROM
    (SELECT id FROM users WHERE email = 'giro.manzano@cybersoftbpo.com') u,
    (VALUES
        ('2025-04-23', '11:43:00', '22:33:00'),
        ('2025-04-24', '11:53:00', '22:00:00'),
        ('2025-04-25', '13:01:00', '22:40:00'),
        ('2025-04-28', '11:00:00', '23:08:00'),
        ('2025-04-29', '12:51:00', '03:18:00'),
        ('2025-04-30', '11:24:00', '23:34:00'),
        ('2025-05-02', '12:47:00', '21:29:00'),
        ('2025-05-05', '09:47:00', '21:43:00'),
        ('2025-05-06', '12:51:00', '21:41:00'),
        ('2025-05-07', '10:55:00', '22:28:00'),
        ('2025-05-08', '12:48:00', '22:29:00'),
        ('2025-05-09', '13:01:00', '23:12:00'),
        ('2025-05-13', '12:44:00', '23:22:00'),
        ('2025-05-14', '09:53:00', '01:07:00'),
        ('2025-05-15', '12:30:00', '23:32:00'),
        ('2025-05-16', '12:41:00', '23:37:00'),
        ('2025-05-19', '10:14:00', '20:20:00'),
        ('2025-05-20', '12:41:00', '01:00:00'),
        ('2025-05-21', '09:59:00', '21:01:00'),
        ('2025-05-22', '12:56:00', '01:33:00'),
        ('2025-05-23', '13:00:00', '22:00:00'),
        ('2025-05-26', '13:00:00', '22:00:00'),
        ('2025-05-27', '13:00:00', '22:00:00'),
        ('2025-05-28', '13:00:00', '23:00:00'),
        ('2025-05-29', '13:00:00', '23:00:00'),
        ('2025-05-30', '13:00:00', '23:00:00'),
        ('2025-06-02', '13:00:00', '23:00:00'),
        ('2025-06-03', '13:00:00', '23:00:00'),
        ('2025-06-04', '13:00:00', '23:00:00'),
        ('2025-06-05', '13:00:00', '23:00:00'),
        ('2025-06-06', '13:00:00', '23:00:00'),
        ('2025-06-09', '13:00:00', '23:00:00'),
        ('2025-06-10', '13:00:00', '23:00:00'),
        ('2025-06-11', '13:00:00', '23:00:00'),
        ('2025-06-12', '13:00:00', '23:00:00'),
        ('2025-06-13', '13:00:00', '23:00:00'),
        ('2025-06-16', '13:00:00', '23:00:00'),
        ('2025-06-17', '13:00:00', '23:00:00'),
        ('2025-06-18', '13:00:00', '23:00:00'),
        ('2025-06-19', '13:00:00', '23:00:00')
    ) AS logs(d, t_in, t_out);

-- Jireh Walter Sodsod time logs
INSERT INTO time_logs (user_id, time_in, time_out, status)
SELECT
    u.id,
    (d::date || ' ' || t_in)::timestamptz,
    (d::date || ' ' || t_out)::timestamptz,
    'completed'
FROM
    (SELECT id FROM users WHERE email = 'jireh.sodsod@cybersoftbpo.com') u,
    (VALUES
        ('2025-05-01', '09:05:00', '18:10:00'),
        ('2025-05-02', '09:00:00', '18:15:00'),
        ('2025-05-05', '09:10:00', '18:05:00'),
        ('2025-05-06', '09:00:00', '18:00:00'),
        ('2025-05-07', '09:03:00', '18:20:00'),
        ('2025-05-08', '09:00:00', '18:10:00'),
        ('2025-05-09', '09:00:00', '18:00:00'),
        ('2025-05-12', '09:00:00', '18:00:00'),
        ('2025-05-13', '09:00:00', '18:00:00'),
        ('2025-05-14', '09:00:00', '18:00:00'),
        ('2025-05-15', '09:00:00', '21:00:00'),
        ('2025-05-16', '09:00:00', '18:00:00'),
        ('2025-05-19', '09:00:00', '18:00:00'),
        ('2025-05-20', '09:00:00', '18:00:00'),
        ('2025-05-21', '09:00:00', '18:00:00'),
        ('2025-05-22', '09:00:00', '18:00:00'),
        ('2025-05-23', '09:00:00', '18:00:00'),
        ('2025-05-26', '09:00:00', '18:00:00'),
        ('2025-05-27', '09:00:00', '18:00:00'),
        ('2025-05-28', '09:00:00', '18:00:00'),
        ('2025-05-29', '09:00:00', '18:00:00'),
        ('2025-05-30', '09:00:00', '18:00:00'),
        ('2025-06-02', '09:00:00', '18:00:00'),
        ('2025-06-03', '09:00:00', '18:00:00'),
        ('2025-06-04', '09:00:00', '18:00:00'),
        ('2025-06-05', '09:00:00', '21:00:00'),
        ('2025-06-06', '09:00:00', '18:00:00'),
        ('2025-06-09', '09:00:00', '18:00:00'),
        ('2025-06-10', '09:00:00', '18:00:00'),
        ('2025-06-11', '09:00:00', '18:00:00'),
        ('2025-06-12', '09:00:00', '18:00:00'),
        ('2025-06-13', '09:00:00', '18:00:00'),
        ('2025-06-16', '09:00:00', '18:00:00'),
        ('2025-06-17', '09:00:00', '18:00:00'),
        ('2025-06-18', '09:00:00', '18:00:00'),
        ('2025-06-19', '09:00:00', '18:00:00')
    ) AS logs(d, t_in, t_out);
