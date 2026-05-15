import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, RefreshCw } from 'lucide-react';
import DetailedTaskDrawer from './DetailedTaskDrawer';
import { formatDateTime, getDaysLeft } from '../utils/taskMetrics';

const toDateKey = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (input) => String(input).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const statusLabel = (status) => ({
    PENDING: 'Pending',
    TODO: 'To Do',
    IN_PROGRESS: 'In Progress',
    IN_REVIEW: 'In Review',
    OVERDUE: 'Overdue',
    DONE: 'Done',
    CANCELLED: 'Cancelled',
    ARCHIVED: 'Archived'
}[status] || status || '-');

const stateClass = (item) => {
    if (item.status === 'DONE') return 'success';
    if (['CANCELLED', 'ARCHIVED'].includes(item.status)) return 'muted';
    if (item.daysLeft !== null && item.daysLeft < 0) return 'danger';
    if (item.daysLeft !== null && item.daysLeft <= 3) return 'warning';
    if (['IN_PROGRESS', 'IN_REVIEW'].includes(item.status)) return 'info';
    return 'pending';
};

const DeadlineCalendar = ({ title, subtitle, items = [], loading, isUser = false, onRefresh, error }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
    const [selectedTask, setSelectedTask] = useState(null);
    const [typeFilter, setTypeFilter] = useState('ALL');

    const normalizedItems = useMemo(() => (
        items
            .filter((item) => item.deadline)
            .map((item) => ({
                ...item,
                dateKey: toDateKey(item.deadline),
                daysLeft: item.daysLeft ?? getDaysLeft(item.deadline)
            }))
    ), [items]);

    const filteredItems = useMemo(() => (
        normalizedItems
            .filter((item) => typeFilter === 'ALL' || item.kind === typeFilter)
            .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    ), [normalizedItems, typeFilter]);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayKey = toDateKey(new Date());
    const monthLabel = currentDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

    const itemsByDate = useMemo(() => (
        filteredItems.reduce((acc, item) => {
            acc[item.dateKey] = acc[item.dateKey] || [];
            acc[item.dateKey].push(item);
            return acc;
        }, {})
    ), [filteredItems]);

    const selectedItems = itemsByDate[selectedDate] || [];
    const upcomingItems = filteredItems
        .filter((item) => item.status !== 'CANCELLED')
        .slice(0, 18);

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    const openItem = (item) => {
        setSelectedTask(item.detailTask);
    };

    if (loading) {
        return null;
    }

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{title}</h1>
                    {subtitle && <p className="page-subtitle">{subtitle}</p>}
                </div>
                <div className="page-header-actions">
                    <select className="filter-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                        <option value="ALL">All deadlines</option>
                        <option value="TASK">Parent tasks</option>
                        <option value="SUBTASK">Subtasks</option>
                    </select>
                    {onRefresh && (
                        <button className="btn-glass" onClick={onRefresh}>
                            <RefreshCw size={16} /> Refresh
                        </button>
                    )}
                </div>
            </div>

            {error && <div className="form-error-banner">{error}</div>}

            <div className="calendar-layout">
                <div className="glass-panel calendar-panel deadline-calendar-panel">
                    <div className="calendar-nav">
                        <button className="btn-glass btn-sm" onClick={prevMonth}><ChevronLeft size={16} /></button>
                        <h3 className="calendar-month">{monthLabel}</h3>
                        <button className="btn-glass btn-sm" onClick={nextMonth}><ChevronRight size={16} /></button>
                    </div>

                    <div className="calendar-grid deadline-calendar-grid">
                        {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day) => (
                            <div key={day} className="calendar-header-cell">{day}</div>
                        ))}
                        {Array.from({ length: firstDay }, (_, index) => (
                            <div key={`empty-${index}`} className="calendar-cell empty"></div>
                        ))}
                        {Array.from({ length: daysInMonth }, (_, index) => {
                            const day = index + 1;
                            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const dayItems = itemsByDate[dateKey] || [];
                            const visibleItems = dayItems.slice(0, 3);

                            return (
                                <button
                                    key={day}
                                    type="button"
                                    className={`calendar-cell deadline-calendar-cell ${dateKey === todayKey ? 'today' : ''} ${dateKey === selectedDate ? 'selected' : ''}`}
                                    onClick={() => setSelectedDate(dateKey)}
                                >
                                    <span className="calendar-day">{day}</span>
                                    <div className="calendar-day-items">
                                        {visibleItems.map((item) => (
                                            <span key={`${item.kind}-${item.id}`} className={`calendar-event-pill ${stateClass(item)}`} title={item.title}>
                                                {item.kind === 'SUBTASK' ? 'S' : 'T'} · {item.title}
                                            </span>
                                        ))}
                                        {dayItems.length > visibleItems.length && (
                                            <span className="calendar-more">+{dayItems.length - visibleItems.length}</span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="calendar-legend">
                        <span><span className="cal-dot danger"></span> Overdue</span>
                        <span><span className="cal-dot warning"></span> Due soon</span>
                        <span><span className="cal-dot info"></span> In progress</span>
                        <span><span className="cal-dot success"></span> Done</span>
                    </div>
                </div>

                <div className="glass-panel deadline-list-panel">
                    <h3 className="chart-title">Selected Day</h3>
                    {selectedItems.length === 0 ? (
                        <p className="no-data-text">No deadlines on this date.</p>
                    ) : (
                        <div className="deadline-list selected-deadline-list">
                            {selectedItems.map((item) => (
                                <DeadlineItem key={`${item.kind}-${item.id}`} item={item} onOpen={openItem} compact />
                            ))}
                        </div>
                    )}

                    <h3 className="chart-title deadline-list-title">All Deadlines</h3>
                    {upcomingItems.length === 0 ? (
                        <p className="no-data-text">No deadlines found.</p>
                    ) : (
                        <div className="deadline-list">
                            {upcomingItems.map((item) => (
                                <DeadlineItem key={`${item.kind}-${item.id}`} item={item} onOpen={openItem} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {selectedTask && (
                <DetailedTaskDrawer
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onTaskChanged={onRefresh}
                    isUser={isUser}
                />
            )}
        </div>
    );
};

const DeadlineItem = ({ item, onOpen, compact = false }) => (
    <button type="button" className={`deadline-item deadline-clickable ${stateClass(item)} ${compact ? 'compact' : ''}`} onClick={() => onOpen(item)}>
        <div className="deadline-date">
            <span className="deadline-day">{new Date(item.deadline).getDate()}</span>
            <span className="deadline-month">{new Date(item.deadline).toLocaleDateString('vi-VN', { month: 'short' })}</span>
        </div>
        <div className="deadline-info deadline-info-stack">
            <strong>{item.title}</strong>
            <span>{item.kind === 'SUBTASK' ? item.parentTaskName || 'Parent task' : item.assignee || '-'}</span>
            <span>{formatDateTime(item.deadline)} · {statusLabel(item.status)}</span>
        </div>
        <span className={`days-badge ${stateClass(item) === 'danger' ? 'danger' : stateClass(item) === 'warning' ? 'warning' : 'info'}`}>
            {item.status === 'DONE' ? 'Done' : item.daysLeft < 0 ? `${Math.abs(item.daysLeft)}d late` : item.daysLeft === 0 ? 'Today' : `${item.daysLeft}d`}
        </span>
        <Eye size={14} className="deadline-open-icon" />
    </button>
);

export default DeadlineCalendar;
