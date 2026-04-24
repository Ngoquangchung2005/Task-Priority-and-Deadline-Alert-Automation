import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, X } from 'lucide-react';

const CreateTaskModal = ({ isOpen, onClose, onTaskCreated, editTask }) => {
    const [formData, setFormData] = useState({
        taskName: '',
        taskDescription: '',
        assigneeEmail: '',
        priority: 'MEDIUM',
        adminNote: ''
    });
    const [subtaskTitles, setSubtaskTitles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [errors, setErrors] = useState({});

    const deadlineMap = { HIGH: '7 ngày', MEDIUM: '14 ngày', LOW: '30 ngày' };

    useEffect(() => {
        if (editTask) {
            setFormData({
                taskName: editTask.taskName || '',
                taskDescription: editTask.taskDescription || '',
                assigneeEmail: editTask.assigneeEmail || '',
                priority: editTask.priority || 'MEDIUM',
                adminNote: editTask.adminNote || ''
            });
            setSubtaskTitles([]);
        } else {
            setFormData({ taskName: '', taskDescription: '', assigneeEmail: '', priority: 'MEDIUM', adminNote: '' });
            setSubtaskTitles([]);
        }
        setError('');
        setErrors({});
    }, [editTask, isOpen]);

    if (!isOpen) return null;

    const validate = () => {
        const errs = {};
        if (!formData.taskName.trim()) errs.taskName = 'Task name is required';
        if (!formData.assigneeEmail.trim()) errs.assigneeEmail = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(formData.assigneeEmail)) errs.assigneeEmail = 'Invalid email format';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setError('');
        setLoading(true);
        try {
            const payload = {
                ...formData,
                subtaskTitles: subtaskTitles.filter(t => t.trim() !== '')
            };
            if (editTask) {
                await api.put(`/tasks/${editTask.id}`, payload);
            } else {
                await api.post('/tasks', payload);
            }
            onTaskCreated();
            setFormData({ taskName: '', taskDescription: '', assigneeEmail: '', priority: 'MEDIUM', adminNote: '' });
            setSubtaskTitles([]);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || (editTask ? 'Error updating task' : 'Error creating task'));
        } finally {
            setLoading(false);
        }
    };

    const addSubtask = () => setSubtaskTitles([...subtaskTitles, '']);
    const removeSubtask = (index) => setSubtaskTitles(subtaskTitles.filter((_, i) => i !== index));
    const updateSubtask = (index, value) => {
        const updated = [...subtaskTitles];
        updated[index] = value;
        setSubtaskTitles(updated);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px', padding: '2rem', animation: 'slideUp 0.3s ease', borderRadius: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
                <h3 style={{ margin: '0 0 1.5rem 0', textAlign: 'left', fontSize: '1.2rem' }}>
                    {editTask ? '✏️ Edit Task' : '➕ Create New Task'}
                </h3>
                {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', textAlign: 'left', fontSize: '0.9rem', background: 'var(--danger-bg)', padding: '0.6rem 1rem', borderRadius: '8px' }}>{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Task Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input className={`input-field ${errors.taskName ? 'input-error' : ''}`} required value={formData.taskName} onChange={e => setFormData({...formData, taskName: e.target.value})} placeholder="Enter task name" />
                        {errors.taskName && <span className="field-error">{errors.taskName}</span>}
                    </div>
                    <div className="form-group">
                        <label>Description</label>
                        <textarea className="input-field" rows="2" value={formData.taskDescription} onChange={e => setFormData({...formData, taskDescription: e.target.value})} placeholder="Optional description"></textarea>
                    </div>
                    <div className="form-group">
                        <label>Assignee Email <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input type="email" className={`input-field ${errors.assigneeEmail ? 'input-error' : ''}`} required value={formData.assigneeEmail} onChange={e => setFormData({...formData, assigneeEmail: e.target.value})} placeholder="user@example.com" />
                        {errors.assigneeEmail && <span className="field-error">{errors.assigneeEmail}</span>}
                    </div>
                    <div className="form-group">
                        <label>Priority</label>
                        <select className="input-field" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                            <option value="HIGH">🔴 High</option>
                            <option value="MEDIUM">🟡 Medium</option>
                            <option value="LOW">🟢 Low</option>
                        </select>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                            ⏱ Deadline tự động: {deadlineMap[formData.priority]} kể từ hôm nay
                        </span>
                    </div>
                    <div className="form-group">
                        <label>Admin Note</label>
                        <textarea className="input-field" rows="2" value={formData.adminNote} onChange={e => setFormData({...formData, adminNote: e.target.value})} placeholder="Internal note for this task (optional)"></textarea>
                    </div>

                    {/* Subtask Section */}
                    {!editTask && (
                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Subtasks</span>
                                <button type="button" className="btn-ghost btn-sm" onClick={addSubtask} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Plus size={14} /> Add
                                </button>
                            </label>
                            {subtaskTitles.length > 0 && (
                                <div className="subtask-input-list">
                                    {subtaskTitles.map((title, index) => (
                                        <div key={index} className="subtask-input-row">
                                            <span className="subtask-index">{index + 1}</span>
                                            <input
                                                className="input-field"
                                                value={title}
                                                onChange={e => updateSubtask(index, e.target.value)}
                                                placeholder={`Subtask ${index + 1}`}
                                                style={{ flex: 1 }}
                                            />
                                            <button type="button" className="subtask-remove-btn" onClick={() => removeSubtask(index)}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {subtaskTitles.length === 0 && (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.3rem 0 0 0' }}>Click "Add" to add subtasks for this task.</p>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                        <button type="button" className="btn-glass" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? (editTask ? 'Saving...' : 'Creating...') : (editTask ? 'Save Changes' : 'Create Task')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateTaskModal;