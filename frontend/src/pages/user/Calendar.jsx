import React, { useMemo, useState } from 'react';
import api from '../../services/api';
import LoadingCompass from '../../components/LoadingCompass';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import DeadlineCalendar from '../../components/DeadlineCalendar';
import { isVisibleWorkItem, withDeadlineState } from '../../utils/taskMetrics';

const UserCalendar = () => {
    const [tasks, setTasks] = useState([]);
    const [subtasks, setSubtasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState('');

    const fetchCalendar = async () => {
        try {
            const [taskRes, subtaskRes] = await Promise.all([
                api.get('/tasks/my-tasks'),
                api.get('/subtasks/my')
            ]);
            setTasks((Array.isArray(taskRes.data) ? taskRes.data : [])
                .filter((task) => !task.archived)
                .map(withDeadlineState));
            setSubtasks((Array.isArray(subtaskRes.data) ? subtaskRes.data : [])
                .map(withDeadlineState)
                .filter(isVisibleWorkItem));
            setFetchError('');
        } catch (err) {
            console.error(err);
            setFetchError(err.response?.data?.message || 'Failed to load calendar data');
        } finally {
            setLoading(false);
        }
    };

    useAutoRefresh(fetchCalendar, []);

    const calendarItems = useMemo(() => ([
        ...tasks.map((task) => ({
            id: task.id,
            kind: 'TASK',
            title: task.taskName,
            assignee: task.assigneeEmail,
            priority: task.priority,
            status: task.status,
            deadline: task.deadline,
            daysLeft: task.daysLeft,
            detailTask: task
        })),
        ...subtasks.map((subtask) => ({
            id: subtask.id,
            kind: 'SUBTASK',
            title: subtask.title,
            assignee: subtask.assignedTo,
            parentTaskName: subtask.parentTaskName,
            parentTaskCode: subtask.parentTaskCode,
            priority: subtask.priority,
            status: subtask.status,
            deadline: subtask.deadline,
            daysLeft: subtask.daysLeft,
            detailTask: {
                id: subtask.taskId,
                taskId: subtask.parentTaskCode,
                taskName: subtask.parentTaskName || 'Parent task',
                taskDescription: subtask.parentTaskDescription,
                deadline: subtask.parentDeadline,
                status: subtask.parentStatus || subtask.status,
                priority: subtask.priority,
                totalSubTask: 1
            }
        }))
    ]), [tasks, subtasks]);

    if (loading) return <div className="page-loading"><LoadingCompass size={40} /></div>;

    return (
        <DeadlineCalendar
            title="Calendar & Deadlines"
            subtitle="Parent tasks you own and subtasks assigned to you"
            items={calendarItems}
            loading={loading}
            isUser
            onRefresh={fetchCalendar}
            error={fetchError}
        />
    );
};

export default UserCalendar;
