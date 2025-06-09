-- Insert sample projects
INSERT INTO projects (id, name, description, start_date, end_date, status, department_id) VALUES
('950e8400-e29b-41d4-a716-446655440001', 'Website Redesign', 'Redesign the company website with modern UI/UX', '2024-01-01', '2024-03-31', 'active', '650e8400-e29b-41d4-a716-446655440001'),
('950e8400-e29b-41d4-a716-446655440002', 'Mobile App Development', 'Create a new mobile app for customer engagement', '2024-01-15', '2024-04-15', 'active', '650e8400-e29b-41d4-a716-446655440001'),
('950e8400-e29b-41d4-a716-446655440003', 'Brand Refresh', 'Update company branding and marketing materials', '2024-02-01', '2024-05-01', 'active', '650e8400-e29b-41d4-a716-446655440003'),
('950e8400-e29b-41d4-a716-446655440004', 'UI Component Library', 'Build a reusable UI component library for all products', '2024-01-10', '2024-03-10', 'active', '650e8400-e29b-41d4-a716-446655440002'),
('950e8400-e29b-41d4-a716-446655440005', 'Data Analytics Dashboard', 'Create an analytics dashboard for business metrics', '2024-02-15', '2024-04-30', 'active', '650e8400-e29b-41d4-a716-446655440001');

-- Assign interns to projects
INSERT INTO intern_project_assignments (user_id, project_id, assigned_date, role) VALUES
('750e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440001', '2024-01-01', 'Frontend Developer'),
('750e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440005', '2024-02-15', 'UI Developer'),
('750e8400-e29b-41d4-a716-446655440003', '950e8400-e29b-41d4-a716-446655440004', '2024-01-10', 'UI Designer'),
('750e8400-e29b-41d4-a716-446655440004', '950e8400-e29b-41d4-a716-446655440003', '2024-02-01', 'Marketing Assistant'),
('750e8400-e29b-41d4-a716-446655440005', '950e8400-e29b-41d4-a716-446655440002', '2024-01-15', 'Mobile Developer'),
('750e8400-e29b-41d4-a716-446655440005', '950e8400-e29b-41d4-a716-446655440005', '2024-02-15', 'Backend Developer');
