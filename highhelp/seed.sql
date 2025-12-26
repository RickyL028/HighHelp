INSERT INTO users (id, student_id, first_name, last_name, email, role, permission_level, tags, created_at)
VALUES (1, '100000000', 'ricky', 'ricky', 'testing@testing.com', 'student', 0, NULL, '2025-12-26 02:18:53')
ON CONFLICT(id) DO UPDATE SET
    student_id = excluded.student_id,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    email = excluded.email,
    role = excluded.role,
    permission_level = excluded.permission_level,
    tags = excluded.tags;
