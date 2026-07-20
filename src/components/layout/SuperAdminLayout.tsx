import { AppShell, type NavItem } from './AppShell'

const navItems: NavItem[] = [
  { to: '/superadmin', label: 'Dashboard', end: true },
  { to: '/superadmin/companies', label: 'Farms' },
  { to: '/superadmin/users', label: 'Users' },
]

export function SuperAdminLayout() {
  return <AppShell title="Super Admin" navItems={navItems} />
}
