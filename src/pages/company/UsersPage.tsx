import { useEffect, useState, type FormEvent } from 'react'
import { createUser, supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Profile, UserRole } from '../../lib/types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Card } from '../../components/ui/Card'
import {
  DesktopTable,
  EmptyState,
  MobileCard,
  MobileCardList,
  PageHeader,
} from '../../components/layout/AppShell'

const roleLabels: Record<UserRole, string> = {
  superadmin: 'Super Admin',
  company_admin: 'Company Admin',
  company_user: 'Company User',
}

export function CompanyUsersPage() {
  const { profile } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('company_user')

  const isAdmin = profile?.role === 'company_admin'

  const loadUsers = async () => {
    if (!profile?.company_id) return

    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })

    if (fetchError) setError(fetchError.message)
    else setUsers(data ?? [])

    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [profile?.company_id])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile?.company_id) return

    setError('')
    setSubmitting(true)

    try {
      await createUser({
        email,
        password,
        full_name: fullName,
        role,
        company_id: profile.company_id,
      })
      setEmail('')
      setPassword('')
      setFullName('')
      setRole('company_user')
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="space-y-5 sm:space-y-6">
        <PageHeader title="Users" />
        <Card>
          <p className="text-sm text-soil-500">
            You need company admin permissions to manage users.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title="Farm team" description="Add and manage people on your farm." />

      <Card>
        <h3 className="font-display font-semibold text-pasture-900">Add team member</h3>
        <form onSubmit={handleCreate} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <Select
            label="Role"
            id="company-role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            <option value="company_admin">Company Admin</option>
            <option value="company_user">Company User</option>
          </Select>
          <div className="md:col-span-2">
            <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add user'}
            </Button>
          </div>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Card>

      <Card>
        <h3 className="font-display font-semibold text-pasture-900">Team members</h3>
        {loading ? (
          <EmptyState>Loading...</EmptyState>
        ) : users.length === 0 ? (
          <EmptyState>No team members yet.</EmptyState>
        ) : (
          <>
            <MobileCardList>
              {users.map((user) => (
                <MobileCard
                  key={user.id}
                  title={user.full_name ?? '—'}
                  subtitle={user.email}
                  fields={[{ label: 'Role', value: roleLabels[user.role] }]}
                />
              ))}
            </MobileCardList>

            <DesktopTable>
              <thead>
                <tr className="border-b border-field-dark text-soil-500">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-field-dark/60">
                    <td className="py-3 font-medium text-soil-800">{user.full_name ?? '—'}</td>
                    <td className="py-3 text-soil-600">{user.email}</td>
                    <td className="py-3 text-soil-600">{roleLabels[user.role]}</td>
                  </tr>
                ))}
              </tbody>
            </DesktopTable>
          </>
        )}
      </Card>
    </div>
  )
}
