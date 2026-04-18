import React, { useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import LoadingCompass from '../../components/LoadingCompass';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { AlertTriangle, CheckCircle, Clock, ListTodo, TrendingUp, Users } from 'lucide-react';

const ManagerDashboard = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    const fetchTasks = async () => {
        try {
            const res = await api.get('/tasks');
            setTasks(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useAutoRefresh(fetchTasks, []);

    const stats = {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'PENDING').length,
        inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
        done: tasks.filter(t => t.status === 'DONE').length,
        overdue: tasks.filter(t => t.daysLeft !== null && t.daysLeft < 0 && t.status !== 'DONE').length,
        dueSoon: tasks.filter(t => t.daysLeft !== null && t.daysLeft >= 0 && t.daysLeft <= 3 && t.status !== 'DONE').length,
    };

    const pieData = [
        { name: 'Pending', value: stats.pending, color: '#F59E0B' },
        { name: 'In Progress', value: stats.inProgress, color: '#818CF8' },
        { name: 'Done', value: stats.done, color: '#10B981' },
        { name: 'Overdue', value: stats.overdue, color: '#EF4444' },
    ].filter(d => d.value > 0);

    const priorityData = [
        { name: 'High', value: tasks.filter(t => t.priority === 'HIGH').length, fill: '#F43F5E' },
        { name: 'Medium', value: tasks.filter(t => t.priority === 'MEDIUM').length, fill: '#F59E0B' },
        { name: 'Low', value: tasks.filter(t => t.priority === 'LOW').length, fill: '#10B981' },
    ];

    const overdueByUser = {};
    tasks.filter(t => t.daysLeft !== null && t.daysLeft < 0 && t.status !== 'DONE').forEach(t => {
        const name = t.assigneeEmail.split('@')[0];
        overdueByUser[name] = (overdueByUser[name] || 0) + 1;
    });
    const topOverdueUsers = Object.entries(overdueByUser)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

    const upcomingTasks = tasks
        .filter(t => t.daysLeft !== null && t.daysLeft >= 0 && t.daysLeft <= 3 && t.status !== 'DONE')
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 5);

    const overdueTasks = tasks
        .filter(t => t.daysLeft !== null && t.daysLeft < 0 && t.status !== 'DONE')
        .slice(0, 5);

    const completionRate = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

    if (loading) return <div className="page-loading"><LoadingCompass size={40} /></div>;

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard Overview</h1>
                    <p className="page-subtitle">Welcome back, {user?.fullName} 👋</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid-6">
                <div className="stat-card-v2 glass-panel">
                    <div className="stat-card-icon" style={{ background: 'rgba(99, 102, 241, 0.12)' }}>
                        <ListTodo size={22} color="#6366F1" />
                    </div>
                    <div className="stat-card-body">
                        <span className="stat-label">Total Tasks</span>
                        <span className="stat-value">{stats.total}</span>
                    </div>
                </div>
                <div className="stat-card-v2 glass-panel">
                    <div className="stat-card-icon" style={{ background: 'rgba(245, 158, 11, 0.12)' }}>
                        <Clock size={22} color="#F59E0B" />
                    </div>
                    <div className="stat-card-body">
                        <span className="stat-label">Pending</span>
                        <span className="stat-value">{stats.pending}</span>
                    </div>
                </div>
                <div className="stat-card-v2 glass-panel">
                    <div className="stat-card-icon" style={{ background: 'rgba(59, 130, 246, 0.12)' }}>
                        <TrendingUp size={22} color="#3B82F6" />
                    </div>
                    <div className="stat-card-body">
                        <span className="stat-label">In Progress</span>
                        <span className="stat-value">{stats.inProgress}</span>
                    </div>
                </div>
                <div className="stat-card-v2 glass-panel">
                    <div className="stat-card-icon" style={{ background: 'rgba(16, 185, 129, 0.12)' }}>
                        <CheckCircle size={22} color="#10B981" />
                    </div>
                    <div className="stat-card-body">
                        <span className="stat-label">Done</span>
                        <span className="stat-value">{stats.done}</span>
                    </div>
                </div>
                <div className="stat-card-v2 glass-panel">
                    <div className="stat-card-icon" style={{ background: 'rgba(239, 68, 68, 0.12)' }}>
                        <AlertTriangle size={22} color="#EF4444" />
                    </div>
                    <div className="stat-card-body">
                        <span className="stat-label">Overdue</span>
                        <span className="stat-value" style={{ color: '#EF4444' }}>{stats.overdue}</span>
                    </div>
                </div>
                <div className="stat-card-v2 glass-panel">
                    <div className="stat-card-icon" style={{ background: 'rgba(251, 146, 60, 0.12)' }}>
                        <Clock size={22} color="#FB923C" />
                    </div>
                    <div className="stat-card-body">
                        <span className="stat-label">Due Soon (3d)</span>
                        <span className="stat-value" style={{ color: '#FB923C' }}>{stats.dueSoon}</span>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="charts-row">
                <div className="glass-panel chart-card">
                    <h3 className="chart-title">Tasks by Status</h3>
                    {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#1E293B', border: 'none', borderRadius: '8px', color: '#fff' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <p className="no-data-text">No data yet</p>}
                    <div className="chart-legend">
                        {pieData.map((d, i) => (
                            <span key={i} className="legend-item">
                                <span className="legend-dot" style={{ background: d.color }}></span>
                                {d.name}: {d.value}
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
                                {priorityData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="glass-panel chart-card">
                    <h3 className="chart-title">Completion Rate</h3>
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

            {/* Bottom Row */}
            <div className="bottom-row">
                <div className="glass-panel list-card">
                    <h3 className="chart-title" style={{ color: '#FB923C' }}>⏰ Due Soon (3 days)</h3>
                    {upcomingTasks.length === 0 ? <p className="no-data-text">No tasks due soon</p> : (
                        <div className="mini-task-list">
                            {upcomingTasks.map(t => (
                                <div key={t.id} className="mini-task-item">
                                    <div>
                                        <strong>{t.taskName}</strong>
                                        <span className="mini-task-meta">{t.assigneeEmail.split('@')[0]}</span>
                                    </div>
                                    <span className="days-badge warning">{t.daysLeft === 0 ? 'Today' : `${t.daysLeft}d`}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="glass-panel list-card">
                    <h3 className="chart-title" style={{ color: '#EF4444' }}>🔴 Overdue Tasks</h3>
                    {overdueTasks.length === 0 ? <p className="no-data-text">No overdue tasks</p> : (
                        <div className="mini-task-list">
                            {overdueTasks.map(t => (
                                <div key={t.id} className="mini-task-item">
                                    <div>
                                        <strong>{t.taskName}</strong>
                                        <span className="mini-task-meta">{t.assigneeEmail.split('@')[0]}</span>
                                    </div>
                                    <span className="days-badge danger">{Math.abs(t.daysLeft)}d late</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="glass-panel list-card">
                    <h3 className="chart-title">👤 Top Overdue by User</h3>
                    {topOverdueUsers.length === 0 ? <p className="no-data-text">No overdue tasks</p> : (
                        <div className="mini-task-list">
                            {topOverdueUsers.map((u, i) => (
                                <div key={i} className="mini-task-item">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div className="avatar">{u.name.charAt(0).toUpperCase()}</div>
                                        <strong>{u.name}</strong>
                                    </div>
                                    <span className="days-badge danger">{u.count} tasks</span>
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
