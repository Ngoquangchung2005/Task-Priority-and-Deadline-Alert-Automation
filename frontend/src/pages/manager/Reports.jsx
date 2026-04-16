import React, { useEffect, useState, useMemo } from 'react';
import api from '../../services/api';
import LoadingCompass from '../../components/LoadingCompass';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LineChart, Line, Legend } from 'recharts';
import { Download } from 'lucide-react';

const ManagerReports = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState('all');

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await api.get('/tasks');
                setTasks(res.data);
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        };
        fetch();
    }, []);

    const filteredTasks = useMemo(() => {
        if (dateRange === 'all') return tasks;
        const now = new Date();
        const days = dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : 90;
        const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        return tasks.filter(t => new Date(t.createdAt) >= start);
    }, [tasks, dateRange]);

    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === 'DONE').length;
    const overdue = filteredTasks.filter(t => t.daysLeft !== null && t.daysLeft < 0 && t.status !== 'DONE').length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // by user
    const byUser = useMemo(() => {
        const map = {};
        filteredTasks.forEach(t => {
            const name = t.assigneeEmail.split('@')[0];
            if (!map[name]) map[name] = { name, total: 0, done: 0, overdue: 0 };
            map[name].total++;
            if (t.status === 'DONE') map[name].done++;
            if (t.daysLeft !== null && t.daysLeft < 0 && t.status !== 'DONE') map[name].overdue++;
        });
        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [filteredTasks]);

    // by day (last 14 days)
    const byDay = useMemo(() => {
        const days = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            const label = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            const created = filteredTasks.filter(t => t.createdAt && t.createdAt.slice(0, 10) === key).length;
            const done = filteredTasks.filter(t => t.completedAt && t.completedAt.slice(0, 10) === key).length;
            days.push({ label, created, done });
        }
        return days;
    }, [filteredTasks]);

    const exportCSV = () => {
        const headers = ['Task ID', 'Name', 'Assignee', 'Priority', 'Status', 'Deadline', 'Created'];
        const rows = filteredTasks.map(t => [t.taskId, t.taskName, t.assigneeEmail, t.priority, t.status, t.deadline, t.createdAt]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'task_report.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) return <div className="page-loading"><LoadingCompass size={40} /></div>;

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Reports & Analytics</h1>
                    <p className="page-subtitle">Task performance insights</p>
                </div>
                <div className="page-header-actions">
                    <select className="filter-select" value={dateRange} onChange={e => setDateRange(e.target.value)}>
                        <option value="all">All Time</option>
                        <option value="week">Last 7 Days</option>
                        <option value="month">Last 30 Days</option>
                        <option value="quarter">Last 90 Days</option>
                    </select>
                    <button className="btn-primary" onClick={exportCSV}><Download size={16} /> Export CSV</button>
                </div>
            </div>

            <div className="stats-grid-4">
                <div className="glass-panel report-stat-card">
                    <span className="report-stat-label">Total Tasks</span>
                    <span className="report-stat-value">{total}</span>
                </div>
                <div className="glass-panel report-stat-card">
                    <span className="report-stat-label">Completed</span>
                    <span className="report-stat-value" style={{ color: '#10B981' }}>{completed}</span>
                </div>
                <div className="glass-panel report-stat-card">
                    <span className="report-stat-label">Overdue</span>
                    <span className="report-stat-value" style={{ color: '#EF4444' }}>{overdue}</span>
                </div>
                <div className="glass-panel report-stat-card">
                    <span className="report-stat-label">Completion Rate</span>
                    <span className="report-stat-value" style={{ color: '#6366F1' }}>{rate}%</span>
                </div>
            </div>

            <div className="charts-row">
                <div className="glass-panel chart-card" style={{ flex: 2 }}>
                    <h3 className="chart-title">Task Activity (14 days)</h3>
                    <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={byDay}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: '#1E293B', border: 'none', borderRadius: '8px', color: '#fff' }} />
                            <Legend />
                            <Line type="monotone" dataKey="created" stroke="#6366F1" strokeWidth={2} dot={{ r: 3 }} name="Created" />
                            <Line type="monotone" dataKey="done" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} name="Completed" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 className="chart-title">Performance by User</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Total</th>
                                <th>Completed</th>
                                <th>Overdue</th>
                                <th>Completion Rate</th>
                                <th>Progress</th>
                            </tr>
                        </thead>
                        <tbody>
                            {byUser.map(u => (
                                <tr key={u.name}>
                                    <td>
                                        <div className="assignee-cell">
                                            <div className="avatar">{u.name.charAt(0).toUpperCase()}</div>
                                            <strong>{u.name}</strong>
                                        </div>
                                    </td>
                                    <td>{u.total}</td>
                                    <td style={{ color: '#10B981', fontWeight: 600 }}>{u.done}</td>
                                    <td style={{ color: '#EF4444', fontWeight: 600 }}>{u.overdue}</td>
                                    <td>{u.total > 0 ? Math.round((u.done / u.total) * 100) : 0}%</td>
                                    <td style={{ width: '150px' }}>
                                        <div className="user-card-bar" style={{ height: '8px' }}>
                                            <div className="bar-segment" style={{ width: `${u.total > 0 ? (u.done / u.total) * 100 : 0}%`, background: '#10B981' }}></div>
                                            <div className="bar-segment" style={{ width: `${u.total > 0 ? (u.overdue / u.total) * 100 : 0}%`, background: '#EF4444' }}></div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ManagerReports;
