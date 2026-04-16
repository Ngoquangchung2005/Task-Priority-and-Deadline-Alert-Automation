import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import LoadingCompass from '../../components/LoadingCompass';
import { Bell, AlertTriangle, Clock, CheckCircle } from 'lucide-react';

const ManagerNotifications = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('all');

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

    const overdueTasks = tasks.filter(t => t.daysLeft !== null && t.daysLeft < 0 && t.status !== 'DONE');
    const dueTodayTasks = tasks.filter(t => t.daysLeft === 0 && t.status !== 'DONE');
    const escalatedTasks = tasks.filter(t => t.escalatedAt);

    const notifications = [];
    overdueTasks.forEach(t => notifications.push({ type: 'overdue', icon: <AlertTriangle size={16} />, title: `Task "${t.taskName}" is overdue`, desc: `Assigned to ${t.assigneeEmail.split('@')[0]} · ${Math.abs(t.daysLeft)} days late`, time: t.deadline, task: t }));
    dueTodayTasks.forEach(t => notifications.push({ type: 'today', icon: <Clock size={16} />, title: `Task "${t.taskName}" is due today`, desc: `Assigned to ${t.assigneeEmail.split('@')[0]}`, time: t.deadline, task: t }));
    escalatedTasks.forEach(t => notifications.push({ type: 'escalated', icon: <Bell size={16} />, title: `Task "${t.taskName}" was escalated`, desc: `Escalated on ${new Date(t.escalatedAt).toLocaleDateString('vi-VN')}`, time: t.escalatedAt, task: t }));

    const filtered = tab === 'all' ? notifications
        : tab === 'overdue' ? notifications.filter(n => n.type === 'overdue')
        : tab === 'today' ? notifications.filter(n => n.type === 'today')
        : notifications.filter(n => n.type === 'escalated');

    if (loading) return <div className="page-loading"><LoadingCompass size={40} /></div>;

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Notifications</h1>
                    <p className="page-subtitle">{notifications.length} items need your attention</p>
                </div>
            </div>

            <div className="tab-bar">
                <button className={`tab-btn ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>All ({notifications.length})</button>
                <button className={`tab-btn ${tab === 'overdue' ? 'active' : ''}`} onClick={() => setTab('overdue')}>Overdue ({overdueTasks.length})</button>
                <button className={`tab-btn ${tab === 'today' ? 'active' : ''}`} onClick={() => setTab('today')}>Due Today ({dueTodayTasks.length})</button>
                <button className={`tab-btn ${tab === 'escalated' ? 'active' : ''}`} onClick={() => setTab('escalated')}>Escalated ({escalatedTasks.length})</button>
            </div>

            <div className="notifications-list">
                {filtered.length === 0 ? (
                    <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
                        <CheckCircle size={40} color="#10B981" style={{ marginBottom: '1rem' }} />
                        <p className="no-data-text">All clear! No notifications.</p>
                    </div>
                ) : filtered.map((n, i) => (
                    <div key={i} className={`notification-item glass-panel ${n.type}`}>
                        <div className={`notif-icon ${n.type}`}>{n.icon}</div>
                        <div className="notif-body">
                            <strong>{n.title}</strong>
                            <span className="notif-desc">{n.desc}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ManagerNotifications;
