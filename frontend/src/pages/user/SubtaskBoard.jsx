import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../../services/api';
import LoadingCompass from '../../components/LoadingCompass';
import { ArrowLeft, GripVertical, CheckCircle, AlertTriangle, Clock, ListTodo, Flag, User, Calendar } from 'lucide-react';

const COLUMNS = [
    { id: 'TODO', title: 'To Do', icon: <ListTodo size={16} />, color: '#64748B' },
    { id: 'IN_PROGRESS', title: 'In Progress', icon: <Clock size={16} />, color: '#3B82F6' },
    { id: 'DONE', title: 'Done', icon: <CheckCircle size={16} />, color: '#10B981' },
];

const SubtaskBoard = () => {
    const { taskId } = useParams();
    const navigate = useNavigate();
    const [task, setTask] = useState(null);
    const [subtasks, setSubtasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);

    const fetchData = async () => {
        try {
            const [taskRes, subtaskRes] = await Promise.all([
                api.get(`/tasks/my-tasks/${taskId}`),
                api.get(`/tasks/my-tasks/${taskId}/subtasks`)
            ]);
            setTask(taskRes.data);
            setSubtasks(subtaskRes.data);
        } catch (err) {
            console.error('Failed to load board data', err?.response?.status, err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [taskId]);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const getColumnSubtasks = (columnId) => subtasks.filter(s => s.status === columnId);

    const handleDragEnd = async (result) => {
        const { destination, source, draggableId } = result;
        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const subtaskId = parseInt(draggableId);
        const newStatus = destination.droppableId;

        // Optimistic update
        setSubtasks(prev => prev.map(s => s.id === subtaskId ? { ...s, status: newStatus, positionIndex: destination.index } : s));

        try {
            await api.patch(`/tasks/my-tasks/subtasks/${subtaskId}/status`, { status: newStatus });
            await api.patch(`/tasks/my-tasks/subtasks/${subtaskId}/position`, { position: destination.index });
            fetchData();
        } catch {
            showToast('Lỗi cập nhật trạng thái', 'error');
            fetchData();
        }
    };

    const doneCount = subtasks.filter(s => s.status === 'DONE').length;
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
    if (!task) return <div className="page-loading">Task not found.</div>;

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
                    <span className="kanban-progress-text">{doneCount}/{subtasks.length} completed</span>
                    <div className="kanban-progress-bar">
                        <div className="kanban-progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                    <span className="kanban-progress-pct">{progress}%</span>
                </div>
            </div>

            {/* Kanban Board */}
            <DragDropContext onDragEnd={handleDragEnd}>
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
                                        {getColumnSubtasks(col.id).map((subtask, index) => (
                                            <Draggable
                                                key={subtask.id}
                                                draggableId={String(subtask.id)}
                                                index={index}
                                            >
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        className={`kanban-card kanban-card-rich ${snapshot.isDragging ? 'kanban-card-dragging' : ''} ${subtask.isOverdue ? 'kanban-card-overdue' : ''}`}
                                                    >
                                                        <div className="kanban-card-top">
                                                            <span className="kanban-drag-handle" style={{ cursor: 'grab' }}>
                                                                <GripVertical size={14} />
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
                                                        {getOverdueBadge(subtask)}
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}
                </div>
            </DragDropContext>

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
