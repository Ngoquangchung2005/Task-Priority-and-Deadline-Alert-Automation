import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import TaskDetailDrawer from '../../components/TaskDetailDrawer';
import LoadingCompass from '../../components/LoadingCompass';
import { Search, CheckCircle, AlertTriangle, Layout, Send } from 'lucide-react';

const UserTasks = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [tab, setTab] = useState('ALL');
    const [selectedTask, setSelectedTask] = useState(null);
    const [toast, setToast] = useState(null);
    const navigate = useNavigate();

    const fetchTasks = async () => {
        try {
            const res = await api.get('/tasks/my-tasks');
            setTasks(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchTasks(); }, []);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const updateStatus = async (id, newStatus) => {
        try {
            await api.patch(`/tasks/${id}/status`, { status: newStatus });
            showToast(`Task updated to ${newStatus}`);
            fetchTasks();
        } catch { showToast('Failed to update', 'error'); }
    };

    const handleStart = (task) => {
        if (task.totalSubTask && task.totalSubTask > 0) {
            navigate(`/user/tasks/${task.id}/board`);
        } else {
            updateStatus(task.id, 'IN_PROGRESS');
        }
    };

    const visibleTasks = tasks.filter(t => !t.archived);

    const filtered = visibleTasks.filter(t => {
        const matchSearch = t.taskName.toLowerCase().includes(searchTerm.toLowerCase());
        if (tab === 'ALL') return matchSearch;
        if (tab === 'TODAY') return matchSearch && t.daysLeft !== null && t.daysLeft >= 0 && t.daysLeft <= 1 && t.status !== 'DONE';
        if (tab === 'UPCOMING') return matchSearch && t.daysLeft !== null && t.daysLeft > 1 && t.daysLeft <= 7 && t.status !== 'DONE';
        if (tab === 'OVERDUE') return matchSearch && t.daysLeft !== null && t.daysLeft < 0 && t.status !== 'DONE';
        if (tab === 'DONE') return matchSearch && t.status === 'DONE';
        return matchSearch && t.status === tab;
    });

    const getStatusBadge = (status) => {
        const map = { DONE: 'done', IN_PROGRESS: 'in-progress', PENDING: 'pending', IN_REVIEW: 'in-review', OVERDUE: 'danger', TODO: 'pending' };
        const label = { DONE: 'Done', IN_PROGRESS: 'In Progress', PENDING: 'Pending', IN_REVIEW: 'In Review', OVERDUE: 'Overdue', TODO: 'To Do' };
        return <span className={`badge ${map[status] || 'pending'}`}>{label[status] || status}</span>;
    };

    const getPriorityBadge = (p) => <span className={`badge-priority ${p.toLowerCase()}`}>{p.charAt(0) + p.slice(1).toLowerCase()}</span>;

    if (loading) return <div className="page-loading"><LoadingCompass size={40} /></div>;

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <h1 className="page-title">My Tasks</h1>
                <div className="search-container">
                    <Search className="search-icon" size={16} />
                    <input type="text" className="input-glass" placeholder="Search tasks..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ paddingLeft: '2.2rem', width: '240px' }} />
                </div>
            </div>

            <div className="tab-bar">
                <button className={`tab-btn ${tab === 'ALL' ? 'active' : ''}`} onClick={() => setTab('ALL')}>All ({visibleTasks.length})</button>
                <button className={`tab-btn ${tab === 'TODAY' ? 'active' : ''}`} onClick={() => setTab('TODAY')}>Hôm nay</button>
                <button className={`tab-btn ${tab === 'UPCOMING' ? 'active' : ''}`} onClick={() => setTab('UPCOMING')}>Sắp tới hạn</button>
                <button className={`tab-btn ${tab === 'OVERDUE' ? 'active' : ''}`} onClick={() => setTab('OVERDUE')}>Quá hạn</button>
                <button className={`tab-btn ${tab === 'PENDING' ? 'active' : ''}`} onClick={() => setTab('PENDING')}>Pending</button>
                <button className={`tab-btn ${tab === 'IN_PROGRESS' ? 'active' : ''}`} onClick={() => setTab('IN_PROGRESS')}>In Progress</button>
                <button className={`tab-btn ${tab === 'IN_REVIEW' ? 'active' : ''}`} onClick={() => setTab('IN_REVIEW')}>In Review</button>
                <button className={`tab-btn ${tab === 'DONE' ? 'active' : ''}`} onClick={() => setTab('DONE')}>Done</button>
            </div>

            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Task ID</th>
                            <th>Name</th>
                            <th>Subtasks</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Deadline</th>
                            <th>Days Left</th>
                            <th>Manager</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan="9" className="table-empty">No tasks matching the criteria.</td></tr>
                        ) : filtered.map(task => (
                            <tr key={task.id}>
                                <td style={{ color: '#64748B', fontSize: '0.8rem', fontFamily: 'monospace' }}>{task.taskId}</td>
                                <td><strong className="task-name-link" onClick={() => setSelectedTask(task)}>{task.taskName}</strong></td>
                                <td style={{ textAlign: 'center' }}>
                                    {task.totalSubTask > 0 ? (
                                        <span className="subtask-count-badge">{task.totalSubTask}</span>
                                    ) : '—'}
                                </td>
                                <td>{getPriorityBadge(task.priority)}</td>
                                <td>{getStatusBadge(task.status)}</td>
                                <td style={{ fontSize: '0.85rem', color: '#64748B' }}>{task.deadline ? new Date(task.deadline).toLocaleDateString('vi-VN') : '—'}</td>
                                <td>
                                    <span className={`days-badge ${task.daysLeft !== null && task.daysLeft <= 0 ? 'danger' : task.daysLeft <= 3 ? 'warning' : 'info'}`}>
                                        {task.daysLeft === null ? '—' : task.daysLeft <= 0 ? `${Math.abs(task.daysLeft)}d late` : `${task.daysLeft}d`}
                                    </span>
                                </td>
                                <td style={{ fontSize: '0.85rem' }}>{task.ownerName || task.managerEmail?.split('@')[0] || '—'}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                        {task.status === 'PENDING' && (
                                            <button className="btn-outline btn-sm" onClick={() => handleStart(task)}>
                                                {task.totalSubTask > 0 ? <><Layout size={13} /> Board</> : 'Start'}
                                            </button>
                                        )}
                                        {task.status === 'IN_PROGRESS' && (
                                            <>
                                                {task.totalSubTask > 0 ? (
                                                    <button className="btn-primary btn-sm" onClick={() => navigate(`/user/tasks/${task.id}/board`)}>
                                                        <Layout size={13} /> Board
                                                    </button>
                                                ) : (
                                                    <button className="btn-primary btn-sm" onClick={() => updateStatus(task.id, 'IN_REVIEW')}><Send size={13}/> Submit Review</button>
                                                )}
                                            </>
                                        )}
                                        {task.status === 'IN_REVIEW' && (
                                            <>
                                                {task.totalSubTask > 0 ? (
                                                    <button className="btn-glass btn-sm" onClick={() => navigate(`/user/tasks/${task.id}/board`)}>
                                                        <Layout size={13} /> Board
                                                    </button>
                                                ) : (
                                                    <span style={{ color: '#F59E0B', fontSize: '0.8rem', fontWeight: 500 }}>Chờ duyệt</span>
                                                )}
                                            </>
                                        )}
                                        {task.status === 'DONE' && <span style={{ color: '#10B981', fontSize: '0.8rem' }}>✓ Completed</span>}
                                        {task.daysLeft !== null && task.daysLeft < 0 && task.status !== 'DONE' && task.totalSubTask > 0 && (
                                            <button className="btn-glass btn-sm" onClick={() => navigate(`/user/tasks/${task.id}/board`)}>
                                                <Layout size={13} /> View
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedTask && (
                <TaskDetailDrawer
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onStatusChange={(id, status) => { updateStatus(id, status); setSelectedTask(null); }}
                    isUser={true}
                />
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

export default UserTasks;
