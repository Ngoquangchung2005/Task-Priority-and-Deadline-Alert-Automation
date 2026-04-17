import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

const ManagerLayout = () => {
    return (
        <div className="dashboard-layout fade-in">
            <Sidebar />
            <div className="main-content">
                <Outlet />
            </div>
        </div>
    );
};

export default ManagerLayout;
