import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import Login      from './pages/Login';
import Dashboard  from './pages/Dashboard';
import Employees  from './pages/Employees';
import Positions  from './pages/Positions';
import Attendance from './pages/Attendance';
import Payroll    from './pages/Payroll';
import AuditLogs  from './pages/AuditLogs';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={
        <ProtectedRoute roles={['admin','hr','manager']}>
          <Layout><Dashboard /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/employees" element={
        <ProtectedRoute roles={['admin','hr','manager']}>
          <Layout><Employees /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/positions" element={
        <ProtectedRoute roles={['admin']}>
          <Layout><Positions /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/attendance" element={
        <ProtectedRoute roles={['admin','hr','manager','employee']}>
          <Layout><Attendance /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/payroll" element={
        <ProtectedRoute roles={['admin','hr','manager','employee']}>
          <Layout><Payroll /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/audit-logs" element={
        <ProtectedRoute roles={['admin','hr']}>
          <Layout><AuditLogs /></Layout>
        </ProtectedRoute>
      } />

      {/* Redirect employees to attendance */}
      <Route path="*" element={<Navigate to="/attendance" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
