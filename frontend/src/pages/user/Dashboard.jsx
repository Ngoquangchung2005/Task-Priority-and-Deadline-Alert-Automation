import React, { useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import LoadingCompass from '../../components/LoadingCompass';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CheckCircle, Clock, AlertTriangle, ListTodo } from 'lucide-react';

const UserDashboard = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    const fetchDashboard = async () => {
        try {
            const res = await api.get('/tasks/my-tasks');
            setTasks(res.data.filter(task => !task.archived));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useAutoRefresh(fetchDashboard, []);

    const stats = {
        total: tasks.length,
        inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
        done: tasks.filter(t => t.status === 'DONE').length,
        overdue: tasks.filter(t => t.daysLeft !== null && t.daysLeft < 0 && t.status !== 'DONE').length,
        dueSoon: tasks.filter(t => t.daysLeft !== null && t.daysLeft >= 0 && t.daysLeft <= 3 && t.status !== 'DONE').length,
    };

    const pieData = [
        { name: 'Pending', value: tasks.filter(t => t.status === 'PENDING').length, color: '#F59E0B' },
        { name: 'In Progress', value: stats.inProgress, color: '#818CF8' },
        { name: 'Done', value: stats.done, color: '#10B981' },
        { name: 'Overdue', value: stats.overdue, color: '#EF4444' },
    ].filter(d => d.value > 0);

    const todayTasks = tasks.filter(t => t.daysLeft !== null && t.daysLeft >= 0 && t.daysLeft <= 1 && t.status !== 'DONE');
    const nearestDeadline = tasks
        .filter(t => t.deadline && t.status !== 'DONE')
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0];

    if (loading) return <div className="page-loading"><LoadingCompass size={40} /></div>;

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">My Dashboard</h1>
                    <p className="page-subtitle">Welcome back, {user?.fullName} 👋</p>
                </div>
            </div>

            <div className="stats-grid-5">
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
                    <div className="stat-card-icon" style={{ background: 'rgba(59, 130, 246, 0.12)' }}>
                        <Clock size={22} color="#3B82F6" />
                    </div>
                    <div className="stat-card-body">
                        <span className="stat-label">In Progress</span>
                        <span className="stat-value">{stats.inProgress}</span>
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
                        <span className="stat-label">Overdue</span>
                        <span className="stat-value" style={{ color: '#EF4444' }}>{stats.overdue}</span>
                    </div>
                </div>
                <div className="stat-card-v2 glass-panel">
                    <div className="stat-card-icon" style={{ background: 'rgba(16, 185, 129, 0.12)' }}>
                        <CheckCircle size={22} color="#10B981" />
                    </div>
                    <div className="stat-card-body">
                        <span className="stat-label">Completed</span>
                        <span className="stat-value" style={{ color: '#10B981' }}>{stats.done}</span>
                    </div>
                </div>
            </div>

            <div className="charts-row">
                {/* Progress Chart */}
                <div className="glass-panel chart-card">
                    <h3 className="chart-title">My Progress</h3>
                    {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={5} dataKey="value">
                                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#1E293B', border: 'none', borderRadius: '8px', color: '#fff' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <p className="no-data-text">No tasks yet</p>}
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
                    <h3 className="chart-title">📋 Việc cần làm hôm nay</h3>
                    {todayTasks.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <CheckCircle size={40} color="#10B981" style={{ marginBottom: '0.5rem' }} />
                            <p className="no-data-text">Không có task nào hôm nay. Tuyệt vời!</p>
                        </div>
                    ) : (
                        <div className="mini-task-list">
                            {todayTasks.map(t => (
                                <div key={t.id} className="mini-task-item">
                                    <div>
                                        <strong>{t.taskName}</strong>
                                        <span className={`badge-priority ${t.priority.toLowerCase()}`} style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>{t.priority}</span>
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
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>⏰ Deadline gần nhất</span>
                        <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.1rem' }}>{nearestDeadline.taskName}</h3>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.9rem', color: nearestDeadline.daysLeft <= 1 ? '#EF4444' : '#64748B' }}>
                            {new Date(nearestDeadline.deadline).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div className={`days-badge ${nearestDeadline.daysLeft <= 0 ? 'danger' : nearestDeadline.daysLeft <= 3 ? 'warning' : 'info'}`} style={{ marginTop: '0.25rem', display: 'inline-block' }}>
                            {nearestDeadline.daysLeft < 0 ? `${Math.abs(nearestDeadline.daysLeft)} ngày trễ` : nearestDeadline.daysLeft === 0 ? 'Hôm nay!' : `${nearestDeadline.daysLeft} ngày nữa`}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserDashboard;
