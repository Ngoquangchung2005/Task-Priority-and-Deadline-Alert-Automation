import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import {
    Archive,
    Bell,
    Calendar,
    CheckCircle,
    Clock,
    Edit3,
    FileText,
    Flag,
    History,
    Layout,
    Save,
    Trash2,
    User,
    X
} from 'lucide-react';

const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'OVERDUE'];

const formatDateTime = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('vi-VN');
};

const toDatetimeLocalValue = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (input) => String(input).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const statusLabel = (status) => ({
    PENDING: 'Pending',
    TODO: 'To Do',
    IN_PROGRESS: 'In Progress',
    IN_REVIEW: 'In Review',
    OVERDUE: 'Overdue',
    DONE: 'Done',
    CANCELLED: 'Cancelled'
}[status] || status || '—');

const statusClass = (status) => ({
    DONE: 'done',
    IN_PROGRESS: 'in-progress',
    IN_REVIEW: 'in-review',
    OVERDUE: 'danger',
    PENDING: 'pending',
    TODO: 'pending',
    CANCELLED: 'danger',
    ARCHIVED: 'archived'
}[status] || 'pending');

const priorityClass = (priority) => (priority || 'LOW').toLowerCase();

const nextStatus = (status) => ({
    PENDING: 'IN_PROGRESS',
    TODO: 'IN_PROGRESS',
    IN_PROGRESS: 'IN_REVIEW',
    IN_REVIEW: 'DONE',
    OVERDUE: 'IN_PROGRESS'
}[status]);

const actionClass = (type) => ({
    CREATED: 'created',
    UPDATED: 'updated',
    REASSIGNED: 'updated',
    DEADLINE_CHANGED: 'reminder',
    STATUS_CHANGED: 'status',
    CANCELLED: 'danger',
    ARCHIVED: 'archived',
    UNARCHIVED: 'updated',
    REMINDER_SENT: 'reminder',
    ESCALATED: 'escalated',
    COMPLETED: 'completed'
}[type] || 'updated');

const DetailedTaskDrawer = ({ task, onClose, onStatusChange, isUser = false, onTaskChanged }) => {
    const [activeTab, setActiveTab] = useState('info');
    const [detailTask, setDetailTask] = useState(task);
    const [subtasks, setSubtasks] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editingSubtaskId, setEditingSubtaskId] = useState(null);
    const [subtaskDraft, setSubtaskDraft] = useState({});

    const taskId = task?.id;
    const isManagerView = !isUser;

    const refreshDetail = async () => {
        if (!taskId) return;
        setError('');
        try {
            const [taskRes, subtaskRes, logRes] = await Promise.allSettled([
                api.get(`/tasks/${taskId}`),
                api.get(`/subtasks/task/${taskId}`),
                api.get(`/tasks/${taskId}/logs`)
            ]);

            if (taskRes.status === 'fulfilled') {
                setDetailTask(taskRes.value.data);
            } else {
                setDetailTask(task);
            }

            setSubtasks(subtaskRes.status === 'fulfilled' && Array.isArray(subtaskRes.value.data)
                ? subtaskRes.value.data
                : []);
            setLogs(logRes.status === 'fulfilled' && Array.isArray(logRes.value.data)
                ? logRes.value.data
                : []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load task detail');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setDetailTask(task);
        setSubtasks([]);
        setLogs([]);
        setActiveTab('info');
        setEditingSubtaskId(null);
        setSubtaskDraft({});
        setLoading(true);
        refreshDetail();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskId]);

    const completedSubtasks = subtasks.filter((subtask) => subtask.status === 'DONE').length;
    const progress = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;

    const reminderLogs = useMemo(
        () => logs.filter((log) => ['REMINDER_SENT', 'ESCALATED'].includes(log.actionType)),
        [logs]
    );

    const updateSubtaskStatus = async (subtask, status) => {
        try {
            await api.put(`/subtasks/${subtask.id}/status`, { status });
            await refreshDetail();
            onTaskChanged?.();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update subtask status');
        }
    };

    const deleteSubtask = async (subtask) => {
        if (!window.confirm(`Delete subtask "${subtask.title}"?`)) return;
        try {
            await api.delete(`/subtasks/${subtask.id}`);
            await refreshDetail();
            onTaskChanged?.();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete subtask');
        }
    };

    const startEditSubtask = (subtask) => {
        setEditingSubtaskId(subtask.id);
        setSubtaskDraft({
            title: subtask.title || '',
            assignedTo: subtask.assignedTo || '',
            deadline: toDatetimeLocalValue(subtask.deadline),
            priority: subtask.priority || 'MEDIUM',
            status: subtask.status || 'TODO',
            positionIndex: subtask.positionIndex ?? 0
        });
    };

    const saveSubtask = async (subtask) => {
        if (!subtaskDraft.title?.trim() || !subtaskDraft.assignedTo?.trim()) {
            setError('Subtask title and assignee are required');
            return;
        }

        try {
            await api.put(`/subtasks/${subtask.id}`, {
                ...subtaskDraft,
                title: subtaskDraft.title.trim(),
                assignedTo: subtaskDraft.assignedTo.trim(),
                deadline: subtaskDraft.deadline || null
            });
            setEditingSubtaskId(null);
            setSubtaskDraft({});
            await refreshDetail();
            onTaskChanged?.();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save subtask');
        }
    };

    const handleParentStatusChange = async (status) => {
        if (!onStatusChange) return;
        await onStatusChange(detailTask.id, status);
        onTaskChanged?.();
        refreshDetail();
    };

    if (!task) return null;

    const currentTask = detailTask || task;
    const canChangeParent = !currentTask.archived && !['DONE', 'CANCELLED'].includes(currentTask.status);
    const hasSubtasks = subtasks.length > 0 || (currentTask.totalSubTask ?? 0) > 0;
    const allSubtasksDone = subtasks.length > 0 && completedSubtasks === subtasks.length;
    const parentNextStatus = nextStatus(currentTask.status);
    const canStartParent = parentNextStatus === 'IN_PROGRESS';
    const canSubmitParentReview = parentNextStatus === 'IN_REVIEW' && (!hasSubtasks || allSubtasksDone);
    const canApproveParentDone = isManagerView
        && parentNextStatus === 'DONE'
        && currentTask.status === 'IN_REVIEW'
        && (!hasSubtasks || allSubtasksDone);
    const canUseParentAction = onStatusChange
        && canChangeParent
        && parentNextStatus
        && (isManagerView
            ? (canStartParent || canSubmitParentReview || canApproveParentDone)
            : (!hasSubtasks && parentNextStatus !== 'DONE'));

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="drawer-panel detail-drawer-panel glass-panel" onClick={(event) => event.stopPropagation()}>
                <div className="drawer-header detail-drawer-header">
                    <div>
                        <p className="detail-drawer-code">{currentTask.taskId}</p>
                        <h2 className="drawer-title">{currentTask.taskName}</h2>
                        <div className="detail-drawer-badges">
                            <span className={`badge ${statusClass(currentTask.archived ? 'ARCHIVED' : currentTask.status)}`}>
                                {currentTask.archived ? 'Archived' : statusLabel(currentTask.status)}
                            </span>
                            <span className={`badge-priority ${priorityClass(currentTask.priority)}`}>
                                {currentTask.priority || '—'}
                            </span>
                        </div>
                    </div>
                    <button className="drawer-close" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="detail-drawer-tabs">
                    <button className={activeTab === 'info' ? 'active' : ''} onClick={() => setActiveTab('info')}>Thông tin task</button>
                    <button className={activeTab === 'subtasks' ? 'active' : ''} onClick={() => setActiveTab('subtasks')}>Danh sách subtask</button>
                    <button className={activeTab === 'logs' ? 'active' : ''} onClick={() => setActiveTab('logs')}>Lịch sử hoạt động</button>
                    <button className={activeTab === 'notifications' ? 'active' : ''} onClick={() => setActiveTab('notifications')}>Nhắc việc</button>
                </div>

                <div className="drawer-body detail-drawer-body">
                    {error && <div className="form-error-banner">{error}</div>}
                    {loading ? (
                        <div className="detail-loading">Loading detail...</div>
                    ) : (
                        <>
                            {activeTab === 'info' && (
                                <div className="detail-info-grid">
                                    <DetailField icon={<FileText size={14} />} label="Mã task" value={currentTask.taskId} />
                                    <DetailField icon={<FileText size={14} />} label="Tên task" value={currentTask.taskName} />
                                    <DetailField label="Mô tả" value={currentTask.taskDescription || '—'} wide />
                                    <DetailField icon={<User size={14} />} label="Người phụ trách chính" value={currentTask.assigneeEmail} />
                                    <DetailField icon={<User size={14} />} label="Manager" value={currentTask.managerEmail} />
                                    <DetailField icon={<User size={14} />} label="Người tạo" value={currentTask.createdBy || currentTask.ownerName} />
                                    <DetailField icon={<Calendar size={14} />} label="Deadline" value={formatDateTime(currentTask.deadline)} />
                                    <DetailField icon={<Flag size={14} />} label="Priority" value={currentTask.priority} />
                                    <DetailField icon={<Clock size={14} />} label="Status" value={statusLabel(currentTask.status)} />
                                    <DetailField icon={<Bell size={14} />} label="Reminder count" value={currentTask.reminderCount ?? 0} />
                                    <DetailField label="Last reminded at" value={formatDateTime(currentTask.lastRemindedAt)} />
                                    <DetailField label="Escalated at" value={formatDateTime(currentTask.escalatedAt)} />
                                    <DetailField label="Completed at" value={formatDateTime(currentTask.completedAt)} />
                                    <DetailField icon={<Archive size={14} />} label="Archived" value={currentTask.archived ? 'Yes' : 'No'} />
                                    <DetailField label="Archived at" value={formatDateTime(currentTask.archivedAt)} />
                                    <DetailField label="Admin note" value={currentTask.adminNote || '—'} wide />
                                    <DetailField label="Source input" value={currentTask.sourceInput || '—'} wide />

                                    <div className="detail-progress-card">
                                        <span>{completedSubtasks}/{subtasks.length} subtasks done</span>
                                        <div className="kanban-progress-bar">
                                            <div className="kanban-progress-fill" style={{ width: `${progress}%` }}></div>
                                        </div>
                                        <strong>{progress}%</strong>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'subtasks' && (
                                <div className="detail-subtask-list">
                                    {subtasks.length === 0 ? (
                                        <div className="detail-empty">No subtasks.</div>
                                    ) : subtasks.map((subtask) => (
                                        <div key={subtask.id} className="detail-subtask-card">
                                            {editingSubtaskId === subtask.id ? (
                                                <div className="detail-subtask-edit">
                                                    <input
                                                        className="input-field"
                                                        value={subtaskDraft.title || ''}
                                                        onChange={(event) => setSubtaskDraft((draft) => ({ ...draft, title: event.target.value }))}
                                                        placeholder="Subtask title"
                                                    />
                                                    <input
                                                        className="input-field"
                                                        type="email"
                                                        value={subtaskDraft.assignedTo || ''}
                                                        onChange={(event) => setSubtaskDraft((draft) => ({ ...draft, assignedTo: event.target.value }))}
                                                        placeholder="assignee@example.com"
                                                    />
                                                    <input
                                                        className="input-field"
                                                        type="datetime-local"
                                                        value={subtaskDraft.deadline || ''}
                                                        onChange={(event) => setSubtaskDraft((draft) => ({ ...draft, deadline: event.target.value }))}
                                                    />
                                                    <select
                                                        className="input-field"
                                                        value={subtaskDraft.priority || 'MEDIUM'}
                                                        onChange={(event) => setSubtaskDraft((draft) => ({ ...draft, priority: event.target.value }))}
                                                    >
                                                        <option value="HIGH">High</option>
                                                        <option value="MEDIUM">Medium</option>
                                                        <option value="LOW">Low</option>
                                                    </select>
                                                    <div className="detail-subtask-edit-actions">
                                                        <button className="btn-primary btn-sm" onClick={() => saveSubtask(subtask)}><Save size={13} /> Save</button>
                                                        <button className="btn-glass btn-sm" onClick={() => setEditingSubtaskId(null)}>Cancel</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="detail-subtask-main">
                                                        <div>
                                                            <strong>{subtask.title}</strong>
                                                            <div className="detail-subtask-meta">
                                                                <span><User size={12} /> {subtask.assignedTo || '—'}</span>
                                                                <span><Calendar size={12} /> {formatDateTime(subtask.deadline)}</span>
                                                                <span>#{subtask.positionIndex ?? 0}</span>
                                                            </div>
                                                        </div>
                                                        <span className={`badge ${statusClass(subtask.status)}`}>{statusLabel(subtask.status)}</span>
                                                    </div>
                                                    <div className="detail-subtask-actions">
                                                        <span className={`badge-priority ${priorityClass(subtask.priority)}`}>{subtask.priority || '—'}</span>
                                                        {isManagerView ? (
                                                            <select
                                                                className="filter-select"
                                                                value={subtask.status}
                                                                onChange={(event) => updateSubtaskStatus(subtask, event.target.value)}
                                                                disabled={currentTask.archived || currentTask.status === 'CANCELLED'}
                                                            >
                                                                {STATUS_OPTIONS.map((status) => (
                                                                    <option key={status} value={status}>{statusLabel(status)}</option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <span className="muted-inline">Cập nhật trong board</span>
                                                        )}
                                                        {isManagerView && !currentTask.archived && currentTask.status !== 'CANCELLED' && (
                                                            <>
                                                                <button className="btn-glass btn-sm" onClick={() => startEditSubtask(subtask)}><Edit3 size={13} /> Edit</button>
                                                                <button className="btn-glass btn-sm action-danger-inline" onClick={() => deleteSubtask(subtask)}><Trash2 size={13} /> Delete</button>
                                                            </>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'logs' && (
                                <LogTimeline logs={logs} emptyText="No logs yet." />
                            )}

                            {activeTab === 'notifications' && (
                                <div className="detail-notification-tab">
                                    <div className="detail-reminder-summary">
                                        <DetailField icon={<Bell size={14} />} label="Reminder count" value={currentTask.reminderCount ?? 0} />
                                        <DetailField label="Last reminded at" value={formatDateTime(currentTask.lastRemindedAt)} />
                                        <DetailField label="Escalated at" value={formatDateTime(currentTask.escalatedAt)} />
                                    </div>
                                    <LogTimeline logs={reminderLogs} emptyText="No reminder or escalation logs yet." />
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="drawer-actions detail-drawer-actions">
                    {isManagerView && (
                        <button className="btn-glass" onClick={() => window.location.assign(`/manager/tasks/${currentTask.id}/board`)}>
                            <Layout size={16} /> Board
                        </button>
                    )}
                    {isUser && currentTask.totalSubTask > 0 && (
                        <button className="btn-glass" onClick={() => window.location.assign(`/user/tasks/${currentTask.id}/board`)}>
                            <Layout size={16} /> Board
                        </button>
                    )}
                    {canUseParentAction && (
                        <button className="btn-primary" onClick={() => handleParentStatusChange(parentNextStatus)}>
                            <CheckCircle size={16} /> {parentNextStatus === 'DONE' ? 'Duyệt DONE' : statusLabel(parentNextStatus)}
                        </button>
                    )}
                    <button className="btn-glass" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

const DetailField = ({ icon, label, value, wide = false }) => (
    <div className={`detail-field ${wide ? 'wide' : ''}`}>
        <span className="drawer-label">{icon}{label}</span>
        <p>{value ?? '—'}</p>
    </div>
);

const LogTimeline = ({ logs, emptyText }) => (
    <div className="detail-log-timeline">
        {logs.length === 0 ? (
            <div className="detail-empty">{emptyText}</div>
        ) : logs.map((log) => (
            <div key={log.id} className="detail-log-item">
                <span className={`timeline-dot ${actionClass(log.actionType)}`}></span>
                <div>
                    <strong>{log.actionType}</strong>
                    <p>{log.actionMessage || '—'}</p>
                    <span>{formatDateTime(log.createdAt)}</span>
                </div>
            </div>
        ))}
    </div>
);

export default DetailedTaskDrawer;
