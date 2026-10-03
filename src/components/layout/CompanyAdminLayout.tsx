import { AppShell, type NavItem } from './AppShell'
import { useAuth } from '../../contexts/AuthContext'

export function CompanyAdminLayout() {
  const { profile } = useAuth()
  const companyName = profile?.companies?.name ?? 'Your company'

  const isAdmin = profile?.role === 'company_admin'

  const navItems: NavItem[] = [
    { to: '/app', label: 'Dashboard', end: true },
    { to: '/app/animals', label: 'Animals' },
    { to: '/app/family-trees', label: 'Family trees' },
    { to: '/app/breeding', label: 'Breeding' },
    { to: '/app/locations', label: 'Locations' },
    ...(isAdmin ? [{ to: '/app/users', label: 'Team' }] : []),
  ]

  return <AppShell title={companyName} navItems={navItems} />
}
