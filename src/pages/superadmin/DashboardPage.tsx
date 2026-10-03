import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, ActionLink, StatCard } from '../../components/ui/Card'
import { PageHeader } from '../../components/layout/AppShell'

export function SuperAdminDashboardPage() {
  const [stats, setStats] = useState({ companies: 0, users: 0, admins: 0 })

  useEffect(() => {
    async function loadStats() {
      const [companiesRes, usersRes, adminsRes] = await Promise.all([
        supabase.from('companies').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'company_admin'),
      ])

      setStats({
        companies: companiesRes.count ?? 0,
        users: usersRes.count ?? 0,
        admins: adminsRes.count ?? 0,
      })
    }

    loadStats()
  }, [])

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Dashboard"
        description="Overview of farms on the platform."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Farms" value={stats.companies} />
        <StatCard label="Total users" value={stats.users} accent="barn" />
        <div className="sm:col-span-2 lg:col-span-1">
          <StatCard label="Farm admins" value={stats.admins} accent="barn" />
        </div>
      </div>

      <Card>
        <h3 className="font-display font-semibold text-pasture-900">Quick actions</h3>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          <ActionLink to="/superadmin/companies">Manage farms</ActionLink>
          <ActionLink to="/superadmin/users">Manage users</ActionLink>
        </div>
      </Card>
    </div>
  )
}
