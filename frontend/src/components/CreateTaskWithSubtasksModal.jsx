import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { Copy, Plus, Sparkles, Users, X } from 'lucide-react';

const emailPattern = /\S+@\S+\.\S+/;
const PRIORITY_OPTIONS = ['HIGH', 'MEDIUM', 'LOW'];
const priorityRank = { LOW: 1, MEDIUM: 2, HIGH: 3 };
const n8nSubtaskWebhookUrl =
    import.meta.env.VITE_N8N_SUBTASK_WEBHOOK_URL ||
    (import.meta.env.PROD
        ? 'https://n8nserver.email/webhook/ai-generate-subtask'
        : '/n8n/webhook/ai-generate-subtask');

const initialFormData = {
    taskName: '',
    taskDescription: '',
    assigneeEmail: '',
    priority: 'MEDIUM',
    deadline: '',
    adminNote: '',
    sourceInput: ''
};

const createEmptySubtask = (defaults = {}) => ({
    title: '',
    assignedTo: defaults.assignedTo || '',
    deadline: defaults.deadline || '',
    priority: defaults.priority || 'MEDIUM',
    status: 'TODO'
});

const normalizeEmail = (value) => (value || '').trim().toLowerCase();
const isDeadlineAfter = (childDeadline, parentDeadline) => {
    if (!childDeadline || !parentDeadline) return false;
    const childDate = new Date(childDeadline);
    const parentDate = new Date(parentDeadline);
    if (Number.isNaN(childDate.getTime()) || Number.isNaN(parentDate.getTime())) return false;
    return childDate > parentDate;
};
const isPriorityAllowed = (priority, parentPriority) => (
    !priority || !parentPriority || priorityRank[priority] >= priorityRank[parentPriority]
);
const clampPriorityToParent = (priority, parentPriority) => (
    isPriorityAllowed(priority, parentPriority) ? priority : parentPriority
);
const getAllowedPriorityOptions = (parentPriority) => (
    PRIORITY_OPTIONS.filter((priority) => isPriorityAllowed(priority, parentPriority))
);

const CreateTaskWithSubtasksModal = ({ isOpen, onClose, onTaskCreated, editTask, knownUserEmails = [] }) => {
    const [formData, setFormData] = useState(initialFormData);
    const [subtasks, setSubtasks] = useState([]);
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [generatingAI, setGeneratingAI] = useState(false);
    const [error, setError] = useState('');
    const [errors, setErrors] = useState({});
    const [editStartedLoading, setEditStartedLoading] = useState(false);
    const [editHasStartedWork, setEditHasStartedWork] = useState(false);

    const deadlineMap = { HIGH: '7 ngày', MEDIUM: '14 ngày', LOW: '30 ngày' };
    const isEditing = Boolean(editTask);
    const isInProgressEdit = editTask?.status === 'IN_PROGRESS' && editHasStartedWork;
    const isCheckingEditStartState = editTask?.status === 'IN_PROGRESS' && editStartedLoading;
    const isReadOnlyEdit = editTask?.status === 'DONE' || editTask?.status === 'CANCELLED' || editTask?.archived;

    const toDatetimeLocalValue = (value) => {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';

        const pad = (input) => String(input).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    useEffect(() => {
        if (editTask) {
            setFormData({
                taskName: editTask.taskName || '',
                taskDescription: editTask.taskDescription || '',
                assigneeEmail: editTask.assigneeEmail || '',
                priority: editTask.priority || 'MEDIUM',
                deadline: toDatetimeLocalValue(editTask.deadline),
                adminNote: editTask.adminNote || '',
                sourceInput: editTask.sourceInput || ''
            });
            setSubtasks([]);
            setEditHasStartedWork(editTask.status === 'IN_PROGRESS' && !(Number(editTask.totalSubTask) > 0));
        } else {
            setFormData(initialFormData);
            setSubtasks([]);
            setEditHasStartedWork(false);
        }
        setEditStartedLoading(false);
        setError('');
        setErrors({});
    }, [editTask, isOpen]);

    useEffect(() => {
        if (!isOpen || !editTask || editTask.status !== 'IN_PROGRESS' || !(Number(editTask.totalSubTask) > 0)) {
            return;
        }

        let cancelled = false;
        const checkStartedSubtasks = async () => {
            setEditStartedLoading(true);
            try {
                const res = await api.get(`/subtasks/task/${editTask.id}`);
                const rows = Array.isArray(res.data) ? res.data : [];
                const hasStarted = rows.some((subtask) => {
                    const status = String(subtask.status || '').toUpperCase();
                    return status !== 'TODO' && status !== 'PENDING';
                });
                if (!cancelled) {
                    setEditHasStartedWork(hasStarted);
                }
            } catch {
                if (!cancelled) {
                    setEditHasStartedWork(true);
                }
            } finally {
                if (!cancelled) {
                    setEditStartedLoading(false);
                }
            }
        };

        checkStartedSubtasks();
        return () => {
            cancelled = true;
        };
    }, [editTask, isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        let cancelled = false;
        const fetchUsers = async () => {
            setUsersLoading(true);
            try {
                const res = await api.get('/users');
                if (!cancelled) {
                    setUsers(Array.isArray(res.data) ? res.data : []);
                }
            } catch {
                if (!cancelled) setUsers([]);
            } finally {
                if (!cancelled) setUsersLoading(false);
            }
        };

        fetchUsers();
        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    const userOptions = useMemo(() => {
        const map = new Map();
        const addEmail = (email, label) => {
            const normalized = normalizeEmail(email);
            if (!normalized) return;
            map.set(normalized.toLowerCase(), {
                email: normalized,
                label: label || normalized
            });
        };

        users
            .filter((user) => user?.email && user.isActive !== false)
            .forEach((user) => {
                addEmail(
                    user.email,
                    user.fullName ? `${user.fullName} <${user.email}>` : user.email
                );
            });

        knownUserEmails.forEach((email) => addEmail(email));
        addEmail(formData.assigneeEmail);
        subtasks.forEach((subtask) => addEmail(subtask.assignedTo));

        return [...map.values()].sort((a, b) => a.email.localeCompare(b.email));
    }, [formData.assigneeEmail, knownUserEmails, subtasks, users]);

    const subtaskAssigneeSummary = useMemo(() => {
        const counts = new Map();
        subtasks.forEach((subtask) => {
            const email = normalizeEmail(subtask.assignedTo);
            if (!email) return;
            counts.set(email, (counts.get(email) || 0) + 1);
        });
        return [...counts.entries()]
            .map(([email, count]) => ({ email, count }))
            .sort((a, b) => a.email.localeCompare(b.email));
    }, [subtasks]);

    if (!isOpen) return null;

    const updateFormData = (field, value) => {
        setFormData((current) => ({ ...current, [field]: value }));
    };

    const handlePriorityChange = (value) => {
        updateFormData('priority', value);
        if (!editTask) {
            setSubtasks((current) =>
                current.map((subtask) => ({
                    ...subtask,
                    priority: clampPriorityToParent(subtask.priority, value) || value
                }))
            );
        }
    };

    const handleParentAssigneeChange = (value) => {
        updateFormData('assigneeEmail', value);
        if (!editTask) {
            setSubtasks((current) =>
                current.map((subtask) =>
                    subtask.assignedTo ? subtask : { ...subtask, assignedTo: value }
                )
            );
        }
    };

    const validate = () => {
        const nextErrors = {};
        if (!formData.taskName.trim()) nextErrors.taskName = 'Task name is required';
        if (!formData.assigneeEmail.trim()) nextErrors.assigneeEmail = 'Email is required';
        else if (!emailPattern.test(formData.assigneeEmail)) nextErrors.assigneeEmail = 'Invalid email format';

        if (!editTask && subtasks.length > 0) {
            const subtaskRows = {};
            subtasks.forEach((subtask, index) => {
                const rowErrors = {};
                if (!subtask.title.trim()) rowErrors.title = 'Title is required';
                if (!subtask.assignedTo.trim()) rowErrors.assignedTo = 'Assignee is required';
                else if (!emailPattern.test(subtask.assignedTo)) rowErrors.assignedTo = 'Invalid email';
                if (!isPriorityAllowed(subtask.priority || formData.priority, formData.priority)) {
                    rowErrors.priority = 'Subtask priority cannot be lower than parent priority';
                }
                if (isDeadlineAfter(subtask.deadline, formData.deadline)) {
                    rowErrors.deadline = 'Subtask deadline cannot be after parent deadline';
                }
                if (Object.keys(rowErrors).length > 0) {
                    subtaskRows[index] = rowErrors;
                }
            });
            if (Object.keys(subtaskRows).length > 0) {
                nextErrors.subtaskRows = subtaskRows;
            }
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setError('');
        setLoading(true);

        try {
            const payload = {
                taskName: formData.taskName.trim(),
                taskDescription: formData.taskDescription.trim(),
                assigneeEmail: normalizeEmail(formData.assigneeEmail),
                priority: formData.priority,
                deadline: formData.deadline || null,
                adminNote: formData.adminNote.trim(),
                sourceInput: formData.sourceInput.trim()
            };

            if (!editTask) {
                payload.subtasks = subtasks.map((subtask, index) => ({
                    title: subtask.title.trim(),
                    assignedTo: normalizeEmail(subtask.assignedTo),
                    deadline: subtask.deadline || null,
                    priority: clampPriorityToParent(subtask.priority || formData.priority, formData.priority),
                    status: 'TODO',
                    positionIndex: index
                }));
            }

            if (editTask) {
                await api.put(`/tasks/${editTask.id}`, payload);
            } else {
                await api.post('/tasks', payload);
            }

            onTaskCreated?.(editTask ? 'updated' : 'created');
            setFormData(initialFormData);
            setSubtasks([]);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || (editTask ? 'Error updating task' : 'Error creating task'));
        } finally {
            setLoading(false);
        }
    };

    const addSubtask = () => {
        setSubtasks((current) => [
            ...current,
            createEmptySubtask({
                assignedTo: formData.assigneeEmail,
                deadline: formData.deadline,
                priority: formData.priority
            })
        ]);
    };

    const removeSubtask = (index) => {
        setSubtasks((current) => current.filter((_, currentIndex) => currentIndex !== index));
    };

    const updateSubtask = (index, field, value) => {
        setSubtasks((current) =>
            current.map((subtask, currentIndex) =>
                currentIndex === index ? { ...subtask, [field]: value } : subtask
            )
        );
    };

    const assignAllSubtasksToParent = () => {
        setSubtasks((current) =>
            current.map((subtask) => ({ ...subtask, assignedTo: formData.assigneeEmail }))
        );
    };

    const copyParentDeadlineToSubtasks = () => {
        setSubtasks((current) =>
            current.map((subtask) => ({ ...subtask, deadline: formData.deadline }))
        );
    };

    const handleGenerateSubtasksAI = async () => {
        if (!formData.taskName.trim()) {
            setErrors((current) => ({ ...current, taskName: 'Task name is required to generate AI subtasks' }));
            return;
        }
        setError('');
        setGeneratingAI(true);
        try {
            const payload = {
                taskName: formData.taskName,
                taskDescription: formData.taskDescription,
                priority: formData.priority,
                assigneeEmail: formData.assigneeEmail,
                adminNote: formData.adminNote,
                sourceInput: formData.sourceInput,
                deadline: formData.deadline || null,
                desiredCount: 3
            };

            const res = await fetch(n8nSubtaskWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const rawResponse = await res.text();

            if (!res.ok) {
                let errorMessage = rawResponse.trim() || `Webhook error: ${res.status}`;
                try {
                    const parsedError = JSON.parse(rawResponse);
                    errorMessage = parsedError.message || parsedError.error || errorMessage;
                } catch {
                    // Keep the raw webhook response when it is not JSON.
                }
                throw new Error(errorMessage);
            }

            if (!rawResponse.trim()) {
                throw new Error('Webhook returned empty response');
            }

            let responseData;
            try {
                responseData = JSON.parse(rawResponse);
            } catch {
                throw new Error('Webhook returned invalid JSON');
            }

            const parseMaybeJson = (value) => {
                if (typeof value !== 'string') return value;
                try {
                    return JSON.parse(value);
                } catch {
                    return value;
                }
            };

            const normalized = parseMaybeJson(responseData?.output ?? responseData);
            if (normalized?.ok === false) {
                throw new Error(normalized.error || 'AI request failed');
            }

            const rows = Array.isArray(normalized)
                ? normalized
                : (Array.isArray(normalized?.subtasks) ? normalized.subtasks : []);

            const uniqueSubtasks = [];
            const generatedTitles = new Set();
            rows.forEach((item) => {
                const row = typeof item === 'object' && item !== null ? item : {};
                const title = String(typeof item === 'string' ? item : row.title || '').trim();
                const key = title.toLowerCase();
                if (!title || generatedTitles.has(key)) return;

                generatedTitles.add(key);
                uniqueSubtasks.push({
                    title,
                    assignedTo: normalizeEmail(row.assignedTo || row.assigneeEmail || formData.assigneeEmail),
                    deadline: row.deadline || formData.deadline,
                    priority: clampPriorityToParent(row.priority || formData.priority, formData.priority)
                });
            });

            const existingTitles = new Set(
                subtasks
                    .map((subtask) => subtask.title.trim().toLowerCase())
                    .filter(Boolean)
            );
            const nextSubtasks = uniqueSubtasks
                .filter((subtask) => !existingTitles.has(subtask.title.toLowerCase()))
                .map((subtask) => ({
                    ...createEmptySubtask({
                        assignedTo: subtask.assignedTo || formData.assigneeEmail,
                        deadline: subtask.deadline || formData.deadline,
                        priority: subtask.priority || formData.priority
                    }),
                    title: subtask.title
                }));

            setSubtasks((current) => [...current, ...nextSubtasks]);
            if (!uniqueSubtasks.length) {
                setError('AI không tạo được subtask, thử mô tả task chi tiết hơn.');
            } else if (nextSubtasks.length === 0) {
                setError('Các subtask AI gợi ý đã có trong danh sách.');
            }
        } catch (err) {
            setError(err.response?.data?.message || err?.message || 'Error generating AI subtasks');
        } finally {
            setGeneratingAI(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content glass-panel task-modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 className="task-modal-title">
                    {editTask ? 'Edit Task' : 'Create New Task'}
                </h3>
                {error && <div className="form-error-banner">{error}</div>}
                {isCheckingEditStartState && (
                    <div className="form-info-banner">
                        Đang kiểm tra trạng thái subtask để xác định quyền chỉnh sửa.
                    </div>
                )}
                {isInProgressEdit && (
                    <div className="form-info-banner">
                        Task đã có người bắt đầu xử lý. Bạn chỉ có thể cập nhật deadline, độ ưu tiên và ghi chú quản lý.
                    </div>
                )}
                {isReadOnlyEdit && (
                    <div className="form-muted-banner">
                        Task {editTask?.archived ? 'đã được archive' : `ở trạng thái ${editTask.status}`}. Hệ thống chỉ cho phép xem lại, không chỉnh sửa thêm.
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <datalist id="task-user-options">
                        {userOptions.map((user) => (
                            <option key={user.email} value={user.email}>
                                {user.label}
                            </option>
                        ))}
                    </datalist>

                    <div className="task-form-grid">
                        <div className="form-group task-form-span-2">
                            <label>Task Name <span className="required-mark">*</span></label>
                            <input
                                className={`input-field ${errors.taskName ? 'input-error' : ''}`}
                                required
                                disabled={isCheckingEditStartState || isInProgressEdit || isReadOnlyEdit}
                                value={formData.taskName}
                                onChange={(e) => updateFormData('taskName', e.target.value)}
                                placeholder="Enter task name"
                            />
                            {errors.taskName && <span className="field-error">{errors.taskName}</span>}
                        </div>

                        <div className="form-group task-form-span-2">
                            <label>Description</label>
                            <textarea
                                className="input-field"
                                rows="2"
                                disabled={isCheckingEditStartState || isInProgressEdit || isReadOnlyEdit}
                                value={formData.taskDescription}
                                onChange={(e) => updateFormData('taskDescription', e.target.value)}
                                placeholder="Optional description"
                            />
                        </div>

                        <div className="form-group">
                            <label>Main Assignee <span className="required-mark">*</span></label>
                            <input
                                type="email"
                                list="task-user-options"
                                className={`input-field ${errors.assigneeEmail ? 'input-error' : ''}`}
                                required
                                disabled={isCheckingEditStartState || isInProgressEdit || isReadOnlyEdit}
                                value={formData.assigneeEmail}
                                onChange={(e) => handleParentAssigneeChange(e.target.value)}
                                placeholder={usersLoading ? 'Loading users...' : 'leader@example.com'}
                            />
                            {errors.assigneeEmail && <span className="field-error">{errors.assigneeEmail}</span>}
                        </div>

                        <div className="form-group">
                            <label>Priority</label>
                            <select
                                className="input-field"
                                disabled={isReadOnlyEdit}
                                value={formData.priority}
                                onChange={(e) => handlePriorityChange(e.target.value)}
                            >
                                {PRIORITY_OPTIONS.map((priority) => (
                                    <option key={priority} value={priority}>
                                        {priority.charAt(0) + priority.slice(1).toLowerCase()}
                                    </option>
                                ))}
                            </select>
                            <span className="form-help-text">Deadline tự động: {deadlineMap[formData.priority]}</span>
                        </div>

                        <div className="form-group">
                            <label>Deadline</label>
                            <input
                                type="datetime-local"
                                className="input-field"
                                disabled={isReadOnlyEdit}
                                value={formData.deadline}
                                onChange={(e) => updateFormData('deadline', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label>Source Input</label>
                            <input
                                className="input-field"
                                disabled={isCheckingEditStartState || isInProgressEdit || isReadOnlyEdit}
                                value={formData.sourceInput}
                                onChange={(e) => updateFormData('sourceInput', e.target.value)}
                                placeholder="Optional source"
                            />
                        </div>

                        <div className="form-group task-form-span-2">
                            <label>Admin Note</label>
                            <textarea
                                className="input-field"
                                rows="2"
                                disabled={isReadOnlyEdit}
                                value={formData.adminNote}
                                onChange={(e) => updateFormData('adminNote', e.target.value)}
                                placeholder="Internal note for this task"
                            />
                        </div>
                    </div>

                    {!editTask && (
                        <div className="subtask-builder">
                            <div className="subtask-builder-header">
                                <div className="subtask-builder-title">
                                    <span>Subtasks</span>
                                    <span className="subtask-count-badge">{subtasks.length}</span>
                                </div>
                                <div className="subtask-builder-actions">
                                    {subtasks.length > 0 && (
                                        <>
                                            <button
                                                type="button"
                                                className="btn-ghost btn-sm"
                                                onClick={assignAllSubtasksToParent}
                                                disabled={!formData.assigneeEmail.trim()}
                                                title="Assign all subtasks to the main assignee"
                                            >
                                                <Users size={14} /> Assign all
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-ghost btn-sm"
                                                onClick={copyParentDeadlineToSubtasks}
                                                disabled={!formData.deadline}
                                                title="Copy parent deadline to all subtasks"
                                            >
                                                <Copy size={14} /> Copy deadline
                                            </button>
                                        </>
                                    )}
                                    <button
                                        type="button"
                                        className="btn-ghost btn-sm"
                                        onClick={handleGenerateSubtasksAI}
                                        disabled={generatingAI}
                                    >
                                        <Sparkles size={14} /> {generatingAI ? 'Generating...' : 'Generate AI'}
                                    </button>
                                    <button type="button" className="btn-ghost btn-sm" onClick={addSubtask}>
                                        <Plus size={14} /> Add
                                    </button>
                                </div>
                            </div>

                            {subtaskAssigneeSummary.length > 0 && (
                                <div className="subtask-assignee-summary">
                                    <Users size={14} />
                                    <span>{subtaskAssigneeSummary.length} assignee{subtaskAssigneeSummary.length > 1 ? 's' : ''}</span>
                                    {subtaskAssigneeSummary.map(({ email, count }) => (
                                        <span key={email} className="subtask-assignee-chip">
                                            {email.split('@')[0]}: {count}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {subtasks.length > 0 ? (
                                <div className="subtask-input-list">
                                    {subtasks.map((subtask, index) => {
                                        const rowErrors = errors.subtaskRows?.[index] || {};
                                        return (
                                            <div key={index} className="subtask-input-row subtask-input-row-rich">
                                                <span className="subtask-index">{index + 1}</span>
                                                <div className="subtask-row-grid">
                                                    <div className="subtask-field subtask-field-title">
                                                        <label>Title <span className="required-mark">*</span></label>
                                                        <input
                                                            className={`input-field ${rowErrors.title ? 'input-error' : ''}`}
                                                            value={subtask.title}
                                                            onChange={(e) => updateSubtask(index, 'title', e.target.value)}
                                                            placeholder={`Subtask ${index + 1}`}
                                                        />
                                                        {rowErrors.title && <span className="field-error">{rowErrors.title}</span>}
                                                    </div>

                                                    <div className="subtask-field">
                                                        <label>Assigned To <span className="required-mark">*</span></label>
                                                        <input
                                                            type="email"
                                                            list="task-user-options"
                                                            className={`input-field ${rowErrors.assignedTo ? 'input-error' : ''}`}
                                                            value={subtask.assignedTo}
                                                            onChange={(e) => updateSubtask(index, 'assignedTo', e.target.value)}
                                                            placeholder="user@example.com"
                                                        />
                                                        {rowErrors.assignedTo && <span className="field-error">{rowErrors.assignedTo}</span>}
                                                    </div>

                                                    <div className="subtask-field">
                                                        <label>Deadline</label>
                                                        <input
                                                            type="datetime-local"
                                                            className={`input-field ${rowErrors.deadline ? 'input-error' : ''}`}
                                                            value={subtask.deadline}
                                                            onChange={(e) => updateSubtask(index, 'deadline', e.target.value)}
                                                        />
                                                        {rowErrors.deadline && <span className="field-error">{rowErrors.deadline}</span>}
                                                    </div>

                                                    <div className="subtask-field subtask-field-priority">
                                                        <label>Priority</label>
                                                        <select
                                                            className={`input-field ${rowErrors.priority ? 'input-error' : ''}`}
                                                            value={subtask.priority}
                                                            onChange={(e) => updateSubtask(index, 'priority', e.target.value)}
                                                        >
                                                            {getAllowedPriorityOptions(formData.priority).map((priority) => (
                                                                <option key={priority} value={priority}>
                                                                    {priority.charAt(0) + priority.slice(1).toLowerCase()}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        {rowErrors.priority && <span className="field-error">{rowErrors.priority}</span>}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="subtask-remove-btn"
                                                    onClick={() => removeSubtask(index)}
                                                    aria-label={`Remove subtask ${index + 1}`}
                                                    title="Remove"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="subtask-empty-text">No subtasks added.</p>
                            )}
                        </div>
                    )}

                    <div className="task-modal-actions">
                        <button type="button" className="btn-glass" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={loading || isCheckingEditStartState || isReadOnlyEdit}>
                            {loading ? (editTask ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Task')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateTaskWithSubtasksModal;
