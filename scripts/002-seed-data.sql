CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- INSERT ADMIN AND INTERN USERS
INSERT INTO users (email, password_hash, first_name, last_name, role)
VALUES (
    'rhea.masiglat@cybersoftbpo.com',
    crypt('admin123', gen_salt('bf')),
    'Rhea',
    'Masiglat',
    'admin'
),
(
    'jasmine.camasura@cybersoftbpo.com',
    crypt('intern123', gen_salt('bf')),
    'Jasmine',
    'Camasura',
    'intern'
);

-- SEED SCHOOL, DEPARTMENT, INTERNSHIP, TIME LOG, PROFILE
WITH admin_user AS (
    SELECT id FROM users WHERE email = 'rhea.masiglat@cybersoftbpo.com'
),
intern_user AS (
    SELECT id FROM users WHERE email = 'jasmine.camasura@cybersoftbpo.com'
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
        admin_user.id
    FROM admin_user
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
        300,
        CURRENT_DATE - INTERVAL '14 days',
        CURRENT_DATE + INTERVAL '30 days',
        admin_user.id
    FROM intern_user, school_insert, department_insert, admin_user
),
time_log_insert AS (
    INSERT INTO time_logs (
        user_id, date, time_in, time_out, break_duration,
        notes, status, approved_by, approved_at
    )
    SELECT
        intern_user.id,
        CURRENT_DATE - INTERVAL '1 day',
        CURRENT_DATE - INTERVAL '1 day' + INTERVAL '08:00:00',
        CURRENT_DATE - INTERVAL '1 day' + INTERVAL '17:00:00',
        60,
        'Built React dashboard',
        'approved',
        admin_user.id,
        CURRENT_TIMESTAMP
    FROM intern_user, admin_user
),
user_profile_insert AS (
    INSERT INTO user_profiles (
        user_id, phone, address, city, state, zip_code,
        date_of_birth, bio, degree, major, minor, gpa,
        graduation_date, skills, interests, languages,
        emergency_contact_name, emergency_contact_relation, emergency_contact_phone
    )
    SELECT
        intern_user.id,
        '+19876543210',
        '861 Padre Campa St, Sampaloc, Manila',
        'Metro Manila',
        'PH',
        '1008',
        '2001-12-03',
        'Motivated intern eager to learn and contribute.',
        'BS',
        'Computer Science',
        'Software Engineering',
        3.81,
        '2025-06-01',
        ARRAY['React', 'Node.js', 'PostgreSQL'],
        ARRAY['Web Dev', 'Machine Learning'],
        ARRAY['English', 'Tagalog'],
        'Marife Camasura',
        'Mother',
        '+11234567890'
    FROM intern_user
)
SELECT 'Seed data inserted.';
