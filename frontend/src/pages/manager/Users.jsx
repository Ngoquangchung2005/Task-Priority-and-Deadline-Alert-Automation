import React, { useEffect, useState, useMemo } from 'react';
import api from '../../services/api';
import LoadingCompass from '../../components/LoadingCompass';
import { Search, Users as UsersIcon } from 'lucide-react';

const ManagerUsers = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

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

    const userStats = useMemo(() => {
        const map = {};
        tasks.forEach(t => {
            const email = t.assigneeEmail;
            if (!map[email]) map[email] = { email, total: 0, pending: 0, inProgress: 0, done: 0, overdue: 0 };
            map[email].total++;
            if (t.status === 'PENDING') map[email].pending++;
            if (t.status === 'IN_PROGRESS') map[email].inProgress++;
            if (t.status === 'DONE') map[email].done++;
            if (t.daysLeft !== null && t.daysLeft < 0 && t.status !== 'DONE') map[email].overdue++;
        });
        return Object.values(map);
    }, [tasks]);

    const filtered = userStats.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()));

    if (loading) return <div className="page-loading"><LoadingCompass size={40} /></div>;

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">User Management</h1>
                    <p className="page-subtitle">View assignee workload and task distribution</p>
                </div>
                <div className="search-container">
                    <Search className="search-icon" size={16} />
                    <input type="text" className="input-glass" placeholder="Search users..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ paddingLeft: '2.2rem', width: '240px' }} />
                </div>
            </div>

            <div className="users-grid">
                {filtered.length === 0 ? (
                    <p className="no-data-text" style={{ gridColumn: '1 / -1' }}>No users found</p>
                ) : filtered.map(u => (
                    <div key={u.email} className="glass-panel user-card">
                        <div className="user-card-header">
                            <div className="avatar avatar-lg">{u.email.charAt(0).toUpperCase()}</div>
                            <div>
                                <h3 className="user-card-name">{u.email.split('@')[0]}</h3>
                                <p className="user-card-email">{u.email}</p>
                            </div>
                        </div>
                        <div className="user-card-stats">
                            <div className="user-stat">
                                <span className="user-stat-value">{u.total}</span>
                                <span className="user-stat-label">Total</span>
                            </div>
                            <div className="user-stat">
                                <span className="user-stat-value" style={{ color: '#3B82F6' }}>{u.inProgress}</span>
                                <span className="user-stat-label">Active</span>
                            </div>
                            <div className="user-stat">
                                <span className="user-stat-value" style={{ color: '#10B981' }}>{u.done}</span>
                                <span className="user-stat-label">Done</span>
                            </div>
                            <div className="user-stat">
                                <span className="user-stat-value" style={{ color: '#EF4444' }}>{u.overdue}</span>
                                <span className="user-stat-label">Overdue</span>
                            </div>
                        </div>
                        <div className="user-card-bar">
                            {u.total > 0 && (
                                <>
                                    <div className="bar-segment" style={{ width: `${(u.done / u.total) * 100}%`, background: '#10B981' }}></div>
                                    <div className="bar-segment" style={{ width: `${(u.inProgress / u.total) * 100}%`, background: '#3B82F6' }}></div>
                                    <div className="bar-segment" style={{ width: `${(u.pending / u.total) * 100}%`, background: '#F59E0B' }}></div>
                                    <div className="bar-segment" style={{ width: `${(u.overdue / u.total) * 100}%`, background: '#EF4444' }}></div>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ManagerUsers;
