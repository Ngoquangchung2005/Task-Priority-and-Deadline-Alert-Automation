import React, { useMemo, useState } from 'react';
import api from '../../services/api';
import LoadingCompass from '../../components/LoadingCompass';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Download } from 'lucide-react';
import { countBy, emailName, exportCsv, formatDate, isOverdue, isVisibleWorkItem, toChartRows, withDeadlineState } from '../../utils/taskMetrics';

const STATUS_COLORS = {
    PENDING: '#F59E0B',
    TODO: '#94A3B8',
    IN_PROGRESS: '#3B82F6',
    IN_REVIEW: '#8B5CF6',
    OVERDUE: '#EF4444',
    DONE: '#10B981',
    CANCELLED: '#64748B'
};

const getPeriodStart = (dateRange) => {
    if (dateRange === 'all') return null;
    const now = new Date();
    const days = dateRange === 'day' ? 1 : dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : 90;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
};

const withinPeriod = (item, start) => {
    if (!start) return true;
    const value = item.createdAt || item.completedAt || item.deadline;
    return value ? new Date(value) >= start : false;
};

const ManagerReports = () => {
    const [tasks, setTasks] = useState([]);
    const [subtasks, setSubtasks] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState('all');
    const [userFilter, setUserFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [priorityFilter, setPriorityFilter] = useState('ALL');
    const [fetchError, setFetchError] = useState('');

    const fetchReports = async () => {
        try {
            const [taskRes, logRes] = await Promise.all([
                api.get('/tasks'),
                api.get('/notifications')
            ]);
            const taskList = Array.isArray(taskRes.data) ? taskRes.data.map(withDeadlineState) : [];
            setTasks(taskList);
            setLogs(Array.isArray(logRes.data) ? logRes.data : []);

            const subtaskResults = await Promise.allSettled(taskList.map((task) => api.get(`/subtasks/task/${task.id}`)));
            setSubtasks(subtaskResults.flatMap((result) => (
                result.status === 'fulfilled' && Array.isArray(result.value.data)
                    ? result.value.data.map(withDeadlineState)
                    : []
            )));
            setFetchError('');
        } catch (err) {
            console.error('Failed to load reports', err);
            setFetchError(err.response?.data?.message || 'Failed to load report data');
        } finally {
            setLoading(false);
        }
    };

    useAutoRefresh(fetchReports, []);

    const periodStart = useMemo(() => getPeriodStart(dateRange), [dateRange]);
    const visibleSubtasks = useMemo(() => subtasks.filter(isVisibleWorkItem), [subtasks]);

    const userOptions = useMemo(() => {
        const emails = new Set();
        tasks.forEach((task) => task.assigneeEmail && emails.add(task.assigneeEmail));
        visibleSubtasks.forEach((subtask) => subtask.assignedTo && emails.add(subtask.assignedTo));
        return [...emails].sort();
    }, [tasks, visibleSubtasks]);

    const filteredTasks = useMemo(() => tasks.filter((task) => (
        withinPeriod(task, periodStart)
        && (userFilter === 'ALL' || task.assigneeEmail === userFilter)
        && (statusFilter === 'ALL' || task.status === statusFilter)
        && (priorityFilter === 'ALL' || task.priority === priorityFilter)
    )), [tasks, periodStart, userFilter, statusFilter, priorityFilter]);

    const filteredSubtasks = useMemo(() => visibleSubtasks.filter((subtask) => (
        withinPeriod(subtask, periodStart)
        && (userFilter === 'ALL' || subtask.assignedTo === userFilter)
        && (statusFilter === 'ALL' || subtask.status === statusFilter)
        && (priorityFilter === 'ALL' || subtask.priority === priorityFilter)
    )), [visibleSubtasks, periodStart, userFilter, statusFilter, priorityFilter]);

    const filteredLogs = useMemo(() => logs.filter((log) => withinPeriod(log, periodStart)), [logs, periodStart]);

    const completedTasks = filteredTasks.filter((task) => task.status === 'DONE');
    const completedEarly = completedTasks.filter((task) => (
        task.completedAt && task.deadline && new Date(task.completedAt) <= new Date(task.deadline)
    ));
    const overdueTasks = filteredTasks.filter(isOverdue);
    const overdueSubtasks = filteredSubtasks.filter(isOverdue);
    const reminderCount = filteredLogs.filter((log) => log.actionType === 'REMINDER_SENT').length
        || filteredTasks.reduce((sum, task) => sum + (task.reminderCount || 0), 0);

    const stats = {
        totalTasks: filteredTasks.length,
        completedTasks: completedTasks.length,
        overdueTasks: overdueTasks.length,
        totalSubtasks: filteredSubtasks.length,
        subtaskDone: filteredSubtasks.filter((subtask) => subtask.status === 'DONE').length,
        overdueSubtasks: overdueSubtasks.length,
        completedEarly: completedEarly.length,
        reminders: reminderCount
    };

    const taskCompletionRate = stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;
    const subtaskCompletionRate = stats.totalSubtasks > 0 ? Math.round((stats.subtaskDone / stats.totalSubtasks) * 100) : 0;

    const taskStatusData = useMemo(() => (
        toChartRows(countBy(filteredTasks, (task) => task.status))
            .map((row) => ({ ...row, fill: STATUS_COLORS[row.name] || '#64748B' }))
    ), [filteredTasks]);

    const taskByAssignee = useMemo(() => (
        toChartRows(countBy(filteredTasks, (task) => emailName(task.assigneeEmail)))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8)
    ), [filteredTasks]);

    const subtaskByAssignee = useMemo(() => (
        toChartRows(countBy(filteredSubtasks, (subtask) => emailName(subtask.assignedTo)))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8)
    ), [filteredSubtasks]);

    const performanceRows = useMemo(() => {
        const map = {};
        filteredSubtasks.forEach((subtask) => {
            const email = subtask.assignedTo || 'Unassigned';
            const name = emailName(email);
            if (!map[email]) map[email] = { email, name, total: 0, done: 0, overdue: 0 };
            map[email].total++;
            if (subtask.status === 'DONE') map[email].done++;
            if (isOverdue(subtask)) map[email].overdue++;
        });
        return Object.values(map)
            .map((row) => ({ ...row, rate: row.total > 0 ? Math.round((row.done / row.total) * 100) : 0 }))
            .sort((a, b) => b.total - a.total);
    }, [filteredSubtasks]);

    const exportReport = () => {
        const headers = ['Type', 'Parent Task', 'Title', 'Assignee', 'Priority', 'Status', 'Deadline', 'Created At', 'Completed At'];
        const taskRows = filteredTasks.map((task) => [
            'TASK',
            task.taskId,
            task.taskName,
            task.assigneeEmail,
            task.priority,
            task.status,
            task.deadline,
            task.createdAt,
            task.completedAt
        ]);
        const subtaskRows = filteredSubtasks.map((subtask) => [
            'SUBTASK',
            subtask.parentTaskCode || subtask.taskId,
            subtask.title,
            subtask.assignedTo,
            subtask.priority,
            subtask.status,
            subtask.deadline,
            subtask.createdAt,
            ''
        ]);
        exportCsv('task_subtask_report.csv', headers, [...taskRows, ...subtaskRows]);
    };

    if (loading) return <div className="page-loading"><LoadingCompass size={40} /></div>;

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Reports & Analytics</h1>
                    <p className="page-subtitle">Task, subtask, reminder and employee performance insights</p>
                </div>
                <div className="page-header-actions">
                    <select className="filter-select" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                        <option value="all">All Time</option>
                        <option value="day">Last 24 Hours</option>
                        <option value="week">Last 7 Days</option>
                        <option value="month">Last 30 Days</option>
                        <option value="quarter">Last 90 Days</option>
                    </select>
                    <select className="filter-select" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
                        <option value="ALL">All Users</option>
                        {userOptions.map((email) => <option key={email} value={email}>{emailName(email)}</option>)}
                    </select>
                    <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="ALL">All Statuses</option>
                        {['PENDING', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'OVERDUE', 'DONE', 'CANCELLED'].map((status) => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                    <select className="filter-select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                        <option value="ALL">All Priorities</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                    </select>
                    <button className="btn-primary" onClick={exportReport}><Download size={16} /> Export CSV</button>
                </div>
            </div>

            {fetchError && <div className="form-error-banner">{fetchError}</div>}

            <div className="stats-grid-4">
                <div className="glass-panel report-stat-card">
                    <span className="report-stat-label">Total Tasks</span>
                    <span className="report-stat-value">{stats.totalTasks}</span>
                </div>
                <div className="glass-panel report-stat-card">
                    <span className="report-stat-label">Task Done</span>
                    <span className="report-stat-value" style={{ color: '#10B981' }}>{stats.completedTasks}</span>
                </div>
                <div className="glass-panel report-stat-card">
                    <span className="report-stat-label">Task Overdue</span>
                    <span className="report-stat-value" style={{ color: '#EF4444' }}>{stats.overdueTasks}</span>
                </div>
                <div className="glass-panel report-stat-card">
                    <span className="report-stat-label">Task Completion</span>
                    <span className="report-stat-value" style={{ color: '#6366F1' }}>{taskCompletionRate}%</span>
                </div>
                <div className="glass-panel report-stat-card">
                    <span className="report-stat-label">Total Subtasks</span>
                    <span className="report-stat-value">{stats.totalSubtasks}</span>
                </div>
                <div className="glass-panel report-stat-card">
                    <span className="report-stat-label">Subtask Done</span>
                    <span className="report-stat-value" style={{ color: '#10B981' }}>{stats.subtaskDone}</span>
                </div>
                <div className="glass-panel report-stat-card">
                    <span className="report-stat-label">Subtask Overdue</span>
                    <span className="report-stat-value" style={{ color: '#EF4444' }}>{stats.overdueSubtasks}</span>
                </div>
                <div className="glass-panel report-stat-card">
                    <span className="report-stat-label">Reminders</span>
                    <span className="report-stat-value" style={{ color: '#F59E0B' }}>{stats.reminders}</span>
                </div>
            </div>

            <div className="charts-row">
                <div className="glass-panel chart-card">
                    <h3 className="chart-title">Tasks by Status</h3>
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={taskStatusData} barSize={30}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: '#1E293B', border: 'none', borderRadius: '8px', color: '#fff' }} />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                {taskStatusData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="glass-panel chart-card">
                    <h3 className="chart-title">Task by Main Assignee</h3>
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={taskByAssignee} barSize={24}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: '#1E293B', border: 'none', borderRadius: '8px', color: '#fff' }} />
                            <Bar dataKey="value" fill="#6366F1" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="glass-panel chart-card">
                    <h3 className="chart-title">Subtask by Assignee</h3>
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={subtaskByAssignee} barSize={24}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: '#1E293B', border: 'none', borderRadius: '8px', color: '#fff' }} />
                            <Bar dataKey="value" fill="#3B82F6" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bottom-row">
                <div className="glass-panel report-stat-card">
                    <span className="report-stat-label">Subtask Completion Rate</span>
                    <span className="report-stat-value" style={{ color: '#10B981' }}>{subtaskCompletionRate}%</span>
                </div>
                <div className="glass-panel report-stat-card">
                    <span className="report-stat-label">Completed Early Tasks</span>
                    <span className="report-stat-value" style={{ color: '#6366F1' }}>{stats.completedEarly}</span>
                </div>
                <div className="glass-panel report-stat-card">
                    <span className="report-stat-label">Reminder Logs</span>
                    <span className="report-stat-value" style={{ color: '#F59E0B' }}>{filteredLogs.filter((log) => log.actionType === 'REMINDER_SENT').length}</span>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 className="chart-title">Employee Performance by Subtask</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Total</th>
                                <th>Done</th>
                                <th>Overdue</th>
                                <th>DONE / Total</th>
                                <th>Progress</th>
                            </tr>
                        </thead>
                        <tbody>
                            {performanceRows.length === 0 ? (
                                <tr><td colSpan="6" className="table-empty">No subtask performance data</td></tr>
                            ) : performanceRows.map((row) => (
                                <tr key={row.email}>
                                    <td>
                                        <div className="assignee-cell">
                                            <div className="avatar">{row.name.charAt(0).toUpperCase()}</div>
                                            <strong>{row.name}</strong>
                                        </div>
                                    </td>
                                    <td>{row.total}</td>
                                    <td style={{ color: '#10B981', fontWeight: 600 }}>{row.done}</td>
                                    <td style={{ color: '#EF4444', fontWeight: 600 }}>{row.overdue}</td>
                                    <td>{row.done}/{row.total} ({row.rate}%)</td>
                                    <td style={{ width: '150px' }}>
                                        <div className="user-card-bar" style={{ height: '8px' }}>
                                            <div className="bar-segment" style={{ width: `${row.rate}%`, background: '#10B981' }}></div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bottom-row">
                <div className="glass-panel list-card">
                    <h3 className="chart-title" style={{ color: '#EF4444' }}>Overdue Tasks</h3>
                    {overdueTasks.length === 0 ? <p className="no-data-text">No overdue tasks</p> : (
                        <div className="mini-task-list">
                            {overdueTasks.slice(0, 6).map((task) => (
                                <div key={task.id} className="mini-task-item">
                                    <div>
                                        <strong>{task.taskName}</strong>
                                        <span className="mini-task-meta">{emailName(task.assigneeEmail)} · {formatDate(task.deadline)}</span>
                                    </div>
                                    <span className="days-badge danger">{Math.abs(task.daysLeft)}d late</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="glass-panel list-card">
                    <h3 className="chart-title" style={{ color: '#EF4444' }}>Overdue Subtasks</h3>
                    {overdueSubtasks.length === 0 ? <p className="no-data-text">No overdue subtasks</p> : (
                        <div className="mini-task-list">
                            {overdueSubtasks.slice(0, 6).map((subtask) => (
                                <div key={subtask.id} className="mini-task-item">
                                    <div>
                                        <strong>{subtask.title}</strong>
                                        <span className="mini-task-meta">{emailName(subtask.assignedTo)} · {subtask.parentTaskName || 'Parent task'}</span>
                                    </div>
                                    <span className="days-badge danger">{Math.abs(subtask.daysLeft)}d late</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="glass-panel list-card">
                    <h3 className="chart-title">Completed Early</h3>
                    {completedEarly.length === 0 ? <p className="no-data-text">No completed-early tasks</p> : (
                        <div className="mini-task-list">
                            {completedEarly.slice(0, 6).map((task) => (
                                <div key={task.id} className="mini-task-item">
                                    <div>
                                        <strong>{task.taskName}</strong>
                                        <span className="mini-task-meta">Completed {formatDate(task.completedAt)}</span>
                                    </div>
                                    <span className="days-badge info">{formatDate(task.deadline)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManagerReports;
