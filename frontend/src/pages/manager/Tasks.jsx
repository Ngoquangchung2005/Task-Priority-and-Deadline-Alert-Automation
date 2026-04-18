import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import CreateTaskModal from '../../components/CreateTaskModal';
import TaskDetailDrawer from '../../components/TaskDetailDrawer';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { Search, Plus, Filter, ChevronDown, MoreHorizontal, Eye, Edit3, Trash2, Archive, ArchiveRestore, RefreshCw, AlertTriangle, Bell, ChevronLeft, ChevronRight, CheckCircle, Layout } from 'lucide-react';

const PAGE_SIZE = 10;

const ManagerTasks = () => {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [editTask, setEditTask] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [priorityFilter, setPriorityFilter] = useState('ALL');
    const [assigneeFilter, setAssigneeFilter] = useState('ALL');
    const [deadlineFilter, setDeadlineFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('deadline');
    const [sortDir, setSortDir] = useState('asc');
    const [page, setPage] = useState(1);
    const [showFilter, setShowFilter] = useState(false);
    const [actionMenu, setActionMenu] = useState(null);
    const [toast, setToast] = useState(null);

    const fetchTasks = async () => {
        try {
            const res = await api.get('/tasks');
            setTasks(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useAutoRefresh(fetchTasks, []);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleDelete = async (task) => {
        if (!window.confirm('Are you sure you want to cancel this task?')) return;
        try {
            await api.delete(`/tasks/${task.id}`);
            showToast('Task cancelled');
            fetchTasks();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to cancel task', 'error');
        }
    };

    const handleStatusChange = async (id, status) => {
        try {
            await api.patch(`/tasks/${id}/status`, { status });
            showToast(`Status updated to ${status}`);
            fetchTasks();
        } catch { showToast('Failed to update status', 'error'); }
    };

    const handleArchive = async (task, archived) => {
        const action = archived ? 'archive' : 'restore';
        if (!window.confirm(`Are you sure you want to ${action} this task?`)) return;
        try {
            await api.patch(`/tasks/${task.id}/archive`, { archived });
            showToast(archived ? 'Task archived' : 'Task restored');
            fetchTasks();
        } catch (err) {
            showToast(err.response?.data?.message || `Failed to ${action} task`, 'error');
        }
    };

    const assignees = useMemo(() => [...new Set(tasks.map(t => t.assigneeEmail))], [tasks]);

    const filtered = useMemo(() => {
        let result = tasks.filter(t => !t.archived && t.status !== 'CANCELLED');
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            result = result.filter(t => t.taskName.toLowerCase().includes(s) || t.assigneeEmail.toLowerCase().includes(s) || t.taskId.toLowerCase().includes(s));
        }
        if (!['ALL', 'ARCHIVED'].includes(statusFilter)) result = result.filter(t => t.status === statusFilter);
        if (priorityFilter !== 'ALL') result = result.filter(t => t.priority === priorityFilter);
        if (assigneeFilter !== 'ALL') result = result.filter(t => t.assigneeEmail === assigneeFilter);
        if (deadlineFilter === 'OVERDUE') result = result.filter(t => t.daysLeft !== null && t.daysLeft < 0 && !['DONE', 'CANCELLED'].includes(t.status));
        if (deadlineFilter === 'TODAY') result = result.filter(t => t.daysLeft === 0);
        if (deadlineFilter === 'UPCOMING') result = result.filter(t => t.daysLeft !== null && t.daysLeft > 0 && t.daysLeft <= 7);
        // sort
        result.sort((a, b) => {
            let va, vb;
            if (sortBy === 'deadline') { va = new Date(a.deadline || 0); vb = new Date(b.deadline || 0); }
            else if (sortBy === 'createdAt') { va = new Date(a.createdAt || 0); vb = new Date(b.createdAt || 0); }
            else if (sortBy === 'priority') {
                const order = { HIGH: 3, MEDIUM: 2, LOW: 1 };
                va = order[a.priority] || 0; vb = order[b.priority] || 0;
            } else { va = 0; vb = 0; }
            return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
        });
        return result;
    }, [tasks, searchTerm, statusFilter, priorityFilter, assigneeFilter, deadlineFilter, sortBy, sortDir]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const getStatusBadge = (task) => {
        if (task.archived) {
            return <span className="badge" style={{ background: '#e2e8f0', color: '#475569' }}>Archived</span>;
        }
        const status = task.status;
        const map = { DONE: 'done', IN_PROGRESS: 'in-progress', PENDING: 'pending', IN_REVIEW: 'in-review', OVERDUE: 'danger', TODO: 'pending', CANCELLED: 'danger' };
        const label = { DONE: 'Done', IN_PROGRESS: 'In Progress', PENDING: 'Pending', IN_REVIEW: 'In Review', OVERDUE: 'Overdue', TODO: 'To Do', CANCELLED: 'Cancelled' };
        return <span className={`badge ${map[status] || 'pending'}`}>{label[status] || status}</span>;
    };

    const getPriorityBadge = (p) => <span className={`badge-priority ${p.toLowerCase()}`}>{p.charAt(0) + p.slice(1).toLowerCase()}</span>;
    const canEditTask = (task) => !task.archived && !['DONE', 'CANCELLED'].includes(task.status);

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <h1 className="page-title">Task Management</h1>
                <div className="page-header-actions">
                    <div className="search-container">
                        <Search className="search-icon" size={16} />
                        <input type="text" className="input-glass" placeholder="Search tasks, emails..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(1); }} style={{ paddingLeft: '2.2rem', width: '240px' }} />
                    </div>
                    <button className="btn-glass" onClick={() => setShowFilter(!showFilter)}>
                        <Filter size={16} /> Filter <ChevronDown size={14} />
                    </button>
                    <button className="btn-glass" onClick={() => navigate('/manager/tasks/cancelled')}>
                        <Trash2 size={16} /> Cancelled Tasks
                    </button>
                    <button className="btn-glass" onClick={() => navigate('/manager/tasks/archived')}>
                        <Archive size={16} /> Archived Tasks
                    </button>
                    <button className="btn-glass" onClick={fetchTasks}>
                        <RefreshCw size={16} /> Refresh
                    </button>
                    <button className="btn-primary" onClick={() => { setEditTask(null); setIsModalOpen(true); }}>
                        <Plus size={16} /> Add Task
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            {showFilter && (
                <div className="filter-bar glass-panel fade-in">
                    <div className="filter-group">
                        <label>Status</label>
                        <select className="filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
                            <option value="ALL">All</option>
                            <option value="PENDING">Pending</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="IN_REVIEW">In Review</option>
                            <option value="OVERDUE">Overdue</option>
                            <option value="DONE">Done</option>
                        </select>
                    </div>
                    <div className="filter-group">
                        <label>Priority</label>
                        <select className="filter-select" value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}>
                            <option value="ALL">All</option>
                            <option value="HIGH">High</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LOW">Low</option>
                        </select>
                    </div>
                    <div className="filter-group">
                        <label>Assignee</label>
                        <select className="filter-select" value={assigneeFilter} onChange={e => { setAssigneeFilter(e.target.value); setPage(1); }}>
                            <option value="ALL">All</option>
                            {assignees.map(a => <option key={a} value={a}>{a.split('@')[0]}</option>)}
                        </select>
                    </div>
                    <div className="filter-group">
                        <label>Deadline</label>
                        <select className="filter-select" value={deadlineFilter} onChange={e => { setDeadlineFilter(e.target.value); setPage(1); }}>
                            <option value="ALL">All</option>
                            <option value="OVERDUE">Overdue</option>
                            <option value="TODAY">Today</option>
                            <option value="UPCOMING">Next 7 days</option>
                        </select>
                    </div>
                    <div className="filter-group">
                        <label>Sort by</label>
                        <select className="filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                            <option value="deadline">Deadline</option>
                            <option value="createdAt">Created</option>
                            <option value="priority">Priority</option>
                        </select>
                    </div>
                    <div className="filter-group">
                        <label>Order</label>
                        <select className="filter-select" value={sortDir} onChange={e => setSortDir(e.target.value)}>
                            <option value="asc">↑ Asc</option>
                            <option value="desc">↓ Desc</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th style={{ width: '40px' }}><input type="checkbox" className="custom-checkbox" /></th>
                            <th>Task ID</th>
                            <th>Task Name</th>
                            <th>Assignee</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Deadline</th>
                            <th>Created</th>
                            <th>Reminders</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="10" className="table-empty">Loading tasks...</td></tr>
                        ) : paged.length === 0 ? (
                            <tr><td colSpan="10" className="table-empty">No tasks found</td></tr>
                        ) : paged.map((task, index) => (
                            <tr key={task.id}>
                                <td><input type="checkbox" className="custom-checkbox" /></td>
                                <td style={{ color: '#64748B', fontSize: '0.8rem', fontFamily: 'monospace' }}>{task.taskId}</td>
                                <td><strong className="task-name-link" onClick={() => setSelectedTask(task)}>{task.taskName}</strong></td>
                                <td>
                                    <div className="assignee-cell">
                                        <div className="avatar">{task.assigneeEmail ? task.assigneeEmail.charAt(0).toUpperCase() : 'U'}</div>
                                        <span style={{ fontSize: '0.85rem' }}>{task.assigneeEmail.split('@')[0]}</span>
                                    </div>
                                </td>
                                <td>{getPriorityBadge(task.priority)}</td>
                                <td>{getStatusBadge(task)}</td>
                                <td style={{ fontSize: '0.85rem', color: '#64748B' }}>
                                    {task.deadline ? new Date(task.deadline).toLocaleDateString('vi-VN') : '—'}
                                    {task.daysLeft !== null && task.daysLeft <= 3 && !task.archived && !['DONE', 'CANCELLED'].includes(task.status) && (
                                        <span className={`days-inline ${task.daysLeft < 0 ? 'danger' : 'warning'}`}>
                                            {task.daysLeft < 0 ? `${Math.abs(task.daysLeft)}d late` : task.daysLeft === 0 ? 'Today' : `${task.daysLeft}d left`}
                                        </span>
                                    )}
                                </td>
                                <td style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{task.createdAt ? new Date(task.createdAt).toLocaleDateString('vi-VN') : ''}</td>
                                <td style={{ textAlign: 'center' }}>
                                    {task.reminderCount > 0 ? (
                                        <span className="reminder-badge">{task.reminderCount}</span>
                                    ) : '—'}
                                </td>
                                <td>
                                    <div className="action-cell">
                                        <button className="action-dot-btn" onClick={() => setActionMenu(actionMenu === task.id ? null : task.id)} title="Actions">
                                            <MoreHorizontal size={16} />
                                        </button>
                                        {actionMenu === task.id && (
                                            <div className={`action-dropdown ${index >= paged.length - 3 ? 'open-up' : 'open-down'}`}>
                                                <button onClick={() => { setSelectedTask(task); setActionMenu(null); }}><Eye size={14} /> View</button>
                                                {canEditTask(task) && (
                                                    <button onClick={() => { setEditTask(task); setIsModalOpen(true); setActionMenu(null); }}><Edit3 size={14} /> Edit</button>
                                                )}
                                                {task.status === 'IN_REVIEW' && (
                                                    <button onClick={() => { handleStatusChange(task.id, 'DONE'); setActionMenu(null); }} style={{ color: '#10b981' }}><CheckCircle size={14} /> Approve</button>
                                                )}
                                                <button onClick={() => { navigate(`/manager/tasks/${task.id}/board`); setActionMenu(null); }}><Layout size={14} /> Board</button>
                                                {task.status === 'DONE' && !task.archived && (
                                                    <button onClick={() => { handleArchive(task, true); setActionMenu(null); }}><Archive size={14} /> Archive</button>
                                                )}
                                                {task.archived && (
                                                    <button onClick={() => { handleArchive(task, false); setActionMenu(null); }}><ArchiveRestore size={14} /> Restore</button>
                                                )}
                                                {task.status === 'PENDING' && (
                                                    <button onClick={() => { handleDelete(task); setActionMenu(null); }} className="action-danger"><Trash2 size={14} /> Cancel</button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="pagination">
                    <span className="pagination-info">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
                    <div className="pagination-btns">
                        <button className="btn-glass btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button>
                        {Array.from({ length: totalPages }, (_, i) => (
                            <button key={i} className={`btn-glass btn-sm ${page === i + 1 ? 'active' : ''}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
                        ))}
                        <button className="btn-glass btn-sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button>
                    </div>
                </div>
            )}

            {/* Modals */}
            <CreateTaskModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditTask(null); }}
                onTaskCreated={() => { fetchTasks(); showToast('Task created successfully!'); }}
                editTask={editTask}
            />

            {selectedTask && (
                <TaskDetailDrawer
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onStatusChange={(id, status) => { handleStatusChange(id, status); setSelectedTask(null); }}
                />
            )}

            {/* Toast */}
            {toast && (
                <div className={`toast-notification ${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    {toast.msg}
                </div>
            )}
        </div>
    );
};

export default ManagerTasks;
