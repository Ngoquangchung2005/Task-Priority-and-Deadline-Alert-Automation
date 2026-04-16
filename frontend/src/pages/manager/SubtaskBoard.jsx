import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../../services/api';
import LoadingCompass from '../../components/LoadingCompass';
import { ArrowLeft, Plus, Trash2, Edit3, GripVertical, CheckCircle, AlertTriangle, Clock, ListTodo, Flag, User, Calendar, X, Save } from 'lucide-react';

const COLUMNS = [
    { id: 'TODO', title: 'To Do', icon: <ListTodo size={16} />, color: '#64748B' },
    { id: 'IN_PROGRESS', title: 'In Progress', icon: <Clock size={16} />, color: '#3B82F6' },
    { id: 'DONE', title: 'Done', icon: <CheckCircle size={16} />, color: '#10B981' },
];

const ManagerSubtaskBoard = () => {
    const { taskId } = useParams();
    const navigate = useNavigate();
    const [task, setTask] = useState(null);
    const [subtasks, setSubtasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingSubtask, setEditingSubtask] = useState(null);
    const [formData, setFormData] = useState({ title: '', priority: '', deadline: '', assignedTo: '' });

    const fetchData = async () => {
        try {
            const [taskRes, subtaskRes] = await Promise.all([
                api.get(`/tasks/${taskId}`),
                api.get(`/tasks/${taskId}/subtasks`)
            ]);
            setTask(taskRes.data);
            setSubtasks(subtaskRes.data);
        } catch (err) {
            console.error('Failed to load board data', err);
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

        setSubtasks(prev => prev.map(s => s.id === subtaskId ? { ...s, status: newStatus, positionIndex: destination.index } : s));

        try {
            await api.patch(`/subtasks/${subtaskId}/status`, { status: newStatus });
            await api.patch(`/subtasks/${subtaskId}/position`, { position: destination.index });
            fetchData();
        } catch {
            showToast('Lỗi cập nhật trạng thái', 'error');
            fetchData();
        }
    };

    const resetForm = () => {
        setFormData({ title: '', priority: '', deadline: '', assignedTo: '' });
        setShowAddForm(false);
        setEditingSubtask(null);
    };

    const handleAddSubtask = async () => {
        if (!formData.title.trim()) return;
        try {
            const payload = {
                title: formData.title.trim(),
                priority: formData.priority || null,
                deadline: formData.deadline || null,
                assignedTo: formData.assignedTo || null
            };
            await api.post(`/tasks/${taskId}/subtasks`, payload);
            showToast('Đã thêm subtask!');
            resetForm();
            fetchData();
        } catch {
            showToast('Lỗi thêm subtask', 'error');
        }
    };

    const handleEditSubtask = async () => {
        if (!formData.title.trim() || !editingSubtask) return;
        try {
            const payload = {
                title: formData.title.trim(),
                priority: formData.priority || null,
                deadline: formData.deadline || null,
                assignedTo: formData.assignedTo || null
            };
            await api.put(`/subtasks/${editingSubtask.id}`, payload);
            showToast('Đã cập nhật subtask!');
            resetForm();
            fetchData();
        } catch {
            showToast('Lỗi cập nhật subtask', 'error');
        }
    };

    const startEdit = (subtask) => {
        setEditingSubtask(subtask);
        setFormData({
            title: subtask.title,
            priority: subtask.priority || '',
            deadline: subtask.deadline ? subtask.deadline.slice(0, 16) : '',
            assignedTo: subtask.assignedTo || ''
        });
        setShowAddForm(true);
    };

    const handleDeleteSubtask = async (id) => {
        if (!window.confirm('Xoá subtask này?')) return;
        try {
            await api.delete(`/subtasks/${id}`);
            showToast('Đã xoá subtask');
            fetchData();
        } catch {
            showToast('Lỗi xoá subtask', 'error');
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
                    <button className="btn-glass btn-sm" onClick={() => navigate('/manager/tasks')}>
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
                <div className="kanban-header-right">
                    <div className="kanban-progress-area">
                        <span className="kanban-progress-text">{doneCount}/{subtasks.length} completed</span>
                        <div className="kanban-progress-bar">
                            <div className="kanban-progress-fill" style={{ width: `${progress}%` }}></div>
                        </div>
                        <span className="kanban-progress-pct">{progress}%</span>
                    </div>
                    <button className="btn-primary btn-sm" onClick={() => { resetForm(); setShowAddForm(true); }}>
                        <Plus size={16} /> Thêm subtask
                    </button>
                </div>
            </div>

            {/* Add/Edit Form */}
            {showAddForm && (
                <div className="kanban-form-panel glass-panel fade-in">
                    <div className="kanban-form-header">
                        <h3>{editingSubtask ? '✏️ Sửa Subtask' : '➕ Thêm Subtask mới'}</h3>
                        <button className="btn-ghost btn-sm" onClick={resetForm}><X size={16} /></button>
                    </div>
                    <div className="kanban-form-body">
                        <div className="kanban-form-row">
                            <div className="form-group" style={{ flex: 2 }}>
                                <label>Tên subtask <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <input className="input-field" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Nhập tên subtask" />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Priority</label>
                                <select className="input-field" value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}>
                                    <option value="">— Chọn —</option>
                                    <option value="HIGH">🔴 High</option>
                                    <option value="MEDIUM">🟡 Medium</option>
                                    <option value="LOW">🟢 Low</option>
                                </select>
                            </div>
                        </div>
                        <div className="kanban-form-row">
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Deadline</label>
                                <input type="datetime-local" className="input-field" value={formData.deadline} onChange={e => setFormData({ ...formData, deadline: e.target.value })} />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Assignee (email)</label>
                                <input type="email" className="input-field" value={formData.assignedTo} onChange={e => setFormData({ ...formData, assignedTo: e.target.value })} placeholder="user@example.com" />
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button className="btn-glass btn-sm" onClick={resetForm}>Huỷ</button>
                            <button className="btn-primary btn-sm" onClick={editingSubtask ? handleEditSubtask : handleAddSubtask}>
                                <Save size={14} /> {editingSubtask ? 'Lưu' : 'Thêm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                                            <div className="kanban-card-actions">
                                                                <button className="kanban-card-action-btn" onClick={() => startEdit(subtask)} title="Sửa">
                                                                    <Edit3 size={13} />
                                                                </button>
                                                                <button className="kanban-card-action-btn danger" onClick={() => handleDeleteSubtask(subtask.id)} title="Xoá">
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
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

export default ManagerSubtaskBoard;
