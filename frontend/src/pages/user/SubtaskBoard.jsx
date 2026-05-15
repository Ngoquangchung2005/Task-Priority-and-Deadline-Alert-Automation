import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../../services/api';
import LoadingCompass from '../../components/LoadingCompass';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, GripVertical, CheckCircle, AlertTriangle, Clock, ListTodo, Flag, User, Calendar, Lock } from 'lucide-react';

const COLUMNS = [
    { id: 'TODO', title: 'To Do', icon: <ListTodo size={16} />, color: '#64748B' },
    { id: 'IN_PROGRESS', title: 'In Progress', icon: <Clock size={16} />, color: '#3B82F6' },
    { id: 'DONE', title: 'Done', icon: <CheckCircle size={16} />, color: '#10B981' },
];

const getColumnId = (status) => {
    if (status === 'DONE') return 'DONE';
    if (['IN_PROGRESS', 'IN_REVIEW', 'OVERDUE'].includes(status)) return 'IN_PROGRESS';
    return 'TODO';
};

const identityLocalPart = (value) => {
    if (!value) return '';
    const normalized = value.trim().toLowerCase();
    return normalized.includes('@') ? normalized.split('@')[0] : normalized;
};

const sameIdentity = (left, right) => {
    if (!left || !right) return false;
    const normalizedLeft = left.trim().toLowerCase();
    const normalizedRight = right.trim().toLowerCase();
    return normalizedLeft === normalizedRight
        || normalizedLeft === identityLocalPart(normalizedRight)
        || identityLocalPart(normalizedLeft) === normalizedRight
        || identityLocalPart(normalizedLeft) === identityLocalPart(normalizedRight);
};

const reorderSubtasks = (items, source, destination, subtaskId) => {
    const movedSubtask = items.find((item) => item.id === subtaskId);

    if (!movedSubtask) {
        return items;
    }

    const columnItems = Object.fromEntries(
        COLUMNS.map((column) => [
            column.id,
            items
                .filter((item) => getColumnId(item.status) === column.id && item.id !== subtaskId)
                .sort((a, b) => (a.positionIndex ?? 0) - (b.positionIndex ?? 0)),
        ]),
    );

    const destinationItems = [...(columnItems[destination.droppableId] ?? [])];
    destinationItems.splice(destination.index, 0, {
        ...movedSubtask,
        status: destination.droppableId,
    });
    columnItems[destination.droppableId] = destinationItems;

    return COLUMNS.flatMap((column) =>
        (columnItems[column.id] ?? []).map((item, index) => ({
            ...item,
            positionIndex: index,
        })),
    );
};

const SubtaskBoard = () => {
    const { taskId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [task, setTask] = useState(null);
    const [subtasks, setSubtasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [fetchError, setFetchError] = useState('');

    const fetchData = async () => {
        try {
            const [taskRes, subtaskRes] = await Promise.all([
                api.get(`/tasks/my-tasks/${taskId}`),
                api.get(`/tasks/my-tasks/${taskId}/subtasks`)
            ]);
            setTask(taskRes.data);
            setSubtasks(Array.isArray(subtaskRes.data) ? subtaskRes.data : []);
            setFetchError('');
        } catch (err) {
            console.error('Failed to load board data', err?.response?.status, err);
            setFetchError(err.response?.data?.message || 'Không tải được dữ liệu board subtask');
        } finally {
            setLoading(false);
        }
    };

    useAutoRefresh(fetchData, [taskId], 10000, !isDragging);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const currentUserEmail = user?.email?.toLowerCase();
    const isParentAssignee = sameIdentity(task?.assigneeEmail, currentUserEmail);
    const parentLocked = task?.archived || ['DONE', 'CANCELLED'].includes(task?.status);
    const canMoveSubtask = (subtask) => (
        !parentLocked
        && currentUserEmail
        && sameIdentity(subtask.assignedTo, currentUserEmail)
    );

    const getColumnSubtasks = (columnId) => subtasks
        .filter((subtask) => getColumnId(subtask.status) === columnId)
        .sort((a, b) => (a.positionIndex ?? 0) - (b.positionIndex ?? 0));

    const handleDragEnd = async (result) => {
        const { destination, source, draggableId } = result;
        setIsDragging(false);
        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const subtaskId = Number.parseInt(draggableId, 10);
        const movedSubtask = subtasks.find((subtask) => subtask.id === subtaskId);
        if (!movedSubtask || !canMoveSubtask(movedSubtask)) {
            showToast('Bạn chỉ có thể cập nhật subtask được giao cho mình', 'error');
            return;
        }

        const newStatus = destination.droppableId;
        const reorderedSubtasks = reorderSubtasks(subtasks, source, destination, subtaskId);

        setSubtasks(reorderedSubtasks);

        try {
            const statusRes = await api.patch(`/tasks/my-tasks/subtasks/${subtaskId}/status`, { status: newStatus });
            await api.patch(`/tasks/my-tasks/subtasks/${subtaskId}/position`, { position: destination.index });
            await fetchData();
            if (statusRes.data?.parentStatus === 'IN_REVIEW') {
                showToast('Tất cả subtask đã xong, task cha đang chờ manager duyệt');
            } else if (reorderedSubtasks.length > 0 && reorderedSubtasks.every((subtask) => subtask.status === 'DONE')) {
                showToast('Phần subtask của bạn đã xong');
            }
        } catch {
            showToast('Lỗi cập nhật trạng thái', 'error');
            fetchData();
        }
    };

    const doneCount = subtasks.filter(s => s.status === 'DONE').length;
    const mySubtasks = subtasks.filter((subtask) => sameIdentity(subtask.assignedTo, currentUserEmail));
    const myDoneCount = mySubtasks.filter((subtask) => subtask.status === 'DONE').length;
    const progress = subtasks.length > 0 ? Math.round((doneCount / subtasks.length) * 100) : 0;

    const getPriorityBadge = (p) => {
        if (!p) return null;
        return <span className={`badge-priority ${p.toLowerCase()}`}>{p.charAt(0) + p.slice(1).toLowerCase()}</span>;
    };

    const getStatusBadge = (status) => {
        const map = { DONE: 'done', IN_PROGRESS: 'in-progress', PENDING: 'pending', IN_REVIEW: 'in-review', OVERDUE: 'danger', TODO: 'pending' };
        const label = { DONE: 'Done', IN_PROGRESS: 'In Progress', PENDING: 'Pending', IN_REVIEW: 'In Review', OVERDUE: 'Overdue', TODO: 'To Do' };
        return <span className={`badge ${map[status] || 'pending'}`}>{label[status] || status}</span>;
    };

    const getOverdueBadge = (subtask) => {
        if (subtask.status === 'DONE' || !subtask.deadline) return null;
        const now = new Date();
        const dl = new Date(subtask.deadline);
        const diffMs = dl - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return <span className="kanban-badge-overdue">🔴 Overdue ({Math.abs(diffDays)}d)</span>;
        } else if (diffDays <= 2) {
            return <span className="kanban-badge-due-soon">🟡 Due soon ({diffDays}d)</span>;
        }
        return null;
    };

    if (loading) return <div className="page-loading"><LoadingCompass size={40} /></div>;
    if (!task) {
        return (
            <div className="page-container fade-in">
                <div className="form-error-banner">{fetchError || 'Task not found.'}</div>
                <button className="btn-glass btn-sm" onClick={() => navigate('/user/tasks')}>
                    <ArrowLeft size={16} /> Quay lại
                </button>
            </div>
        );
    }

    return (
        <div className="page-container fade-in">
            {/* Header */}
            <div className="kanban-header">
                <div className="kanban-header-left">
                    <button className="btn-glass btn-sm" onClick={() => navigate('/user/tasks')}>
                        <ArrowLeft size={16} /> Quay lại
                    </button>
                    <div className="kanban-task-info">
                        <h1 className="kanban-task-title">{task.taskName}</h1>
                        <div className="kanban-task-meta">
                            {getPriorityBadge(task.priority)}
                            {getStatusBadge(task.status)}
                            {task.deadline && (
                                <span className="kanban-deadline">
                                    <Calendar size={13} /> {new Date(task.deadline).toLocaleDateString('vi-VN')}
                                    {task.daysLeft !== null && task.daysLeft <= 3 && task.status !== 'DONE' && (
                                        <span className={`days-inline ${task.daysLeft < 0 ? 'danger' : 'warning'}`}>
                                            {task.daysLeft < 0 ? `${Math.abs(task.daysLeft)}d late` : task.daysLeft === 0 ? 'Hôm nay' : `${task.daysLeft}d left`}
                                        </span>
                                    )}
                                </span>
                            )}
                        </div>
                        <div className="kanban-task-people">
                            <span className="kanban-people-item">
                                <User size={13} /> <strong>Giao bởi:</strong> {task.ownerName || task.managerEmail?.split('@')[0]}
                            </span>
                            <span className="kanban-people-item">
                                <User size={13} /> <strong>Thực hiện:</strong> {task.assigneeEmail?.split('@')[0]}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="kanban-progress-area">
                    <span className="kanban-progress-text">
                        {isParentAssignee
                            ? `${doneCount}/${subtasks.length} subtasks completed`
                            : `${doneCount}/${subtasks.length} my subtasks completed`}
                    </span>
                    <div className="kanban-progress-bar">
                        <div className="kanban-progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                    <span className="kanban-progress-pct">{progress}%</span>
                    {isParentAssignee && subtasks.length !== mySubtasks.length && (
                        <span className="form-help-text">
                            Bạn phụ trách task cha nên thấy toàn bộ subtask. Phần của bạn: {myDoneCount}/{mySubtasks.length}.
                        </span>
                    )}
                </div>
            </div>

            {fetchError && <div className="form-error-banner">{fetchError}</div>}
            {parentLocked && (
                <div className="form-muted-banner">
                    Task cha đã {task.archived ? 'archive' : `ở trạng thái ${task.status}`}; board chỉ cho phép xem lại.
                </div>
            )}

            {/* Kanban Board */}
            <DragDropContext onDragStart={() => setIsDragging(true)} onDragEnd={handleDragEnd}>
                <div className="kanban-board">
                    {COLUMNS.map(col => (
                        <div className="kanban-column" key={col.id}>
                            <div className="kanban-column-header" style={{ borderTopColor: col.color }}>
                                <div className="kanban-column-title">
                                    {col.icon}
                                    <span>{col.title}</span>
                                    <span className="kanban-column-count">{getColumnSubtasks(col.id).length}</span>
                                </div>
                            </div>

                            <Droppable droppableId={col.id}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`kanban-column-body ${snapshot.isDraggingOver ? 'kanban-drop-active' : ''}`}
                                    >
                                        {getColumnSubtasks(col.id).length === 0 && (
                                            <div className="detail-empty">No subtasks in this column.</div>
                                        )}
                                        {getColumnSubtasks(col.id).map((subtask, index) => {
                                            const movable = canMoveSubtask(subtask);
                                            return (
                                            <Draggable
                                                key={subtask.id}
                                                draggableId={String(subtask.id)}
                                                index={index}
                                                isDragDisabled={!movable}
                                            >
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...(movable ? provided.dragHandleProps : {})}
                                                        style={provided.draggableProps.style}
                                                        className={`kanban-card kanban-card-rich ${snapshot.isDragging ? 'kanban-card-dragging' : ''} ${subtask.isOverdue ? 'kanban-card-overdue' : ''} ${!movable ? 'kanban-card-locked' : ''}`}
                                                    >
                                                        <div className="kanban-card-top">
                                                            <span className="kanban-drag-handle" style={{ cursor: movable ? 'grab' : 'not-allowed' }}>
                                                                {movable ? <GripVertical size={14} /> : <Lock size={14} />}
                                                            </span>
                                                            <span className="kanban-card-title">{subtask.title}</span>
                                                        </div>
                                                        <div className="kanban-card-details">
                                                            {subtask.priority && (
                                                                <span className={`kanban-card-priority ${subtask.priority.toLowerCase()}`}>
                                                                    <Flag size={11} /> {subtask.priority.charAt(0) + subtask.priority.slice(1).toLowerCase()}
                                                                </span>
                                                            )}
                                                            {subtask.deadline && (
                                                                <span className="kanban-card-deadline">
                                                                    <Calendar size={11} /> {new Date(subtask.deadline).toLocaleDateString('vi-VN')}
                                                                </span>
                                                            )}
                                                            {subtask.assignedTo && (
                                                                <span className="kanban-card-assignee">
                                                                    <div className="avatar-xs">{subtask.assignedTo.charAt(0).toUpperCase()}</div>
                                                                    {subtask.assignedTo.split('@')[0]}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {!movable && (
                                                            <span className="kanban-card-lock-note">
                                                                <Lock size={11} /> {isParentAssignee ? 'Subtask của thành viên khác, chỉ xem' : 'Chỉ xem, không được kéo'}
                                                            </span>
                                                        )}
                                                        {getOverdueBadge(subtask)}
                                                    </div>
                                                )}
                                            </Draggable>
                                            );
                                        })}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}
                </div>
            </DragDropContext>
            {subtasks.length === 0 && (
                <div className="glass-panel user-empty-panel">
                    <ListTodo size={24} />
                    <span>{isParentAssignee ? 'Task cha này chưa có subtask.' : 'Bạn chưa được giao subtask nào trong task cha này.'}</span>
                </div>
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

export default SubtaskBoard;
