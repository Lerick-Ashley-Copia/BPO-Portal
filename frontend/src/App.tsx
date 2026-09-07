import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import { PortalLayout } from './layouts/PortalLayout'
import { AnnouncementsPage } from './pages/announcements/AnnouncementsPage'
import { BenefitsPage } from './pages/benefits/BenefitsPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { DocumentsPage } from './pages/documents/DocumentsPage'
import { HrisPage } from './pages/hris/HrisPage'
import { LoginPage } from './pages/login/LoginPage'
import { ReportsPage } from './pages/reports/ReportsPage'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
