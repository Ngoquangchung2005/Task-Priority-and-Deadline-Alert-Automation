import React, { useMemo, useState } from 'react';
import api from '../../services/api';
import DeadlineCalendar from '../../components/DeadlineCalendar';
import LoadingCompass from '../../components/LoadingCompass';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { isVisibleWorkItem, withDeadlineState } from '../../utils/taskMetrics';

const ManagerCalendar = () => {
    const [tasks, setTasks] = useState([]);
    const [subtasks, setSubtasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState('');

    const fetchCalendar = async () => {
        try {
            const taskRes = await api.get('/tasks');
            const taskList = Array.isArray(taskRes.data) ? taskRes.data.map(withDeadlineState) : [];
            setTasks(taskList);

            const subtaskResults = await Promise.allSettled(
                taskList.map((task) => api.get(`/subtasks/task/${task.id}`))
            );
            setSubtasks(subtaskResults.flatMap((result) => (
                result.status === 'fulfilled' && Array.isArray(result.value.data)
                    ? result.value.data.map(withDeadlineState)
                    : []
            )).filter(isVisibleWorkItem));
            setFetchError('');
        } catch (err) {
            console.error('Failed to load manager calendar', err);
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
            status: task.archived ? 'ARCHIVED' : task.status,
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
            subtitle="All parent tasks and subtasks by deadline"
            items={calendarItems}
            loading={loading}
            onRefresh={fetchCalendar}
            error={fetchError}
        />
    );
};

export default ManagerCalendar;
