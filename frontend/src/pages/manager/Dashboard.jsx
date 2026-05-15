import React, { useMemo, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import LoadingCompass from '../../components/LoadingCompass';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { AlertTriangle, Archive, Bell, CheckCircle, Clock, Flag, ListTodo, TrendingUp, Users, XCircle } from 'lucide-react';
import { countBy, emailName, isDueSoon, isOpen, isOverdue, isVisibleWorkItem, toChartRows, withDeadlineState } from '../../utils/taskMetrics';

const STATUS_COLORS = {
    PENDING: '#F59E0B',
    TODO: '#94A3B8',
    IN_PROGRESS: '#3B82F6',
    IN_REVIEW: '#8B5CF6',
    OVERDUE: '#EF4444',
    DONE: '#10B981',
    CANCELLED: '#64748B'
};

const ManagerDashboard = () => {
    const [tasks, setTasks] = useState([]);
    const [subtasks, setSubtasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState('');
    const { user } = useAuth();

    const fetchDashboard = async () => {
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
            )));
            setFetchError('');
        } catch (err) {
            console.error('Failed to load dashboard', err);
            setFetchError(err.response?.data?.message || 'Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    useAutoRefresh(fetchDashboard, []);

    const activeTasks = useMemo(() => tasks.filter((task) => !task.archived && task.status !== 'CANCELLED'), [tasks]);
    const visibleSubtasks = useMemo(() => subtasks.filter(isVisibleWorkItem), [subtasks]);
    const openSubtasks = useMemo(() => visibleSubtasks.filter((subtask) => isOpen(subtask)), [visibleSubtasks]);

    const stats = {
        total: tasks.length,
        inProgress: activeTasks.filter((task) => ['IN_PROGRESS', 'IN_REVIEW', 'TODO', 'PENDING', 'OVERDUE'].includes(task.status)).length,
        dueSoon: activeTasks.filter((task) => isDueSoon(task, 3)).length,
        overdue: activeTasks.filter(isOverdue).length,
        done: tasks.filter((task) => task.status === 'DONE').length,
        high: tasks.filter((task) => task.priority === 'HIGH').length,
        cancelled: tasks.filter((task) => task.status === 'CANCELLED').length,
        archived: tasks.filter((task) => task.archived).length,
        totalSubtasks: visibleSubtasks.length,
        subtaskDone: visibleSubtasks.filter((subtask) => subtask.status === 'DONE').length,
        subtaskOpen: openSubtasks.length,
        reminders: tasks.reduce((sum, task) => sum + (task.reminderCount || 0), 0)
    };

    const statusData = useMemo(() => (
        toChartRows(countBy(tasks, (task) => task.status))
            .map((row) => ({ ...row, color: STATUS_COLORS[row.name] || '#64748B' }))
            .filter((row) => row.value > 0)
    ), [tasks]);

    const priorityData = useMemo(() => ([
        { name: 'High', value: tasks.filter((task) => task.priority === 'HIGH').length, fill: '#F43F5E' },
        { name: 'Medium', value: tasks.filter((task) => task.priority === 'MEDIUM').length, fill: '#F59E0B' },
        { name: 'Low', value: tasks.filter((task) => task.priority === 'LOW').length, fill: '#10B981' }
    ]), [tasks]);

    const subtaskByUser = useMemo(() => (
        toChartRows(countBy(visibleSubtasks, (subtask) => emailName(subtask.assignedTo)))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8)
    ), [visibleSubtasks]);

    const completionRate = stats.totalSubtasks > 0
        ? Math.round((stats.subtaskDone / stats.totalSubtasks) * 100)
        : stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

    const dueSoonItems = useMemo(() => ([
        ...activeTasks.filter((task) => isDueSoon(task, 3)).map((task) => ({ ...task, kind: 'Task', title: task.taskName, assignee: task.assigneeEmail })),
        ...visibleSubtasks.filter((subtask) => isDueSoon(subtask, 3)).map((subtask) => ({ ...subtask, kind: 'Subtask', title: subtask.title, assignee: subtask.assignedTo }))
    ].sort((a, b) => (a.daysLeft ?? 99) - (b.daysLeft ?? 99)).slice(0, 6)), [activeTasks, visibleSubtasks]);

    const overdueItems = useMemo(() => ([
        ...activeTasks.filter(isOverdue).map((task) => ({ ...task, kind: 'Task', title: task.taskName, assignee: task.assigneeEmail })),
        ...visibleSubtasks.filter(isOverdue).map((subtask) => ({ ...subtask, kind: 'Subtask', title: subtask.title, assignee: subtask.assignedTo }))
    ].sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0)).slice(0, 6)), [activeTasks, visibleSubtasks]);

    const StatCard = ({ label, value, icon, color = '#6366F1' }) => (
        <div className="stat-card-v2 glass-panel">
            <div className="stat-card-icon" style={{ background: `${color}1f` }}>{icon}</div>
            <div className="stat-card-body">
                <span className="stat-label">{label}</span>
                <span className="stat-value" style={{ color }}>{value}</span>
            </div>
        </div>
    );

    const renderMiniItem = (item) => (
        <div key={`${item.kind}-${item.id}`} className="mini-task-item">
            <div>
                <strong>{item.title}</strong>
                <span className="mini-task-meta">{item.kind} · {emailName(item.assignee)}</span>
            </div>
            <span className={`days-badge ${item.daysLeft < 0 ? 'danger' : 'warning'}`}>
                {item.daysLeft < 0 ? `${Math.abs(item.daysLeft)}d late` : item.daysLeft === 0 ? 'Today' : `${item.daysLeft}d`}
            </span>
        </div>
    );

    if (loading) return <div className="page-loading"><LoadingCompass size={40} /></div>;

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard Overview</h1>
                    <p className="page-subtitle">Welcome back, {user?.fullName || user?.email}</p>
                </div>
            </div>

            {fetchError && <div className="form-error-banner">{fetchError}</div>}

            <div className="stats-grid-6">
                <StatCard label="Total Tasks" value={stats.total} icon={<ListTodo size={22} color="#6366F1" />} />
                <StatCard label="In Progress" value={stats.inProgress} icon={<TrendingUp size={22} color="#3B82F6" />} color="#3B82F6" />
                <StatCard label="Due Soon (3d)" value={stats.dueSoon} icon={<Clock size={22} color="#FB923C" />} color="#FB923C" />
                <StatCard label="Overdue Tasks" value={stats.overdue} icon={<AlertTriangle size={22} color="#EF4444" />} color="#EF4444" />
                <StatCard label="Completed Tasks" value={stats.done} icon={<CheckCircle size={22} color="#10B981" />} color="#10B981" />
                <StatCard label="High Priority" value={stats.high} icon={<Flag size={22} color="#F43F5E" />} color="#F43F5E" />
                <StatCard label="Cancelled" value={stats.cancelled} icon={<XCircle size={22} color="#64748B" />} color="#64748B" />
                <StatCard label="Archived" value={stats.archived} icon={<Archive size={22} color="#64748B" />} color="#64748B" />
                <StatCard label="Total Subtasks" value={stats.totalSubtasks} icon={<Users size={22} color="#6366F1" />} />
                <StatCard label="Subtasks Done" value={stats.subtaskDone} icon={<CheckCircle size={22} color="#10B981" />} color="#10B981" />
                <StatCard label="Subtasks Open" value={stats.subtaskOpen} icon={<TrendingUp size={22} color="#3B82F6" />} color="#3B82F6" />
                <StatCard label="Reminders Sent" value={stats.reminders} icon={<Bell size={22} color="#F59E0B" />} color="#F59E0B" />
            </div>

            <div className="charts-row">
                <div className="glass-panel chart-card">
                    <h3 className="chart-title">Tasks by Status</h3>
                    {statusData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {statusData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#1E293B', border: 'none', borderRadius: '8px', color: '#fff' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <p className="no-data-text">No data yet</p>}
                    <div className="chart-legend">
                        {statusData.map((item) => (
                            <span key={item.name} className="legend-item">
                                <span className="legend-dot" style={{ background: item.color }}></span>
                                {item.name}: {item.value}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="glass-panel chart-card">
                    <h3 className="chart-title">Tasks by Priority</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={priorityData} barSize={36}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                            <Tooltip contentStyle={{ background: '#1E293B', border: 'none', borderRadius: '8px', color: '#fff' }} />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                {priorityData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="glass-panel chart-card">
                    <h3 className="chart-title">Subtasks by User</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={subtaskByUser} barSize={26}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: '#1E293B', border: 'none', borderRadius: '8px', color: '#fff' }} />
                            <Bar dataKey="value" fill="#3B82F6" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="glass-panel chart-card">
                    <h3 className="chart-title">Subtask Completion</h3>
                    <div className="completion-ring">
                        <svg viewBox="0 0 120 120" className="ring-svg">
                            <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="10" />
                            <circle cx="60" cy="60" r="50" fill="none" stroke="#10B981" strokeWidth="10"
                                strokeDasharray={`${completionRate * 3.14} ${314 - completionRate * 3.14}`}
                                strokeLinecap="round" transform="rotate(-90 60 60)" />
                        </svg>
                        <div className="ring-text">
                            <span className="ring-value">{completionRate}%</span>
                            <span className="ring-label">Complete</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bottom-row">
                <div className="glass-panel list-card">
                    <h3 className="chart-title" style={{ color: '#FB923C' }}>Due Soon</h3>
                    {dueSoonItems.length === 0 ? <p className="no-data-text">No tasks or subtasks due soon</p> : (
                        <div className="mini-task-list">{dueSoonItems.map(renderMiniItem)}</div>
                    )}
                </div>

                <div className="glass-panel list-card">
                    <h3 className="chart-title" style={{ color: '#EF4444' }}>Overdue</h3>
                    {overdueItems.length === 0 ? <p className="no-data-text">No overdue tasks or subtasks</p> : (
                        <div className="mini-task-list">{overdueItems.map(renderMiniItem)}</div>
                    )}
                </div>

                <div className="glass-panel list-card">
                    <h3 className="chart-title">Subtask Workload</h3>
                    {subtaskByUser.length === 0 ? <p className="no-data-text">No subtask assignments yet</p> : (
                        <div className="mini-task-list">
                            {subtaskByUser.slice(0, 6).map((userRow) => (
                                <div key={userRow.name} className="mini-task-item">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div className="avatar">{userRow.name.charAt(0).toUpperCase()}</div>
                                        <strong>{userRow.name}</strong>
                                    </div>
                                    <span className="days-badge info">{userRow.value} subtasks</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManagerDashboard;
