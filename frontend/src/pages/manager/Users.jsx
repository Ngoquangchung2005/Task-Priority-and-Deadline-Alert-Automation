import React, { useMemo, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import LoadingCompass from '../../components/LoadingCompass';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { AlertTriangle, CheckCircle, Eye, KeyRound, Lock, RefreshCw, Search, Shield, Unlock, UserCheck, Users as UsersIcon } from 'lucide-react';
import { emailName, formatDate, isOverdue, withDeadlineState } from '../../utils/taskMetrics';

const statusLabel = (status) => ({
    PENDING: 'Pending',
    TODO: 'To Do',
    IN_PROGRESS: 'In Progress',
    IN_REVIEW: 'In Review',
    OVERDUE: 'Overdue',
    DONE: 'Done',
    CANCELLED: 'Cancelled'
}[status] || status || '-');

const statusClass = (status) => ({
    DONE: 'done',
    IN_PROGRESS: 'in-progress',
    IN_REVIEW: 'in-review',
    PENDING: 'pending',
    TODO: 'pending',
    OVERDUE: 'danger',
    CANCELLED: 'danger'
}[status] || 'pending');

const ManagerUsers = () => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [subtasks, setSubtasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [activeFilter, setActiveFilter] = useState('ALL');
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [toast, setToast] = useState(null);

    const fetchUsers = async () => {
        try {
            const [userRes, taskRes] = await Promise.all([
                api.get('/users'),
                api.get('/tasks')
            ]);

            const taskList = Array.isArray(taskRes.data) ? taskRes.data.map(withDeadlineState) : [];
            setUsers(Array.isArray(userRes.data) ? userRes.data : []);
            setTasks(taskList);

            const subtaskResults = await Promise.allSettled(
                taskList.map((task) => api.get(`/subtasks/task/${task.id}`))
            );
            setSubtasks(subtaskResults.flatMap((result) => (
                result.status === 'fulfilled' && Array.isArray(result.value.data)
                    ? result.value.data.map(withDeadlineState)
                    : []
            )));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useAutoRefresh(fetchUsers, []);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const usersWithStats = useMemo(() => (
        users.map((account) => {
            const parentTasks = tasks.filter((task) => task.assigneeEmail?.toLowerCase() === account.email.toLowerCase());
            const assignedSubtasks = subtasks.filter((subtask) => subtask.assignedTo?.toLowerCase() === account.email.toLowerCase());
            return {
                ...account,
                parentTasks,
                assignedSubtasks,
                parentTotal: parentTasks.length,
                parentDone: parentTasks.filter((task) => task.status === 'DONE').length,
                parentOpen: parentTasks.filter((task) => !['DONE', 'CANCELLED'].includes(task.status)).length,
                parentOverdue: parentTasks.filter(isOverdue).length,
                subtaskTotal: assignedSubtasks.length,
                subtaskDone: assignedSubtasks.filter((subtask) => subtask.status === 'DONE').length,
                subtaskOpen: assignedSubtasks.filter((subtask) => !['DONE', 'CANCELLED'].includes(subtask.status)).length,
                subtaskOverdue: assignedSubtasks.filter(isOverdue).length
            };
        })
    ), [users, tasks, subtasks]);

    const filtered = useMemo(() => {
        const keyword = searchTerm.trim().toLowerCase();
        return usersWithStats.filter((account) => {
            const matchesSearch = !keyword || [
                account.email,
                account.fullName
            ].some((value) => (value || '').toLowerCase().includes(keyword));
            const matchesRole = roleFilter === 'ALL' || account.role === roleFilter;
            const matchesActive = activeFilter === 'ALL'
                || (activeFilter === 'ACTIVE' && account.isActive !== false)
                || (activeFilter === 'INACTIVE' && account.isActive === false)
                || (activeFilter === 'MUST_CHANGE' && account.mustChangePassword);
            return matchesSearch && matchesRole && matchesActive;
        });
    }, [usersWithStats, searchTerm, roleFilter, activeFilter]);

    const selectedUser = usersWithStats.find((account) => account.id === selectedUserId) || null;

    const handleToggleActive = async (account) => {
        const nextActive = account.isActive === false;
        if (!nextActive && account.email === currentUser?.email) {
            showToast('You cannot deactivate your own account', 'error');
            return;
        }
        if (!window.confirm(`${nextActive ? 'Unlock' : 'Lock'} account "${account.email}"?`)) return;

        try {
            const res = await api.patch(`/users/${account.id}/active`, { active: nextActive });
            setUsers((current) => current.map((item) => item.id === account.id ? res.data : item));
            showToast(nextActive ? 'Account unlocked' : 'Account locked');
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to update account state', 'error');
        }
    };

    const handleResetPassword = async (account) => {
        if (!window.confirm(`Require password change for "${account.email}" at next login?`)) return;
        try {
            const res = await api.patch(`/users/${account.id}/reset-password`);
            setUsers((current) => current.map((item) => item.id === account.id ? res.data : item));
            showToast('Password change required');
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to reset password flag', 'error');
        }
    };

    if (loading) return <div className="page-loading"><LoadingCompass size={40} /></div>;

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">User Management</h1>
                    <p className="page-subtitle">Manage accounts, access state and workload by parent task/subtask</p>
                </div>
                <div className="page-header-actions">
                    <div className="search-container">
                        <Search className="search-icon" size={16} />
                        <input
                            type="text"
                            className="input-glass"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            style={{ paddingLeft: '2.2rem', width: '240px' }}
                        />
                    </div>
                    <select className="filter-select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                        <option value="ALL">All Roles</option>
                        <option value="MANAGER">Manager</option>
                        <option value="USER">User</option>
                    </select>
                    <select className="filter-select" value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
                        <option value="ALL">All Accounts</option>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Locked</option>
                        <option value="MUST_CHANGE">Must Change Password</option>
                    </select>
                    <button className="btn-glass" onClick={fetchUsers}><RefreshCw size={16} /> Refresh</button>
                </div>
            </div>

            <div className="users-grid">
                {filtered.length === 0 ? (
                    <p className="no-data-text" style={{ gridColumn: '1 / -1' }}>No users found</p>
                ) : filtered.map((account) => (
                    <div key={account.email} className={`glass-panel user-card ${account.isActive === false ? 'locked' : ''}`}>
                        <div className="user-card-header">
                            <div className="avatar avatar-lg">{(account.fullName || account.email).charAt(0).toUpperCase()}</div>
                            <div>
                                <h3 className="user-card-name">{account.fullName || emailName(account.email)}</h3>
                                <p className="user-card-email">{account.email}</p>
                                <div className="user-card-badges">
                                    <span className={`badge ${account.role === 'MANAGER' ? 'in-review' : 'pending'}`}><Shield size={11} /> {account.role}</span>
                                    <span className={`badge ${account.isActive === false ? 'danger' : 'done'}`}>
                                        {account.isActive === false ? 'Locked' : 'Active'}
                                    </span>
                                    {account.mustChangePassword && <span className="badge pending">Must change password</span>}
                                </div>
                            </div>
                        </div>
                        <div className="user-card-stats">
                            <div className="user-stat">
                                <span className="user-stat-value">{account.parentTotal}</span>
                                <span className="user-stat-label">Parent</span>
                            </div>
                            <div className="user-stat">
                                <span className="user-stat-value" style={{ color: '#3B82F6' }}>{account.subtaskTotal}</span>
                                <span className="user-stat-label">Subtasks</span>
                            </div>
                            <div className="user-stat">
                                <span className="user-stat-value" style={{ color: '#10B981' }}>{account.subtaskDone}</span>
                                <span className="user-stat-label">Done</span>
                            </div>
                            <div className="user-stat">
                                <span className="user-stat-value" style={{ color: '#EF4444' }}>{account.parentOverdue + account.subtaskOverdue}</span>
                                <span className="user-stat-label">Overdue</span>
                            </div>
                        </div>
                        <div className="user-card-bar">
                            {account.subtaskTotal > 0 && (
                                <>
                                    <div className="bar-segment" style={{ width: `${(account.subtaskDone / account.subtaskTotal) * 100}%`, background: '#10B981' }}></div>
                                    <div className="bar-segment" style={{ width: `${(account.subtaskOpen / account.subtaskTotal) * 100}%`, background: '#3B82F6' }}></div>
                                    <div className="bar-segment" style={{ width: `${(account.subtaskOverdue / account.subtaskTotal) * 100}%`, background: '#EF4444' }}></div>
                                </>
                            )}
                        </div>
                        <div className="user-card-actions">
                            <button className="btn-glass btn-sm" onClick={() => setSelectedUserId(account.id)}><Eye size={13} /> View</button>
                            <button
                                className="btn-glass btn-sm"
                                onClick={() => handleToggleActive(account)}
                                disabled={account.email === currentUser?.email && account.isActive !== false}
                                title={account.email === currentUser?.email ? 'Cannot lock your own account' : undefined}
                            >
                                {account.isActive === false ? <><Unlock size={13} /> Unlock</> : <><Lock size={13} /> Lock</>}
                            </button>
                            <button className="btn-glass btn-sm" onClick={() => handleResetPassword(account)}><KeyRound size={13} /> Reset</button>
                        </div>
                    </div>
                ))}
            </div>

            {selectedUser && (
                <div className="glass-panel user-detail-panel">
                    <div className="user-detail-header">
                        <div>
                            <h2>{selectedUser.fullName || emailName(selectedUser.email)}</h2>
                            <p>{selectedUser.email}</p>
                        </div>
                        <button className="btn-glass btn-sm" onClick={() => setSelectedUserId(null)}>Close</button>
                    </div>

                    <div className="user-detail-summary">
                        <span><UserCheck size={14} /> Parent tasks: <strong>{selectedUser.parentTotal}</strong></span>
                        <span><UsersIcon size={14} /> Subtasks: <strong>{selectedUser.subtaskTotal}</strong></span>
                        <span><CheckCircle size={14} /> Done subtasks: <strong>{selectedUser.subtaskDone}</strong></span>
                        <span><AlertTriangle size={14} /> Overdue: <strong>{selectedUser.parentOverdue + selectedUser.subtaskOverdue}</strong></span>
                    </div>

                    <div className="user-detail-grid">
                        <section>
                            <h3 className="section-title-small">Parent tasks</h3>
                            <UserTaskTable items={selectedUser.parentTasks} type="task" />
                        </section>
                        <section>
                            <h3 className="section-title-small">Assigned subtasks</h3>
                            <UserTaskTable items={selectedUser.assignedSubtasks} type="subtask" />
                        </section>
                    </div>
                </div>
            )}

            {toast && (
                <div className={`toast-notification ${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    {toast.msg}
                </div>
            )}
        </div>
    );
};

const UserTaskTable = ({ items, type }) => (
    <div className="data-table-container compact-table">
        <table className="data-table">
            <thead>
                <tr>
                    <th>{type === 'task' ? 'Task' : 'Subtask'}</th>
                    <th>{type === 'task' ? 'Code' : 'Parent'}</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Deadline</th>
                </tr>
            </thead>
            <tbody>
                {items.length === 0 ? (
                    <tr><td colSpan="5" className="table-empty">No data</td></tr>
                ) : items.map((item) => (
                    <tr key={`${type}-${item.id}`}>
                        <td><strong>{type === 'task' ? item.taskName : item.title}</strong></td>
                        <td>{type === 'task' ? item.taskId : item.parentTaskName || item.parentTaskCode || '-'}</td>
                        <td>{item.priority ? <span className={`badge-priority ${item.priority.toLowerCase()}`}>{item.priority}</span> : '-'}</td>
                        <td><span className={`badge ${statusClass(item.status)}`}>{statusLabel(item.status)}</span></td>
                        <td>{formatDate(item.deadline)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

export default ManagerUsers;
