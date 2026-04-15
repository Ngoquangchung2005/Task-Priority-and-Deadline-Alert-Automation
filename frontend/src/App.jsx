import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';

import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Unauthorized from './pages/Unauthorized';

// Layouts
import ManagerLayout from './layouts/ManagerLayout';
import UserLayout from './layouts/UserLayout';

// Manager Pages
import MgrDashboard from './pages/manager/Dashboard';
import MgrTasks from './pages/manager/Tasks';
import MgrCancelledTasks from './pages/manager/CancelledTasks';
import MgrArchivedTasks from './pages/manager/ArchivedTasks';
import MgrReports from './pages/manager/Reports';
import MgrUsers from './pages/manager/Users';
import MgrNotifications from './pages/manager/Notifications';
import MgrSubtaskBoard from './pages/manager/SubtaskBoard';

// User Pages
import UsrDashboard from './pages/user/Dashboard';
import UsrTasks from './pages/user/Tasks';
import UsrCalendar from './pages/user/Calendar';
import UsrNotifications from './pages/user/Notifications';
import SubtaskBoard from './pages/user/SubtaskBoard';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Manager Routes */}
          <Route path="/manager" element={
            <ProtectedRoute allowedRoles={['MANAGER']}>
              <ManagerLayout />
            </ProtectedRoute>
          }>
            <Route index element={<MgrDashboard />} />
            <Route path="tasks" element={<MgrTasks />} />
            <Route path="tasks/cancelled" element={<MgrCancelledTasks />} />
            <Route path="tasks/archived" element={<MgrArchivedTasks />} />
            <Route path="tasks/:taskId/board" element={<MgrSubtaskBoard />} />
            <Route path="reports" element={<MgrReports />} />
            <Route path="users" element={<MgrUsers />} />
            <Route path="notifications" element={<MgrNotifications />} />
            <Route path="settings" element={<div className="page-container"><h1 className="page-title">Settings</h1><p className="page-subtitle">Coming soon...</p></div>} />
          </Route>

          {/* User Routes */}
          <Route path="/user" element={
            <ProtectedRoute allowedRoles={['USER']}>
              <UserLayout />
            </ProtectedRoute>
          }>
            <Route index element={<UsrDashboard />} />
            <Route path="tasks" element={<UsrTasks />} />
            <Route path="tasks/:taskId/board" element={<SubtaskBoard />} />
            <Route path="calendar" element={<UsrCalendar />} />
            <Route path="notifications" element={<UsrNotifications />} />
            <Route path="settings" element={<div className="page-container"><h1 className="page-title">Settings</h1><p className="page-subtitle">Coming soon...</p></div>} />
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
