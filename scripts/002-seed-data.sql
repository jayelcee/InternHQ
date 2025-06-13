CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insert admin and intern users
INSERT INTO users (email, password_hash, first_name, last_name, role)
VALUES
    ('rhea.masiglat@cybersoftbpo.com', crypt('admin123', gen_salt('bf')), 'Rhea', 'Masiglat', 'admin'),
    ('jasmine.camasura@cybersoftbpo.com', crypt('intern123', gen_salt('bf')), 'Jasmine', 'Camasura', 'intern');

-- Insert supervisor
INSERT INTO supervisors (email, first_name, last_name)
VALUES ('carlo.lagrama@cybersoftbpo.com', 'Carlo', 'Lagrama');

-- Seed school, department, internship, and profile
WITH
    admin_user AS (
        SELECT id FROM users WHERE email = 'rhea.masiglat@cybersoftbpo.com'
    ),
    intern_user AS (
        SELECT id FROM users WHERE email = 'jasmine.camasura@cybersoftbpo.com'
    ),
    supervisor_row AS (
        SELECT id FROM supervisors WHERE email = 'carlo.lagrama@cybersoftbpo.com'
    ),
    school_insert AS (
        INSERT INTO schools (name, address, contact_email, contact_phone)
        VALUES (
            'FEU Institute of Technology',
            'P. Paredes St., Sampaloc, Manila 1015, Philippines',
            'feutech@fit.edu.ph',
            '+1234567890'
        )
        RETURNING id
    ),
    department_insert AS (
        INSERT INTO departments (name, description, supervisor_id)
        SELECT
            'MIS',
            'Interns work on full-stack projects.',
            supervisor_row.id
        FROM supervisor_row
        RETURNING id
    ),
    internship_insert AS (
        INSERT INTO internship_programs (
            user_id, school_id, department_id, required_hours,
            start_date, end_date, supervisor_id
        )
        SELECT
            intern_user.id,
            school_insert.id,
            department_insert.id,
            520,
            '2025-04-24',
            '2025-07-18',
            supervisor_row.id
        FROM intern_user, school_insert, department_insert, supervisor_row
    ),
    user_profile_insert AS (
        INSERT INTO user_profiles (
            user_id, phone, address, city, country, zip_code,
            date_of_birth, bio, degree, gpa,
            graduation_date, skills, interests, languages,
            emergency_contact_name, emergency_contact_relation, emergency_contact_phone
        )
        SELECT
            intern_user.id,
            '+19876543210',
            '861 Padre Campa St, Sampaloc, Manila',
            'Metro Manila',
            'Philippines',
            '1008',
            '2001-12-03',
            'Motivated intern eager to learn and contribute.',
            'BS Computer Science - Software Engineering',
            3.81,
            '2025-11-04',
            ARRAY['React', 'Node.js', 'PostgreSQL'],
            ARRAY['Web Dev', 'Machine Learning'],
            ARRAY['English', 'Tagalog'],
            'Marife Camasura',
            'Mother',
            '+11234567890'
        FROM intern_user
    )
SELECT 'Seed data inserted.';

-- Insert time logs for Jasmine Camasura
INSERT INTO time_logs (
    user_id, time_in, time_out, task, status
)
SELECT
    iu.id,
    (d::date || ' ' || t_in)::timestamp,
    (d::date || ' ' || t_out)::timestamp,
    'Internship work',
    'completed'
FROM
    (SELECT id FROM users WHERE email = 'jasmine.camasura@cybersoftbpo.com') iu,
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
        ('2025-06-12', '09:00:00', '18:33:00')
    ) AS logs(d, t_in, t_out);
