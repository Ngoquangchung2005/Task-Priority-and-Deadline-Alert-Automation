import React from 'react';
import { X, Calendar, User, Flag, Bell, FileText, Clock } from 'lucide-react';

const TaskDetailDrawer = ({ task, onClose, onStatusChange, isUser = false }) => {
    if (!task) return null;

    const getStatusColor = (status) => {
        const map = { DONE: '#10B981', IN_PROGRESS: '#3B82F6', PENDING: '#F59E0B', IN_REVIEW: '#8B5CF6', OVERDUE: '#EF4444', CANCELLED: '#64748B', ARCHIVED: '#64748B' };
        return map[status] || '#94A3B8';
    };

    const getPriorityColor = (priority) => {
        const map = { HIGH: '#F43F5E', MEDIUM: '#F59E0B', LOW: '#10B981' };
        return map[priority] || '#94A3B8';
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="drawer-panel glass-panel" onClick={e => e.stopPropagation()}>
                <div className="drawer-header">
                    <h2 className="drawer-title">{task.taskName}</h2>
                    <button className="drawer-close" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="drawer-body">
                    {/* Status */}
                    <div className="drawer-section">
                        <span className="drawer-label">Status</span>
                        <span className="badge" style={{ background: `${getStatusColor(task.archived ? 'ARCHIVED' : task.status)}22`, color: getStatusColor(task.archived ? 'ARCHIVED' : task.status) }}>
                            {task.archived ? 'ARCHIVED' : task.status?.replace('_', ' ')}
                        </span>
                    </div>

                    {/* Priority */}
                    <div className="drawer-section">
                        <span className="drawer-label"><Flag size={14} /> Priority</span>
                        <span className="badge-priority" style={{ background: `${getPriorityColor(task.priority)}22`, color: getPriorityColor(task.priority) }}>
                            {task.priority}
                        </span>
                    </div>

                    {/* Assignee */}
                    <div className="drawer-section">
                        <span className="drawer-label"><User size={14} /> Assignee</span>
                        <div className="assignee-cell">
                            <div className="avatar">{task.assigneeEmail?.charAt(0).toUpperCase()}</div>
                            <span>{task.assigneeEmail}</span>
                        </div>
                    </div>

                    {/* Deadline */}
                    <div className="drawer-section">
                        <span className="drawer-label"><Calendar size={14} /> Deadline</span>
                        <span>{task.deadline ? new Date(task.deadline).toLocaleString('vi-VN') : '—'}</span>
                        {task.daysLeft !== null && task.status !== 'CANCELLED' && !task.archived && (
                            <span className={`days-badge ${task.daysLeft < 0 ? 'danger' : task.daysLeft <= 3 ? 'warning' : 'info'}`} style={{ marginLeft: '0.5rem' }}>
                                {task.daysLeft < 0 ? `${Math.abs(task.daysLeft)} ngày trễ` : task.daysLeft === 0 ? 'Hôm nay' : `${task.daysLeft} ngày nữa`}
                            </span>
                        )}
                    </div>

                    {/* Description */}
                    {task.taskDescription && (
                        <div className="drawer-section">
                            <span className="drawer-label"><FileText size={14} /> Description</span>
                            <p className="drawer-text">{task.taskDescription}</p>
                        </div>
                    )}

                    {/* Admin Note */}
                    {task.adminNote && (
                        <div className="drawer-section">
                            <span className="drawer-label">📝 Admin Note</span>
                            <p className="drawer-text">{task.adminNote}</p>
                        </div>
                    )}

                    {/* Manager */}
                    <div className="drawer-section">
                        <span className="drawer-label"><User size={14} /> Manager</span>
                        <span>{task.ownerName || task.managerEmail}</span>
                    </div>

                    {/* Reminder Info */}
                    <div className="drawer-section">
                        <span className="drawer-label"><Bell size={14} /> Reminders Sent</span>
                        <span>{task.reminderCount || 0}</span>
                        {task.lastRemindedAt && <span style={{ color: '#94A3B8', marginLeft: '0.5rem', fontSize: '0.8rem' }}>Last: {new Date(task.lastRemindedAt).toLocaleString('vi-VN')}</span>}
                    </div>

                    {/* Timeline */}
                    <div className="drawer-section">
                        <span className="drawer-label"><Clock size={14} /> Timeline</span>
                        <div className="timeline">
                            <div className="timeline-item">
                                <span className="timeline-dot created"></span>
                                <span>Created: {task.createdAt ? new Date(task.createdAt).toLocaleString('vi-VN') : '—'}</span>
                            </div>
                            {task.lastRemindedAt && (
                                <div className="timeline-item">
                                    <span className="timeline-dot reminder"></span>
                                    <span>Reminder sent: {new Date(task.lastRemindedAt).toLocaleString('vi-VN')}</span>
                                </div>
                            )}
                            {task.escalatedAt && (
                                <div className="timeline-item">
                                    <span className="timeline-dot escalated"></span>
                                    <span>Escalated: {new Date(task.escalatedAt).toLocaleString('vi-VN')}</span>
                                </div>
                            )}
                            {task.completedAt && (
                                <div className="timeline-item">
                                    <span className="timeline-dot completed"></span>
                                    <span>Completed: {new Date(task.completedAt).toLocaleString('vi-VN')}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="drawer-actions">
                        {task.archived ? null : isUser ? (
                            <>
                                {task.status === 'PENDING' && <button className="btn-primary" onClick={() => onStatusChange(task.id, 'IN_PROGRESS')}>▶ Start Task</button>}
                                {task.status === 'IN_PROGRESS' && <button className="btn-primary" style={{ background: '#10B981' }} onClick={() => onStatusChange(task.id, 'IN_REVIEW')}>Submit Review</button>}
                            </>
                        ) : (
                            <>
                                {task.status === 'IN_REVIEW' && (
                                    <button className="btn-primary" style={{ background: '#10B981' }} onClick={() => onStatusChange(task.id, 'DONE')}>
                                        ✓ Approve
                                    </button>
                                )}
                                {task.status === 'PENDING' && (
                                    <button className="btn-primary" onClick={() => onStatusChange(task.id, 'IN_PROGRESS')}>▶ Start</button>
                                )}
                                {task.status === 'IN_PROGRESS' && (
                                    <button className="btn-primary" onClick={() => onStatusChange(task.id, 'DONE')}>✓ Complete</button>
                                )}
                            </>
                        )}
                        <button className="btn-glass" onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskDetailDrawer;
