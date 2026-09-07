import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import { PortalLayout } from './layouts/PortalLayout'
import { AnnouncementsPage } from './pages/announcements/AnnouncementsPage'
import { AttendancePage } from './pages/attendance/AttendancePage'
import { AuditLogsPage } from './pages/audit-logs/AuditLogsPage'
import { BenefitsPage } from './pages/benefits/BenefitsPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { DocumentsPage } from './pages/documents/DocumentsPage'
import { HrisPage } from './pages/hris/HrisPage'
import { LeaveRequestsPage } from './pages/leave/LeaveRequestsPage'
import { LoginPage } from './pages/login/LoginPage'
import { ReportsPage } from './pages/reports/ReportsPage'
import { SetPasswordPage } from './pages/set-password/SetPasswordPage'
import { UsersPage } from './pages/users/UsersPage'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
          <Route
            element={
              <RequireAuth>
                <PortalLayout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/announcements" element={<AnnouncementsPage />} />
            <Route path="/benefits" element={<BenefitsPage />} />
            <Route path="/hris" element={<HrisPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/leave" element={<LeaveRequestsPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route
              path="/users"
              element={
                <RequireAuth roles={['admin']}>
                  <UsersPage />
                </RequireAuth>
              }
            />
            <Route
              path="/audit-logs"
              element={
                <RequireAuth roles={['admin']}>
                  <AuditLogsPage />
                </RequireAuth>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
