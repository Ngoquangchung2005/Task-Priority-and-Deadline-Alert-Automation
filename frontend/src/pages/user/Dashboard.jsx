import React, { useMemo, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import LoadingCompass from '../../components/LoadingCompass';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CheckCircle, Clock, AlertTriangle, ListTodo } from 'lucide-react';
import { emailName, formatDateTime, isDueSoon, isOpen, isOverdue, isVisibleWorkItem, withDeadlineState } from '../../utils/taskMetrics';

const UserDashboard = () => {
    const [tasks, setTasks] = useState([]);
    const [subtasks, setSubtasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState('');
    const { user } = useAuth();

    const fetchDashboard = async () => {
        try {
            const [taskRes, subtaskRes] = await Promise.all([
                api.get('/tasks/my-tasks'),
                api.get('/subtasks/my')
            ]);
            setTasks((Array.isArray(taskRes.data) ? taskRes.data : [])
                .filter((task) => !task.archived)
                .map(withDeadlineState));
            setSubtasks((Array.isArray(subtaskRes.data) ? subtaskRes.data : [])
                .map(withDeadlineState));
            setFetchError('');
        } catch (err) {
            console.error(err);
            setFetchError(err.response?.data?.message || 'Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    useAutoRefresh(fetchDashboard, []);

    const visibleSubtasks = useMemo(() => subtasks.filter(isVisibleWorkItem), [subtasks]);
    const activeSubtasks = useMemo(() => visibleSubtasks.filter((subtask) => isOpen(subtask)), [visibleSubtasks]);

    const stats = {
        parentTasks: tasks.length,
        assignedSubtasks: visibleSubtasks.length,
        dueSoon: visibleSubtasks.filter((subtask) => isDueSoon(subtask, 3)).length,
        overdue: visibleSubtasks.filter(isOverdue).length,
        done: visibleSubtasks.filter((subtask) => subtask.status === 'DONE').length,
        open: activeSubtasks.length
    };

    const pieData = [
        { name: 'TODO', value: visibleSubtasks.filter(t => t.status === 'TODO' || t.status === 'PENDING').length, color: '#F59E0B' },
        { name: 'IN_PROGRESS', value: visibleSubtasks.filter(t => t.status === 'IN_PROGRESS').length, color: '#3B82F6' },
        { name: 'IN_REVIEW', value: visibleSubtasks.filter(t => t.status === 'IN_REVIEW').length, color: '#8B5CF6' },
        { name: 'DONE', value: stats.done, color: '#10B981' },
        { name: 'OVERDUE', value: stats.overdue, color: '#EF4444' },
    ].filter(d => d.value > 0);

    const todayItems = [
        ...tasks.filter((task) => isDueSoon(task, 1)).map((task) => ({ ...task, type: 'Task', title: task.taskName, assignee: task.assigneeEmail })),
        ...visibleSubtasks.filter((subtask) => isDueSoon(subtask, 1)).map((subtask) => ({ ...subtask, type: 'Subtask', title: subtask.title, assignee: subtask.assignedTo }))
    ].sort((a, b) => (a.daysLeft ?? 99) - (b.daysLeft ?? 99));

    const nearestDeadline = [
        ...tasks.filter((task) => task.deadline && task.status !== 'DONE').map((task) => ({ ...task, type: 'Task', title: task.taskName })),
        ...visibleSubtasks.filter((subtask) => subtask.deadline && subtask.status !== 'DONE').map((subtask) => ({ ...subtask, type: 'Subtask', title: subtask.title }))
    ].sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0];

    if (loading) return <div className="page-loading"><LoadingCompass size={40} /></div>;

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">My Dashboard</h1>
                    <p className="page-subtitle">Welcome back, {user?.fullName || user?.email}</p>
                </div>
            </div>

            {fetchError && <div className="form-error-banner">{fetchError}</div>}

            <div className="stats-grid-5">
                <div className="stat-card-v2 glass-panel">
                    <div className="stat-card-icon" style={{ background: 'rgba(99, 102, 241, 0.12)' }}>
                        <ListTodo size={22} color="#6366F1" />
                    </div>
                    <div className="stat-card-body">
                        <span className="stat-label">Parent Tasks</span>
                        <span className="stat-value">{stats.parentTasks}</span>
                    </div>
                </div>
                <div className="stat-card-v2 glass-panel">
                    <div className="stat-card-icon" style={{ background: 'rgba(59, 130, 246, 0.12)' }}>
                        <Clock size={22} color="#3B82F6" />
                    </div>
                    <div className="stat-card-body">
                        <span className="stat-label">Assigned Subtasks</span>
                        <span className="stat-value">{stats.assignedSubtasks}</span>
                    </div>
                </div>
                <div className="stat-card-v2 glass-panel">
                    <div className="stat-card-icon" style={{ background: 'rgba(251, 146, 60, 0.12)' }}>
                        <Clock size={22} color="#FB923C" />
                    </div>
                    <div className="stat-card-body">
                        <span className="stat-label">Due Soon</span>
                        <span className="stat-value" style={{ color: '#FB923C' }}>{stats.dueSoon}</span>
                    </div>
                </div>
                <div className="stat-card-v2 glass-panel">
                    <div className="stat-card-icon" style={{ background: 'rgba(239, 68, 68, 0.12)' }}>
                        <AlertTriangle size={22} color="#EF4444" />
                    </div>
                    <div className="stat-card-body">
                        <span className="stat-label">Subtask Overdue</span>
                        <span className="stat-value" style={{ color: '#EF4444' }}>{stats.overdue}</span>
                    </div>
                </div>
                <div className="stat-card-v2 glass-panel">
                    <div className="stat-card-icon" style={{ background: 'rgba(16, 185, 129, 0.12)' }}>
                        <CheckCircle size={22} color="#10B981" />
                    </div>
                    <div className="stat-card-body">
                        <span className="stat-label">Subtask Done</span>
                        <span className="stat-value" style={{ color: '#10B981' }}>{stats.done}</span>
                    </div>
                </div>
            </div>

            <div className="charts-row">
                {/* Progress Chart */}
                <div className="glass-panel chart-card">
                    <h3 className="chart-title">My Subtask Progress</h3>
                    {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={5} dataKey="value">
                                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#1E293B', border: 'none', borderRadius: '8px', color: '#fff' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <p className="no-data-text">No subtasks yet</p>}
                    <div className="chart-legend">
                        {pieData.map((d, i) => (
                            <span key={i} className="legend-item">
                                <span className="legend-dot" style={{ background: d.color }}></span>
                                {d.name}: {d.value}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Today's Tasks */}
                <div className="glass-panel chart-card" style={{ flex: 2 }}>
                    <h3 className="chart-title">Work Due Today</h3>
                    {todayItems.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <CheckCircle size={40} color="#10B981" style={{ marginBottom: '0.5rem' }} />
                            <p className="no-data-text">No tasks or subtasks due today.</p>
                        </div>
                    ) : (
                        <div className="mini-task-list">
                            {todayItems.map(t => (
                                <div key={`${t.type}-${t.id}`} className="mini-task-item">
                                    <div>
                                        <strong>{t.title}</strong>
                                        <span className="mini-task-meta">{t.type} · {emailName(t.assignee)}</span>
                                        {t.priority && (
                                            <span className={`badge-priority ${t.priority.toLowerCase()}`} style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>{t.priority}</span>
                                        )}
                                    </div>
                                    <span className="days-badge warning">{t.daysLeft === 0 ? 'Today' : 'Tomorrow'}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Nearest Deadline */}
            {nearestDeadline && (
                <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nearest deadline</span>
                        <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.1rem' }}>{nearestDeadline.title}</h3>
                        <span className="mini-task-meta">{nearestDeadline.type}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.9rem', color: nearestDeadline.daysLeft <= 1 ? '#EF4444' : '#64748B' }}>
                            {formatDateTime(nearestDeadline.deadline)}
                        </span>
                        <div className={`days-badge ${nearestDeadline.daysLeft <= 0 ? 'danger' : nearestDeadline.daysLeft <= 3 ? 'warning' : 'info'}`} style={{ marginTop: '0.25rem', display: 'inline-block' }}>
                            {nearestDeadline.daysLeft < 0 ? `${Math.abs(nearestDeadline.daysLeft)}d late` : nearestDeadline.daysLeft === 0 ? 'Today' : `${nearestDeadline.daysLeft}d left`}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserDashboard;
