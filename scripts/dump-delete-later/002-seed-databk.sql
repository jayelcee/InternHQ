-- Insert sample schools
INSERT INTO schools (id, name, address, contact_email, contact_phone) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'University of Technology', '123 University Ave, Tech City, CA 90210', 'contact@utech.edu', '+1-555-0101'),
('550e8400-e29b-41d4-a716-446655440002', 'Design Institute', '456 Creative Blvd, Art City, CA 90211', 'info@designinst.edu', '+1-555-0102'),
('550e8400-e29b-41d4-a716-446655440003', 'Business College', '789 Commerce St, Business City, CA 90212', 'admin@bizcollege.edu', '+1-555-0103'),
('550e8400-e29b-41d4-a716-446655440004', 'Tech University', '321 Innovation Dr, Silicon Valley, CA 90213', 'hello@techuni.edu', '+1-555-0104');

-- Insert sample departments
INSERT INTO departments (id, name, description) VALUES
('650e8400-e29b-41d4-a716-446655440001', 'Engineering', 'Software development and technical projects'),
('650e8400-e29b-41d4-a716-446655440002', 'Design', 'UI/UX design and creative projects'),
('650e8400-e29b-41d4-a716-446655440003', 'Marketing', 'Digital marketing and brand management'),
('650e8400-e29b-41d4-a716-446655440004', 'HR', 'Human resources and administration');

-- Insert sample users (password is 'password123' hashed with bcrypt)
INSERT INTO users (id, email, password_hash, name, role) VALUES
-- HR Admin
('750e8400-e29b-41d4-a716-446655440001', 'jessica@company.com', '$2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQ', 'Jessica Park', 'hr_admin'),
-- Interns
('750e8400-e29b-41d4-a716-446655440002', 'sarah@company.com', '$2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQ', 'Sarah Johnson', 'intern'),
('750e8400-e29b-41d4-a716-446655440003', 'mike@company.com', '$2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQ', 'Mike Chen', 'intern'),
('750e8400-e29b-41d4-a716-446655440004', 'emily@company.com', '$2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQ', 'Emily Rodriguez', 'intern'),
('750e8400-e29b-41d4-a716-446655440005', 'alex@company.com', '$2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQ', 'Alex Thompson', 'intern');

-- Insert internship programs
INSERT INTO internship_programs (id, user_id, school_id, department_id, required_hours, start_date, end_date) VALUES
('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 480, '2024-01-01', '2024-03-22'),
('850e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440002', 300, '2024-01-15', '2024-03-29'),
('850e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440003', 600, '2023-12-01', '2024-03-15'),
('850e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440004', '650e8400-e29b-41d4-a716-446655440001', 240, '2024-01-08', '2024-03-01');

-- Insert user profiles
INSERT INTO user_profiles (user_id, phone, address, city, state, zip_code, date_of_birth, bio, degree, major, gpa, graduation_date, skills, interests, languages, emergency_contact_name, emergency_contact_relation, emergency_contact_phone) VALUES
('750e8400-e29b-41d4-a716-446655440002', '+1-555-123-4567', '123 Campus Drive', 'University City', 'CA', '90210', '2000-01-15', 'Computer Science student passionate about web development and UI/UX design.', 'Bachelor of Science', 'Computer Science', 3.8, '2025-05-15', ARRAY['JavaScript', 'React', 'UI/UX Design', 'HTML/CSS', 'Node.js'], ARRAY['Web Development', 'Mobile Apps', 'Data Visualization'], ARRAY['English (Native)', 'Spanish (Intermediate)'], 'John Smith', 'Parent', '+1-555-987-6543'),
('750e8400-e29b-41d4-a716-446655440003', '+1-555-234-5678', '456 Design Street', 'Creative City', 'CA', '90211', '1999-08-22', 'Design student with a passion for creating beautiful user experiences.', 'Bachelor of Fine Arts', 'Graphic Design', 3.6, '2025-06-10', ARRAY['Figma', 'Adobe Creative Suite', 'Sketch', 'Prototyping'], ARRAY['UI/UX Design', 'Digital Art', 'Photography'], ARRAY['English (Native)', 'Mandarin (Fluent)'], 'Lisa Chen', 'Parent', '+1-555-876-5432'),
('750e8400-e29b-41d4-a716-446655440004', '+1-555-345-6789', '789 Marketing Ave', 'Business City', 'CA', '90212', '2001-03-10', 'Marketing student interested in digital marketing and brand strategy.', 'Bachelor of Business Administration', 'Marketing', 3.9, '2025-05-20', ARRAY['Digital Marketing', 'Social Media', 'Analytics', 'Content Creation'], ARRAY['Brand Strategy', 'Social Media', 'Content Marketing'], ARRAY['English (Native)', 'French (Intermediate)'], 'Carlos Rodriguez', 'Parent', '+1-555-765-4321'),
('750e8400-e29b-41d4-a716-446655440005', '+1-555-456-7890', '321 Tech Boulevard', 'Silicon Valley', 'CA', '90213', '2000-11-05', 'Computer Engineering student focused on software development and system design.', 'Bachelor of Engineering', 'Computer Engineering', 3.7, '2025-04-30', ARRAY['Python', 'Java', 'C++', 'System Design', 'Databases'], ARRAY['Software Development', 'AI/ML', 'Robotics'], ARRAY['English (Native)'], 'Mary Thompson', 'Parent', '+1-555-654-3210');

-- Insert sample time logs for the past week
INSERT INTO time_logs (user_id, date, time_in, time_out, status) VALUES
-- Sarah Johnson logs
('750e8400-e29b-41d4-a716-446655440002', '2024-01-08', '2024-01-08 08:30:00+00', '2024-01-08 17:15:00+00', 'approved'),
('750e8400-e29b-41d4-a716-446655440002', '2024-01-09', '2024-01-09 08:45:00+00', '2024-01-09 17:30:00+00', 'approved'),
('750e8400-e29b-41d4-a716-446655440002', '2024-01-10', '2024-01-10 08:15:00+00', '2024-01-10 17:00:00+00', 'approved'),
('750e8400-e29b-41d4-a716-446655440002', '2024-01-11', '2024-01-11 08:30:00+00', '2024-01-11 17:20:00+00', 'approved'),
('750e8400-e29b-41d4-a716-446655440002', CURRENT_DATE, '2024-01-12 08:25:00+00', NULL, 'pending'),

-- Mike Chen logs
('750e8400-e29b-41d4-a716-446655440003', '2024-01-08', '2024-01-08 09:00:00+00', '2024-01-08 17:30:00+00', 'approved'),
('750e8400-e29b-41d4-a716-446655440003', '2024-01-09', '2024-01-09 08:45:00+00', '2024-01-09 17:15:00+00', 'approved'),
('750e8400-e29b-41d4-a716-446655440003', '2024-01-10', '2024-01-10 09:15:00+00', '2024-01-10 17:45:00+00', 'approved'),
('750e8400-e29b-41d4-a716-446655440003', '2024-01-11', '2024-01-11 08:30:00+00', '2024-01-11 17:00:00+00', 'approved'),
('750e8400-e29b-41d4-a716-446655440003', CURRENT_DATE, '2024-01-12 08:45:00+00', '2024-01-12 17:00:00+00', 'pending'),

-- Emily Rodriguez logs
('750e8400-e29b-41d4-a716-446655440004', '2024-01-08', '2024-01-08 08:45:00+00', '2024-01-08 17:30:00+00', 'approved'),
('750e8400-e29b-41d4-a716-446655440004', '2024-01-09', '2024-01-09 09:00:00+00', '2024-01-09 17:15:00+00', 'approved'),
('750e8400-e29b-41d4-a716-446655440004', '2024-01-10', '2024-01-10 08:30:00+00', '2024-01-10 17:00:00+00', 'approved'),
('750e8400-e29b-41d4-a716-446655440004', '2024-01-11', '2024-01-11 08:45:00+00', '2024-01-11 17:30:00+00', 'approved'),
('750e8400-e29b-41d4-a716-446655440004', CURRENT_DATE, '2024-01-12 09:00:00+00', '2024-01-12 16:45:00+00', 'pending'),

-- Alex Thompson logs
('750e8400-e29b-41d4-a716-446655440005', '2024-01-08', '2024-01-08 09:15:00+00', '2024-01-08 16:45:00+00', 'approved'),
('750e8400-e29b-41d4-a716-446655440005', '2024-01-09', '2024-01-09 09:00:00+00', '2024-01-09 17:30:00+00', 'approved'),
('750e8400-e29b-41d4-a716-446655440005', '2024-01-10', '2024-01-10 08:45:00+00', '2024-01-10 16:30:00+00', 'approved'),
('750e8400-e29b-41d4-a716-446655440005', '2024-01-11', '2024-01-11 09:30:00+00', '2024-01-11 17:00:00+00', 'approved'),
('750e8400-e29b-41d4-a716-446655440005', CURRENT_DATE, '2024-01-12 09:15:00+00', NULL, 'pending');
