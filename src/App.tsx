import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute, RoleRedirect } from './components/auth/ProtectedRoute'
import { SuperAdminLayout } from './components/layout/SuperAdminLayout'
import { CompanyAdminLayout } from './components/layout/CompanyAdminLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { SuperAdminDashboardPage } from './pages/superadmin/DashboardPage'
import { SuperAdminCompaniesPage } from './pages/superadmin/CompaniesPage'
import { SuperAdminUsersPage } from './pages/superadmin/UsersPage'
import { CompanyDashboardPage } from './pages/company/DashboardPage'
import { CompanyUsersPage } from './pages/company/UsersPage'
import { AnimalsPage } from './pages/company/AnimalsPage'
import { AnimalDetailPage } from './pages/company/AnimalDetailPage'
import { CaptureAnimalPage } from './pages/company/CaptureAnimalPage'
import { FamilyTreePage } from './pages/company/FamilyTreePage'
import { LocationsPage } from './pages/company/LocationsPage'
import { ConfigurationsPage } from './pages/company/ConfigurationsPage'
import { BreedingPage } from './pages/company/BreedingPage'
import { CaptureBirthPage } from './pages/company/CaptureBirthPage'
import { InstallPrompt } from './components/pwa/InstallPrompt'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <InstallPrompt />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/" element={<RoleRedirect />} />

          <Route element={<ProtectedRoute allowedRoles={['superadmin']} />}>
            <Route path="/superadmin" element={<SuperAdminLayout />}>
              <Route index element={<SuperAdminDashboardPage />} />
              <Route path="companies" element={<SuperAdminCompaniesPage />} />
              <Route path="users" element={<SuperAdminUsersPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['company_admin', 'company_user']} />}>
            <Route path="/app" element={<CompanyAdminLayout />}>
              <Route index element={<CompanyDashboardPage />} />
              <Route path="users" element={<CompanyUsersPage />} />
              <Route path="animals" element={<AnimalsPage />} />
              <Route path="animals/new" element={<CaptureAnimalPage />} />
              <Route path="animals/:animalId" element={<AnimalDetailPage />} />
              <Route path="family-trees" element={<FamilyTreePage />} />
              <Route path="breeding" element={<BreedingPage />} />
              <Route path="births" element={<CaptureBirthPage />} />
              <Route path="locations" element={<LocationsPage />} />
              <Route path="configurations" element={<ConfigurationsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
