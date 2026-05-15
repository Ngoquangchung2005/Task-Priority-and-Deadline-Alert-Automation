import React, { useState } from 'react';
import api from '../../services/api';
import LoadingCompass from '../../components/LoadingCompass';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { Archive, Bell, CheckCircle, Clock, Edit3, Info, RefreshCw, Search, XCircle } from 'lucide-react';
import { formatDateTime } from '../../utils/taskMetrics';

const typeForAction = (actionType) => ({
    CREATED: 'new',
    UPDATED: 'updated',
    REASSIGNED: 'updated',
    DEADLINE_CHANGED: 'updated',
    STATUS_CHANGED: 'status',
    CANCELLED: 'cancelled',
    ARCHIVED: 'archived',
    UNARCHIVED: 'updated',
    REMINDER_SENT: 'reminder',
    ESCALATED: 'escalated',
    COMPLETED: 'completed'
}[actionType] || 'updated');

const iconForAction = (actionType) => ({
    CREATED: <Info size={16} />,
    UPDATED: <Edit3 size={16} />,
    REASSIGNED: <Edit3 size={16} />,
    DEADLINE_CHANGED: <Clock size={16} />,
    STATUS_CHANGED: <RefreshCw size={16} />,
    CANCELLED: <XCircle size={16} />,
    ARCHIVED: <Archive size={16} />,
    UNARCHIVED: <Archive size={16} />,
    REMINDER_SENT: <Bell size={16} />,
    ESCALATED: <Bell size={16} />,
    COMPLETED: <CheckCircle size={16} />
}[actionType] || <Info size={16} />);

const UserNotifications = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [fetchError, setFetchError] = useState('');

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/notifications');
            setLogs(Array.isArray(res.data) ? res.data : []);
            setFetchError('');
        } catch (err) {
            console.error(err);
            setFetchError(err.response?.data?.message || 'Failed to load notifications');
        } finally {
            setLoading(false);
        }
    };

    useAutoRefresh(fetchNotifications, []);

    const notifications = logs.map((log) => ({
        ...log,
        type: typeForAction(log.actionType),
        icon: iconForAction(log.actionType),
        title: `${log.actionType} · ${log.taskName || log.taskCode || 'Task'}`,
        desc: log.actionMessage || log.taskCode || ''
    }));

    const search = searchTerm.trim().toLowerCase();
    const filtered = notifications.filter((notification) => {
        if (tab !== 'all' && notification.type !== tab) return false;
        if (!search) return true;
        return [
            notification.actionType,
            notification.taskName,
            notification.taskCode,
            notification.actionMessage
        ].some((value) => (value || '').toLowerCase().includes(search));
    });

    const countByType = (type) => notifications.filter((notification) => notification.type === type).length;

    if (loading) return <div className="page-loading"><LoadingCompass size={40} /></div>;

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Notifications</h1>
                    <p className="page-subtitle">{notifications.length} thông báo liên quan đến task của bạn</p>
                </div>
                <div className="page-header-actions">
                    <div className="search-container">
                        <Search className="search-icon" size={16} />
                        <input
                            type="text"
                            className="input-glass"
                            placeholder="Search logs..."
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            style={{ paddingLeft: '2.2rem', width: '240px' }}
                        />
                    </div>
                    <button className="btn-glass" onClick={fetchNotifications}><RefreshCw size={16} /> Refresh</button>
                </div>
            </div>

            {fetchError && <div className="form-error-banner">{fetchError}</div>}

            <div className="tab-bar">
                <button className={`tab-btn ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>All ({notifications.length})</button>
                <button className={`tab-btn ${tab === 'new' ? 'active' : ''}`} onClick={() => setTab('new')}>Created ({countByType('new')})</button>
                <button className={`tab-btn ${tab === 'status' ? 'active' : ''}`} onClick={() => setTab('status')}>Status ({countByType('status')})</button>
                <button className={`tab-btn ${tab === 'reminder' ? 'active' : ''}`} onClick={() => setTab('reminder')}>Reminder ({countByType('reminder')})</button>
                <button className={`tab-btn ${tab === 'escalated' ? 'active' : ''}`} onClick={() => setTab('escalated')}>Escalated ({countByType('escalated')})</button>
                <button className={`tab-btn ${tab === 'completed' ? 'active' : ''}`} onClick={() => setTab('completed')}>Completed ({countByType('completed')})</button>
            </div>

            <div className="notifications-list">
                {filtered.length === 0 ? (
                    <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
                        <CheckCircle size={40} color="#10B981" style={{ marginBottom: '1rem' }} />
                        <p className="no-data-text">Không có thông báo mới!</p>
                    </div>
                ) : filtered.map((n, i) => (
                    <div key={n.id || i} className={`notification-item glass-panel ${n.type}`}>
                        <div className={`notif-icon ${n.type}`}>{n.icon}</div>
                        <div className="notif-body">
                            <strong>{n.title}</strong>
                            <span className="notif-desc">{n.desc}</span>
                            <span className="notif-desc">{n.taskCode || 'No task code'} · {formatDateTime(n.createdAt)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default UserNotifications;
