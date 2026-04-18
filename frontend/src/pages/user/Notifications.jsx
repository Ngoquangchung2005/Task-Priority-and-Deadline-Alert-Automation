import React, { useState } from 'react';
import api from '../../services/api';
import LoadingCompass from '../../components/LoadingCompass';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { Bell, AlertTriangle, Clock, CheckCircle, Info } from 'lucide-react';

const UserNotifications = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/tasks/my-tasks');
            setTasks(res.data.filter(task => !task.archived));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useAutoRefresh(fetchNotifications, []);

    const notifications = [];

    // New tasks (PENDING)
    tasks.filter(t => t.status === 'PENDING').forEach(t => {
        notifications.push({
            type: 'new', icon: <Info size={16} />,
            title: `Bạn được giao task mới: "${t.taskName}"`,
            desc: `Từ ${t.ownerName || t.managerEmail?.split('@')[0] || 'Manager'} · Deadline: ${t.deadline ? new Date(t.deadline).toLocaleDateString('vi-VN') : '—'}`,
        });
    });

    // Due today
    tasks.filter(t => t.daysLeft === 0 && t.status !== 'DONE').forEach(t => {
        notifications.push({
            type: 'today', icon: <Clock size={16} />,
            title: `Task "${t.taskName}" đến hạn hôm nay!`,
            desc: `Hãy hoàn thành trước cuối ngày`,
        });
    });

    // Due soon (1-3 days)
    tasks.filter(t => t.daysLeft !== null && t.daysLeft > 0 && t.daysLeft <= 3 && t.status !== 'DONE').forEach(t => {
        notifications.push({
            type: 'reminder', icon: <Bell size={16} />,
            title: `Gần deadline: "${t.taskName}"`,
            desc: `Còn ${t.daysLeft} ngày`,
        });
    });

    // Overdue
    tasks.filter(t => t.daysLeft !== null && t.daysLeft < 0 && t.status !== 'DONE').forEach(t => {
        notifications.push({
            type: 'overdue', icon: <AlertTriangle size={16} />,
            title: `Task "${t.taskName}" đã quá hạn!`,
            desc: `Trễ ${Math.abs(t.daysLeft)} ngày`,
        });
    });

    if (loading) return <div className="page-loading"><LoadingCompass size={40} /></div>;

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Notifications</h1>
                    <p className="page-subtitle">{notifications.length} thông báo</p>
                </div>
            </div>

            <div className="notifications-list">
                {notifications.length === 0 ? (
                    <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
                        <CheckCircle size={40} color="#10B981" style={{ marginBottom: '1rem' }} />
                        <p className="no-data-text">Không có thông báo mới!</p>
                    </div>
                ) : notifications.map((n, i) => (
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

export default UserNotifications;
