import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, RefreshCw, Search, Trash2, AlertTriangle, CheckCircle, MoreHorizontal } from 'lucide-react';
import api from '../../services/api';
import TaskDetailDrawer from '../../components/TaskDetailDrawer';
import useAutoRefresh from '../../hooks/useAutoRefresh';

const CancelledTasks = () => {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTask, setSelectedTask] = useState(null);
    const [toast, setToast] = useState(null);
    const [actionMenu, setActionMenu] = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchTasks = async () => {
        try {
            const res = await api.get('/tasks');
            setTasks(res.data.filter((task) => task.status === 'CANCELLED'));
        } catch (err) {
            console.error(err);
            showToast('Failed to load cancelled tasks', 'error');
        } finally {
            setLoading(false);
        }
    };

    useAutoRefresh(fetchTasks, []);

    const filteredTasks = useMemo(() => {
        const keyword = searchTerm.trim().toLowerCase();
        if (!keyword) return tasks;
        return tasks.filter((task) =>
            task.taskName.toLowerCase().includes(keyword) ||
            task.taskId.toLowerCase().includes(keyword) ||
            task.assigneeEmail.toLowerCase().includes(keyword)
        );
    }, [tasks, searchTerm]);

    const handlePermanentDelete = async (task) => {
        if (!window.confirm(`Delete cancelled task "${task.taskName}" permanently? This cannot be undone.`)) return;

        try {
            await api.delete(`/tasks/${task.id}/permanent`);
            showToast('Cancelled task deleted permanently');
            setTasks((current) => current.filter((item) => item.id !== task.id));
            if (selectedTask?.id === task.id) {
                setSelectedTask(null);
            }
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to delete cancelled task', 'error');
        }
    };

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <h1 className="page-title">Cancelled Tasks</h1>
                <div className="page-header-actions">
                    <div className="search-container">
                        <Search className="search-icon" size={16} />
                        <input
                            type="text"
                            className="input-glass"
                            placeholder="Search tasks, emails..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ paddingLeft: '2.2rem', width: '240px' }}
                        />
                    </div>
                    <button className="btn-glass" onClick={fetchTasks}>
                        <RefreshCw size={16} /> Refresh
                    </button>
                    <button className="btn-glass" onClick={() => navigate('/manager/tasks')}>
                        Back To Tasks
                    </button>
                </div>
            </div>

            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Task ID</th>
                            <th>Task Name</th>
                            <th>Assignee</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Deadline</th>
                            <th>Created</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="8" className="table-empty">Loading cancelled tasks...</td></tr>
                        ) : filteredTasks.length === 0 ? (
                            <tr><td colSpan="8" className="table-empty">No cancelled tasks found</td></tr>
                        ) : filteredTasks.map((task, index) => (
                            <tr key={task.id}>
                                <td style={{ color: '#64748B', fontSize: '0.8rem', fontFamily: 'monospace' }}>{task.taskId}</td>
                                <td><strong className="task-name-link" onClick={() => setSelectedTask(task)}>{task.taskName}</strong></td>
                                <td>
                                    <div className="assignee-cell">
                                        <div className="avatar">{task.assigneeEmail ? task.assigneeEmail.charAt(0).toUpperCase() : 'U'}</div>
                                        <span style={{ fontSize: '0.85rem' }}>{task.assigneeEmail.split('@')[0]}</span>
                                    </div>
                                </td>
                                <td>
                                    <span className={`badge-priority ${task.priority.toLowerCase()}`}>{task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}</span>
                                </td>
                                <td>
                                    <span className="badge cancelled">Cancelled</span>
                                </td>
                                <td style={{ fontSize: '0.85rem', color: '#64748B' }}>
                                    {task.deadline ? new Date(task.deadline).toLocaleDateString('vi-VN') : '—'}
                                </td>
                                <td style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                                    {task.createdAt ? new Date(task.createdAt).toLocaleDateString('vi-VN') : ''}
                                </td>
                                <td>
                                    <div className="action-cell">
                                        <button className="action-dot-btn" onClick={() => setActionMenu(actionMenu === task.id ? null : task.id)} title="Actions">
                                            <MoreHorizontal size={16} />
                                        </button>
                                        {actionMenu === task.id && (
                                            <div className={`action-dropdown ${index >= filteredTasks.length - 3 ? 'open-up' : 'open-down'}`}>
                                                <button onClick={() => { setSelectedTask(task); setActionMenu(null); }}><Eye size={14} /> View</button>
                                                <button onClick={() => { handlePermanentDelete(task); setActionMenu(null); }} className="action-danger"><Trash2 size={14} /> Delete Permanently</button>
                                            </div>
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
                    onStatusChange={() => {}}
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

export default CancelledTasks;
