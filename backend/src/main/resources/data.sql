-- Optional demo seed for PostgreSQL / Supabase.
-- This file is not auto-run by default. Execute it manually only after the schema exists.

INSERT INTO users (id, full_name, email, password_hash, role, is_active, must_change_password, created_at, updated_at) VALUES
(1, 'Manager Boss', 'manager@gmail.com', '$2b$12$GefBp4cVZ1wNjzrwnDWRnudkM6IU34bRZjPG1ifOL8AGNOcSgq1nu', 'MANAGER', true, false, NOW(), NOW()),
(2, 'User One', 'user1@gmail.com', '$2b$12$GefBp4cVZ1wNjzrwnDWRnudkM6IU34bRZjPG1ifOL8AGNOcSgq1nu', 'USER', true, false, NOW(), NOW()),
(3, 'User Two', 'user2@gmail.com', '$2a$10$EblZqNptyYvcLm/VwDCVAuIssIBsN0.M.OaYF7q14kXf5b0lB6s1i', 'USER', true, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks (id, task_id, task_name, owner_name, assignee_email, manager_email, priority, status, deadline, reminder_count, created_by, created_at, total_sub_task) VALUES
(1, 'TSK-1001', 'Báo cáo doanh thu', 'Manager Boss', 'user1@gmail.com', 'manager@gmail.com', 'HIGH', 'PENDING', NOW() + INTERVAL '2 day', 0, 'manager@gmail.com', NOW(), 3),
(2, 'TSK-1002', 'Họp với khách hàng', 'Manager Boss', 'user2@gmail.com', 'manager@gmail.com', 'MEDIUM', 'IN_PROGRESS', NOW() + INTERVAL '1 day', 1, 'manager@gmail.com', NOW(), 4),
(3, 'TSK-1003', 'Review Code Dự án A', 'Manager Boss', 'user1@gmail.com', 'manager@gmail.com', 'HIGH', 'OVERDUE', NOW() - INTERVAL '2 day', 3, 'manager@gmail.com', NOW(), 0),
(4, 'TSK-1004', 'Dọn dẹp server', 'Manager Boss', 'user2@gmail.com', 'manager@gmail.com', 'LOW', 'DONE', NOW() - INTERVAL '1 day', 0, 'manager@gmail.com', NOW(), 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO task_logs (id, task_id, action_type, action_message, created_at) VALUES
(1, 1, 'CREATED', 'Task created by manager@gmail.com', NOW()),
(2, 3, 'ESCALATED', 'Task overdue, report sent to Manager', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO subtasks (id, title, status, position_index, task_id, created_at) VALUES
(1, 'Thu thập dữ liệu bán hàng Q1', 'TODO', 0, 1, NOW()),
(2, 'Tạo biểu đồ phân tích', 'TODO', 1, 1, NOW()),
(3, 'Viết báo cáo tổng kết', 'TODO', 2, 1, NOW()),
(4, 'Chuẩn bị tài liệu thuyết trình', 'TODO', 0, 2, NOW()),
(5, 'Soạn danh sách câu hỏi', 'IN_PROGRESS', 1, 2, NOW()),
(6, 'Book phòng họp', 'DONE', 2, 2, NOW()),
(7, 'Gửi lịch mời cho khách', 'TODO', 3, 2, NOW())
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1), true);
SELECT setval(pg_get_serial_sequence('tasks', 'id'), COALESCE((SELECT MAX(id) FROM tasks), 1), true);
SELECT setval(pg_get_serial_sequence('task_logs', 'id'), COALESCE((SELECT MAX(id) FROM task_logs), 1), true);
SELECT setval(pg_get_serial_sequence('subtasks', 'id'), COALESCE((SELECT MAX(id) FROM subtasks), 1), true);
