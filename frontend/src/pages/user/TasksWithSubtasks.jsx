import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import DetailedTaskDrawer from '../../components/DetailedTaskDrawer';
import LoadingCompass from '../../components/LoadingCompass';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { isVisibleWorkItem } from '../../utils/taskMetrics';
import {
    AlertTriangle,
    Calendar,
    CheckCircle,
    Clock,
    Eye,
    Flag,
    Layout,
    ListTodo,
    Search,
    Send,
    User
} from 'lucide-react';

const TABS = {
    MAIN: 'MAIN',
    SUBTASKS: 'SUBTASKS',
    DUE_SOON: 'DUE_SOON',
    OVERDUE: 'OVERDUE',
    DONE: 'DONE'
};

const OPEN_STATUSES = new Set(['PENDING', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'OVERDUE']);

const getDaysLeft = (deadline) => {
    if (!deadline) return null;
    const target = new Date(deadline);
    if (Number.isNaN(target.getTime())) return null;
    const today = new Date();
    target.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

const formatDate = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

const getStatusLabel = (status) => ({
    PENDING: 'Pending',
    TODO: 'To Do',
    IN_PROGRESS: 'In Progress',
    IN_REVIEW: 'In Review',
    OVERDUE: 'Overdue',
    DONE: 'Done',
    CANCELLED: 'Cancelled'
}[status] || status);

const getStatusClass = (status) => ({
    DONE: 'done',
    IN_PROGRESS: 'in-progress',
    PENDING: 'pending',
    TODO: 'pending',
    IN_REVIEW: 'in-review',
    OVERDUE: 'danger',
    CANCELLED: 'danger'
}[status] || 'pending');

const newestFirst = (items) => [...items].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

const UserTasksWithSubtasks = () => {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState([]);
    const [subtasks, setSubtasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [tab, setTab] = useState(TABS.SUBTASKS);
    const [selectedTask, setSelectedTask] = useState(null);
    const [toast, setToast] = useState(null);
    const [fetchError, setFetchError] = useState('');

    const fetchData = async () => {
        try {
            const [taskRes, subtaskRes] = await Promise.all([
                api.get('/tasks/my-tasks'),
                api.get('/subtasks/my')
            ]);
            setTasks(newestFirst((Array.isArray(taskRes.data) ? taskRes.data : [])
                .filter((task) => !task.archived && task.status !== 'CANCELLED')
                .map((task) => ({ ...task, daysLeft: task.daysLeft ?? getDaysLeft(task.deadline) }))));
            setSubtasks(newestFirst((Array.isArray(subtaskRes.data) ? subtaskRes.data : [])
                .filter(isVisibleWorkItem)));
            setFetchError('');
        } catch (err) {
            console.error('Failed to load user tasks', err);
            setFetchError(err.response?.data?.message || 'Không tải được danh sách task/subtask');
        } finally {
            setLoading(false);
        }
    };

    useAutoRefresh(fetchData, []);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const updateTaskStatus = async (id, newStatus) => {
        try {
            await api.patch(`/tasks/${id}/status`, { status: newStatus });
            showToast(`Task updated to ${getStatusLabel(newStatus)}`);
            fetchData();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to update task', 'error');
        }
    };

    const handleStartParentTask = (task) => {
        if (task.totalSubTask && task.totalSubTask > 0) {
            navigate(`/user/tasks/${task.id}/board`);
        } else {
            updateTaskStatus(task.id, 'IN_PROGRESS');
        }
    };

    const openSubtaskGroupDetail = (group) => {
        setSelectedTask({
            id: group.taskId,
            taskId: group.parentTaskCode,
            taskName: group.parentTaskName || 'Parent task',
            taskDescription: group.parentTaskDescription,
            deadline: group.parentDeadline,
            status: group.parentStatus || (group.hasOverdue ? 'OVERDUE' : group.allDone ? 'IN_REVIEW' : 'IN_PROGRESS'),
            priority: group.highestPriority,
            totalSubTask: group.total
        });
    };

    const search = searchTerm.trim().toLowerCase();

    const enrichedSubtasks = useMemo(() => (
        subtasks.map((subtask) => ({
            ...subtask,
            daysLeft: getDaysLeft(subtask.deadline),
            parentDeadlineDaysLeft: getDaysLeft(subtask.parentDeadline)
        }))
    ), [subtasks]);

    const matchesTaskSearch = (task) => {
        if (!search) return true;
        return [
            task.taskName,
            task.taskId,
            task.taskDescription,
            task.managerEmail,
            task.ownerName
        ].some((value) => (value || '').toLowerCase().includes(search));
    };

    const matchesSubtaskSearch = (subtask) => {
        if (!search) return true;
        return [
            subtask.title,
            subtask.parentTaskName,
            subtask.parentTaskCode,
            subtask.parentTaskDescription,
            subtask.createdBy,
            subtask.assignedTo
        ].some((value) => (value || '').toLowerCase().includes(search));
    };

    const filteredMainTasks = tasks.filter((task) => {
        if (!matchesTaskSearch(task)) return false;
        if (tab === TABS.MAIN) return true;
        if (tab === TABS.DUE_SOON) return task.status !== 'DONE' && task.daysLeft !== null && task.daysLeft >= 0 && task.daysLeft <= 3;
        if (tab === TABS.OVERDUE) return task.status !== 'DONE' && task.daysLeft !== null && task.daysLeft < 0;
        if (tab === TABS.DONE) return task.status === 'DONE';
        return false;
    });

    const filteredSubtasks = enrichedSubtasks.filter((subtask) => {
        if (!matchesSubtaskSearch(subtask)) return false;
        if (tab === TABS.SUBTASKS) return true;
        if (tab === TABS.DUE_SOON) return subtask.status !== 'DONE' && subtask.daysLeft !== null && subtask.daysLeft >= 0 && subtask.daysLeft <= 3;
        if (tab === TABS.OVERDUE) return subtask.status !== 'DONE' && subtask.daysLeft !== null && subtask.daysLeft < 0;
        if (tab === TABS.DONE) return subtask.status === 'DONE';
        return false;
    });

    const stats = {
        main: tasks.length,
        subtasks: enrichedSubtasks.length,
        dueSoon: tasks.filter((task) => task.status !== 'DONE' && task.daysLeft !== null && task.daysLeft >= 0 && task.daysLeft <= 3).length
            + enrichedSubtasks.filter((subtask) => subtask.status !== 'DONE' && subtask.daysLeft !== null && subtask.daysLeft >= 0 && subtask.daysLeft <= 3).length,
        overdue: tasks.filter((task) => task.status !== 'DONE' && task.daysLeft !== null && task.daysLeft < 0).length
            + enrichedSubtasks.filter((subtask) => subtask.status !== 'DONE' && subtask.daysLeft !== null && subtask.daysLeft < 0).length,
        done: tasks.filter((task) => task.status === 'DONE').length
            + enrichedSubtasks.filter((subtask) => subtask.status === 'DONE').length
    };

    const getPriorityBadge = (priority) => {
        if (!priority) return <span className="badge-priority low">None</span>;
        return <span className={`badge-priority ${priority.toLowerCase()}`}>{priority.charAt(0) + priority.slice(1).toLowerCase()}</span>;
    };

    const getStatusBadge = (status) => (
        <span className={`badge ${getStatusClass(status)}`}>{getStatusLabel(status)}</span>
    );

    const getDaysBadge = (daysLeft, status) => {
        if (daysLeft === null || status === 'DONE') return <span className="days-badge info">—</span>;
        const className = daysLeft < 0 ? 'danger' : daysLeft <= 3 ? 'warning' : 'info';
        const label = daysLeft < 0 ? `${Math.abs(daysLeft)}d late` : daysLeft === 0 ? 'Today' : `${daysLeft}d left`;
        return <span className={`days-badge ${className}`}>{label}</span>;
    };

    const priorityRank = {
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1
    };

    const groupSubtasksByParent = (items) => {
        const groups = new Map();

        items.forEach((subtask) => {
            const key = subtask.taskId || subtask.parentTaskCode || `subtask-${subtask.id}`;
            const existing = groups.get(key);
            const currentPriority = subtask.priority || 'LOW';
            const currentCreatedAt = new Date(subtask.createdAt || 0).getTime();

            if (!existing) {
                groups.set(key, {
                    key,
                    taskId: subtask.taskId,
                    parentTaskCode: subtask.parentTaskCode,
                    parentTaskName: subtask.parentTaskName || 'Parent task',
                    parentTaskDescription: subtask.parentTaskDescription,
                    parentStatus: subtask.parentStatus,
                    parentDeadline: subtask.parentDeadline,
                    parentDeadlineDaysLeft: subtask.parentDeadlineDaysLeft,
                    highestPriority: currentPriority,
                    latestCreatedAt: currentCreatedAt,
                    subtasks: [subtask]
                });
                return;
            }

            existing.subtasks.push(subtask);
            existing.latestCreatedAt = Math.max(existing.latestCreatedAt, currentCreatedAt);
            existing.parentStatus = existing.parentStatus || subtask.parentStatus;

            if ((priorityRank[currentPriority] || 0) > (priorityRank[existing.highestPriority] || 0)) {
                existing.highestPriority = currentPriority;
            }
        });

        return Array.from(groups.values())
            .map((group) => {
                const completedCount = group.subtasks.filter((subtask) => subtask.status === 'DONE').length;
                const hasOverdue = group.subtasks.some((subtask) => subtask.status !== 'DONE' && subtask.daysLeft !== null && subtask.daysLeft < 0);
                const dueSoonCount = group.subtasks.filter((subtask) => subtask.status !== 'DONE' && subtask.daysLeft !== null && subtask.daysLeft >= 0 && subtask.daysLeft <= 3).length;

                return {
                    ...group,
                    completedCount,
                    total: group.subtasks.length,
                    hasOverdue,
                    dueSoonCount,
                    allDone: completedCount === group.subtasks.length
                };
            })
            .sort((a, b) => b.latestCreatedAt - a.latestCreatedAt);
    };

    const renderParentTaskTable = (items) => (
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
                    {items.length === 0 ? (
                        <tr><td colSpan="9" className="table-empty">No parent tasks found.</td></tr>
                    ) : items.map((task) => (
                        <tr key={task.id}>
                            <td style={{ color: '#64748B', fontSize: '0.8rem', fontFamily: 'monospace' }}>{task.taskId}</td>
                            <td><strong className="task-name-link" onClick={() => setSelectedTask(task)}>{task.taskName}</strong></td>
                            <td style={{ textAlign: 'center' }}>
                                {task.totalSubTask > 0 ? <span className="subtask-count-badge">{task.totalSubTask}</span> : '—'}
                            </td>
                            <td>{getPriorityBadge(task.priority)}</td>
                            <td>{getStatusBadge(task.status)}</td>
                            <td style={{ fontSize: '0.85rem', color: '#64748B' }}>{formatDate(task.deadline)}</td>
                            <td>{getDaysBadge(task.daysLeft, task.status)}</td>
                            <td style={{ fontSize: '0.85rem' }}>{task.ownerName || task.managerEmail?.split('@')[0] || '—'}</td>
                            <td>
                                <div className="user-task-actions">
                                    {task.status === 'PENDING' && (
                                        <button className="btn-outline btn-sm" onClick={() => handleStartParentTask(task)}>
                                            {task.totalSubTask > 0 ? <><Layout size={13} /> Board</> : 'Start'}
                                        </button>
                                    )}
                                    {task.status === 'IN_PROGRESS' && (
                                        task.totalSubTask > 0 ? (
                                            <button className="btn-primary btn-sm" onClick={() => navigate(`/user/tasks/${task.id}/board`)}>
                                                <Layout size={13} /> Board
                                            </button>
                                        ) : (
                                            <button className="btn-primary btn-sm" onClick={() => updateTaskStatus(task.id, 'IN_REVIEW')}>
                                                <Send size={13} /> Submit Review
                                            </button>
                                        )
                                    )}
                                    {task.status === 'IN_REVIEW' && (
                                        task.totalSubTask > 0 ? (
                                            <button className="btn-glass btn-sm" onClick={() => navigate(`/user/tasks/${task.id}/board`)}>
                                                <Layout size={13} /> Board
                                            </button>
                                        ) : (
                                            <span className="muted-inline">Chờ duyệt</span>
                                        )
                                    )}
                                    {task.status === 'DONE' && <span className="success-inline">Completed</span>}
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
    );

    const renderSubtaskCards = (items) => {
        const groups = groupSubtasksByParent(items);

        return (
            <div className="user-subtask-grid">
            {groups.length === 0 ? (
                <div className="glass-panel user-empty-panel">
                    <ListTodo size={24} />
                    <span>{search ? 'No subtasks match your search.' : 'No subtasks found.'}</span>
                </div>
            ) : groups.map((group) => (
                    <div key={group.key} className={`glass-panel user-subtask-card user-task-group-card ${group.hasOverdue ? 'overdue' : ''}`}>
                        <div className="user-task-group-head">
                            <div>
                                <span className="user-task-group-eyebrow">
                                    Task cha {group.parentTaskCode ? `• ${group.parentTaskCode}` : ''}
                                </span>
                                <h3>{group.parentTaskName}</h3>
                                {group.parentTaskDescription && (
                                    <p>{group.parentTaskDescription}</p>
                                )}
                            </div>
                            <span className={`badge ${group.allDone ? 'done' : group.hasOverdue ? 'danger' : 'in-progress'}`}>
                                {group.completedCount}/{group.total} của bạn xong
                            </span>
                        </div>

                        <div className="user-subtask-meta">
                            {group.parentStatus && <span>{getStatusBadge(group.parentStatus)}</span>}
                            <span><Calendar size={13} /> Deadline cha: {formatDate(group.parentDeadline)}</span>
                            <span><Flag size={13} /> Cao nhất: {group.highestPriority || '—'}</span>
                            <span><ListTodo size={13} /> {group.total} việc của bạn</span>
                            {group.dueSoonCount > 0 && <span className="days-badge warning">{group.dueSoonCount} sắp hạn</span>}
                            {group.hasOverdue && <span className="days-badge danger">Có việc quá hạn</span>}
                        </div>

                        <div className="user-task-group-list">
                            {group.subtasks.map((subtask) => (
                                <div key={subtask.id} className={`user-task-group-item ${subtask.status === 'DONE' ? 'done' : ''}`}>
                                    <div>
                                        <strong>{subtask.title}</strong>
                                        <p>
                                            <Calendar size={12} /> {formatDate(subtask.deadline)}
                                            <span>•</span>
                                            <Flag size={12} /> {subtask.priority || '—'}
                                            <span>•</span>
                                            {getDaysBadge(subtask.daysLeft, subtask.status)}
                                        </p>
                                    </div>
                                    {getStatusBadge(subtask.status)}
                                </div>
                            ))}
                        </div>

                        <div className="user-subtask-footer">
                            {getPriorityBadge(group.highestPriority)}
                            <button className="btn-glass btn-sm" onClick={() => openSubtaskGroupDetail(group)}>
                                <Eye size={13} /> Detail
                            </button>
                            {group.parentStatus === 'IN_REVIEW' ? (
                                <span className="success-inline">Chờ manager duyệt</span>
                            ) : group.allDone ? (
                                <span className="success-inline">Phần của bạn đã xong</span>
                            ) : (
                                <button className="btn-primary btn-sm" onClick={() => navigate(`/user/tasks/${group.taskId}/board`)}>
                                    <Layout size={13} /> Thực hiện
                                </button>
                            )}
                        </div>
                    </div>
            ))}
        </div>
        );
    };

    if (loading) return <div className="page-loading"><LoadingCompass size={40} /></div>;

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">My Tasks</h1>
                    <p className="page-subtitle">Task cha bạn phụ trách và các subtask được giao riêng cho bạn</p>
                </div>
                <div className="search-container">
                    <Search className="search-icon" size={16} />
                    <input
                        type="text"
                        className="input-glass"
                        placeholder="Search tasks or subtasks..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: '2.2rem', width: '280px' }}
                    />
                </div>
            </div>

            {fetchError && <div className="form-error-banner">{fetchError}</div>}

            <div className="user-task-summary">
                <button className={`glass-panel user-task-stat ${tab === TABS.MAIN ? 'active' : ''}`} onClick={() => setTab(TABS.MAIN)}>
                    <ListTodo size={18} />
                    <span>Task tôi phụ trách chính</span>
                    <strong>{stats.main}</strong>
                </button>
                <button className={`glass-panel user-task-stat ${tab === TABS.SUBTASKS ? 'active' : ''}`} onClick={() => setTab(TABS.SUBTASKS)}>
                    <CheckCircle size={18} />
                    <span>Subtask được giao</span>
                    <strong>{stats.subtasks}</strong>
                </button>
                <button className={`glass-panel user-task-stat ${tab === TABS.DUE_SOON ? 'active' : ''}`} onClick={() => setTab(TABS.DUE_SOON)}>
                    <Clock size={18} />
                    <span>Sắp tới hạn</span>
                    <strong>{stats.dueSoon}</strong>
                </button>
                <button className={`glass-panel user-task-stat ${tab === TABS.OVERDUE ? 'active' : ''}`} onClick={() => setTab(TABS.OVERDUE)}>
                    <AlertTriangle size={18} />
                    <span>Quá hạn</span>
                    <strong>{stats.overdue}</strong>
                </button>
                <button className={`glass-panel user-task-stat ${tab === TABS.DONE ? 'active' : ''}`} onClick={() => setTab(TABS.DONE)}>
                    <CheckCircle size={18} />
                    <span>Đã hoàn thành</span>
                    <strong>{stats.done}</strong>
                </button>
            </div>

            {tab === TABS.MAIN && renderParentTaskTable(filteredMainTasks)}
            {tab === TABS.SUBTASKS && renderSubtaskCards(filteredSubtasks)}
            {[TABS.DUE_SOON, TABS.OVERDUE, TABS.DONE].includes(tab) && (
                <div className="user-task-sections">
                    <section>
                        <h2 className="section-title-small">Task tôi phụ trách chính</h2>
                        {renderParentTaskTable(filteredMainTasks)}
                    </section>
                    <section>
                        <h2 className="section-title-small">Subtask được giao cho tôi</h2>
                        {renderSubtaskCards(filteredSubtasks)}
                    </section>
                </div>
            )}

            {selectedTask && (
                <DetailedTaskDrawer
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onStatusChange={(id, status) => updateTaskStatus(id, status)}
                    onTaskChanged={fetchData}
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

export default UserTasksWithSubtasks;
