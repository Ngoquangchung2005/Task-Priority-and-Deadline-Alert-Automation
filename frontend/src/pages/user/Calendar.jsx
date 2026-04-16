import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import LoadingCompass from '../../components/LoadingCompass';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const UserCalendar = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await api.get('/tasks/my-tasks');
                setTasks(res.data.filter(task => !task.archived));
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        };
        fetch();
    }, []);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const getTasksForDate = (day) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return tasks.filter(t => t.deadline && t.deadline.slice(0, 10) === dateStr);
    };

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    const monthLabel = currentDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

    // Upcoming deadlines list
    const upcoming = tasks
        .filter(t => t.deadline && t.status !== 'DONE')
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    if (loading) return <div className="page-loading"><LoadingCompass size={40} /></div>;

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <h1 className="page-title">Calendar & Deadlines</h1>
            </div>

            <div className="calendar-layout">
                {/* Calendar */}
                <div className="glass-panel calendar-panel">
                    <div className="calendar-nav">
                        <button className="btn-glass btn-sm" onClick={prevMonth}><ChevronLeft size={16} /></button>
                        <h3 className="calendar-month">{monthLabel}</h3>
                        <button className="btn-glass btn-sm" onClick={nextMonth}><ChevronRight size={16} /></button>
                    </div>
                    <div className="calendar-grid">
                        {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(d => (
                            <div key={d} className="calendar-header-cell">{d}</div>
                        ))}
                        {Array.from({ length: firstDay }, (_, i) => (
                            <div key={`empty-${i}`} className="calendar-cell empty"></div>
                        ))}
                        {Array.from({ length: daysInMonth }, (_, i) => {
                            const day = i + 1;
                            const dayTasks = getTasksForDate(day);
                            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const isToday = dateStr === todayStr;
                            const hasOverdue = dayTasks.some(t => t.daysLeft !== null && t.daysLeft < 0 && t.status !== 'DONE');
                            const hasDueSoon = dayTasks.some(t => t.daysLeft !== null && t.daysLeft >= 0 && t.daysLeft <= 3 && t.status !== 'DONE');

                            return (
                                <div key={day} className={`calendar-cell ${isToday ? 'today' : ''} ${dayTasks.length > 0 ? 'has-tasks' : ''}`}>
                                    <span className="calendar-day">{day}</span>
                                    {dayTasks.length > 0 && (
                                        <div className="calendar-dots">
                                            {hasOverdue && <span className="cal-dot danger"></span>}
                                            {hasDueSoon && <span className="cal-dot warning"></span>}
                                            {!hasOverdue && !hasDueSoon && <span className="cal-dot info"></span>}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div className="calendar-legend">
                        <span><span className="cal-dot danger"></span> Overdue</span>
                        <span><span className="cal-dot warning"></span> Due soon</span>
                        <span><span className="cal-dot info"></span> Normal</span>
                    </div>
                </div>

                {/* Deadline List */}
                <div className="glass-panel deadline-list-panel">
                    <h3 className="chart-title">📅 All Deadlines</h3>
                    {upcoming.length === 0 ? (
                        <p className="no-data-text">No upcoming deadlines!</p>
                    ) : (
                        <div className="deadline-list">
                            {upcoming.map(t => (
                                <div key={t.id} className={`deadline-item ${t.daysLeft !== null && t.daysLeft < 0 ? 'overdue' : t.daysLeft <= 3 ? 'soon' : ''}`}>
                                    <div className="deadline-date">
                                        <span className="deadline-day">{new Date(t.deadline).getDate()}</span>
                                        <span className="deadline-month">{new Date(t.deadline).toLocaleDateString('vi-VN', { month: 'short' })}</span>
                                    </div>
                                    <div className="deadline-info">
                                        <strong>{t.taskName}</strong>
                                        <span className={`badge-priority ${t.priority.toLowerCase()}`} style={{ fontSize: '0.65rem' }}>{t.priority}</span>
                                    </div>
                                    <span className={`days-badge ${t.daysLeft < 0 ? 'danger' : t.daysLeft <= 3 ? 'warning' : 'info'}`}>
                                        {t.daysLeft < 0 ? `${Math.abs(t.daysLeft)}d late` : t.daysLeft === 0 ? 'Today' : `${t.daysLeft}d`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserCalendar;
