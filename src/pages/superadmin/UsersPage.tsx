import { useEffect, useState, type FormEvent } from 'react'
import { createUser, supabase } from '../../lib/supabase'
import type { Company, Profile, UserRole } from '../../lib/types'
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

export function SuperAdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('company_admin')
  const [companyId, setCompanyId] = useState('')

  const loadData = async () => {
    setLoading(true)
    const [usersRes, companiesRes] = await Promise.all([
      supabase.from('profiles').select('*, companies(name)').order('created_at', { ascending: false }),
      supabase.from('companies').select('*').order('name'),
    ])

    if (usersRes.error) setError(usersRes.error.message)
    else setUsers(usersRes.data ?? [])

    if (companiesRes.error) setError(companiesRes.error.message)
    else setCompanies(companiesRes.data ?? [])

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await createUser({
        email,
        password,
        full_name: fullName,
        role,
        company_id: role === 'superadmin' ? null : companyId,
      })
      setEmail('')
      setPassword('')
      setFullName('')
      setRole('company_admin')
      setCompanyId('')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title="Users" description="Create and manage users across all companies." />

      <Card>
        <h3 className="font-display font-semibold text-pasture-900">Create user</h3>
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
          <Select label="Role" id="role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value="superadmin">Super Admin</option>
            <option value="company_admin">Company Admin</option>
            <option value="company_user">Company User</option>
          </Select>
          {role !== 'superadmin' && (
            <div className="md:col-span-2">
              <Select
                label="Farm"
                id="company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                required
              >
                <option value="">Select a farm</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="md:col-span-2">
            <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create user'}
            </Button>
          </div>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Card>

      <Card>
        <h3 className="font-display font-semibold text-pasture-900">All users</h3>
        {loading ? (
          <EmptyState>Loading...</EmptyState>
        ) : users.length === 0 ? (
          <EmptyState>No users yet.</EmptyState>
        ) : (
          <>
            <MobileCardList>
              {users.map((user) => (
                <MobileCard
                  key={user.id}
                  title={user.full_name ?? '—'}
                  subtitle={user.email}
                  fields={[
                    { label: 'Role', value: roleLabels[user.role] },
                    { label: 'Farm', value: (user.companies as { name: string } | null)?.name ?? '—' },
                  ]}
                />
              ))}
            </MobileCardList>

            <DesktopTable>
              <thead>
                <tr className="border-b border-field-dark text-soil-500">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium">Farm</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-field-dark/60">
                    <td className="py-3 font-medium text-soil-800">{user.full_name ?? '—'}</td>
                    <td className="py-3 text-soil-600">{user.email}</td>
                    <td className="py-3 text-soil-600">{roleLabels[user.role]}</td>
                    <td className="py-3 text-soil-600">
                      {(user.companies as { name: string } | null)?.name ?? '—'}
                    </td>
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
