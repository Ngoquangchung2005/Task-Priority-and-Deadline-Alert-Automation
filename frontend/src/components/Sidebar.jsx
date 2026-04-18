import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, CheckSquare, FileText, Settings, LogOut, ListTodo, Users, Bell, Calendar, Trash2, Archive } from 'lucide-react';
import deadlineMark from '../assets/deadline-mark.svg';

const Sidebar = () => {
    const { user, logout } = useAuth();
    const isManager = user?.role === 'MANAGER';

    return (
        <div className="sidebar glass-panel">
            <div className="sidebar-brand-block">
                <div className="sidebar-title">
                    <img src={deadlineMark} alt="DeadlineDash" className="sidebar-brand-mark" />
                    DeadlineDash
                </div>
                <p className="sidebar-tagline">"It always seems impossible until it's done."</p>
            </div>

            <div className="sidebar-section-label">MENU</div>

            {isManager ? (
                <>
                    <NavLink to="/manager" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} end>
                        <LayoutDashboard size={20} /> Overview
                    </NavLink>
                    <NavLink to="/manager/tasks" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <ListTodo size={20} /> Tasks
                    </NavLink>
                    <NavLink to="/manager/tasks/cancelled" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Trash2 size={20} /> Cancelled
                    </NavLink>
                    <NavLink to="/manager/tasks/archived" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Archive size={20} /> Archived
                    </NavLink>
                    <NavLink to="/manager/reports" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <FileText size={20} /> Reports
                    </NavLink>
                    <NavLink to="/manager/users" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Users size={20} /> Users
                    </NavLink>
                    <NavLink to="/manager/notifications" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Bell size={20} /> Notifications
                    </NavLink>
                    <NavLink to="/manager/settings" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Settings size={20} /> Settings
                    </NavLink>
                </>
            ) : (
                <>
                    <NavLink to="/user" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} end>
                        <LayoutDashboard size={20} /> My Dashboard
                    </NavLink>
                    <NavLink to="/user/tasks" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <CheckSquare size={20} /> My Tasks
                    </NavLink>
                    <NavLink to="/user/calendar" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Calendar size={20} /> Calendar
                    </NavLink>
                    <NavLink to="/user/notifications" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Bell size={20} /> Notifications
                    </NavLink>
                    <NavLink to="/user/settings" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Settings size={20} /> Settings
                    </NavLink>
                </>
            )}

            <div className="sidebar-user-info">
                <div className="avatar">{user?.fullName?.charAt(0)?.toUpperCase() || 'U'}</div>
                <div className="sidebar-user-detail">
                    <span className="sidebar-user-name">{user?.fullName || 'User'}</span>
                    <span className="sidebar-user-role">{user?.role}</span>
                </div>
            </div>

            <button onClick={logout} className="nav-item logout-btn">
                <LogOut size={20} /> Logout
            </button>
        </div>
    );
};

export default Sidebar;
