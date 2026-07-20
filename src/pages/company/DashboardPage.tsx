import { useAuth } from '../../contexts/AuthContext'
import { Card, ActionLink, StatCard } from '../../components/ui/Card'
import { PageHeader } from '../../components/layout/AppShell'

export function CompanyDashboardPage() {
  const { profile } = useAuth()

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Welcome back"
        description={
          profile?.full_name
            ? `Good to see you, ${profile.full_name}.`
            : 'Manage your herd and farm from here.'
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <StatCard label="Your farm" value={profile?.companies?.name ?? '—'} />
        <StatCard
          label="Your role"
          value={profile?.role === 'company_admin' ? 'Farm Admin' : 'Farm User'}
          accent="barn"
        />
      </div>

      <Card>
        <h3 className="font-display font-semibold text-pasture-900">Quick actions</h3>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          <ActionLink to="/app/animals/new">Capture animal</ActionLink>
          {profile?.role === 'company_admin' && (
            <ActionLink to="/app/users">Manage farm team</ActionLink>
          )}
        </div>
      </Card>
    </div>
  )
}
