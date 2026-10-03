import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react'
import { createUser, deleteUser, supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Company, Profile, UserRole } from '../../lib/types'
import { filterBySearch } from '../../lib/search'
import { useClientPagination } from '../../lib/pagination'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Card } from '../../components/ui/Card'
import { SearchField } from '../../components/ui/SearchField'
import { Pagination } from '../../components/ui/Pagination'
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
  const { profile } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('company_admin')
  const [companyId, setCompanyId] = useState('')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const filteredUsers = useMemo(
    () =>
      filterBySearch(users, deferredQuery, (user) => [
        user.full_name,
        user.email,
        roleLabels[user.role],
        (user.companies as { name: string } | null)?.name,
      ]),
    [users, deferredQuery],
  )

  const {
    pageItems: pagedUsers,
    page,
    setPage,
    totalPages,
    totalItems,
    start,
    end,
  } = useClientPagination(filteredUsers, { resetKey: deferredQuery })

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

  const handleDelete = async (user: Profile) => {
    if (user.id === profile?.id) {
      setError('You cannot delete your own account.')
      return
    }

    if (!window.confirm(`Delete ${user.full_name || user.email}? This cannot be undone.`)) {
      return
    }

    setError('')
    setSuccess('')
    setDeletingId(user.id)

    try {
      await deleteUser(user.id)
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
      setSuccess(`${user.full_name || user.email} deleted.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    } finally {
      setDeletingId(null)
    }
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      await createUser({
        email,
        full_name: fullName,
        role,
        company_id: role === 'superadmin' ? null : companyId,
      })
      setSuccess(`Invite sent to ${email}. They’ll get an email to set their password.`)
      setEmail('')
      setFullName('')
      setRole('company_admin')
      setCompanyId('')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite user')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader title="Users" description="Invite and manage users across all companies." />

      <Card>
        <h3 className="font-display font-semibold text-pasture-900">Invite user</h3>
        <p className="mt-1 text-sm text-soil-500">
          They’ll receive an email with a link to set up their password.
        </p>
        <form onSubmit={handleCreate} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Select label="Role" id="role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value="superadmin">Super Admin</option>
            <option value="company_admin">Company Admin</option>
            <option value="company_user">Company User</option>
          </Select>
          {role !== 'superadmin' && (
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
          )}
          <div className="md:col-span-2">
            <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
              {submitting ? 'Sending invite...' : 'Send invite'}
            </Button>
          </div>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-3 text-sm text-pasture-800">{success}</p>}
      </Card>

      <Card>
        <h3 className="font-display font-semibold text-pasture-900">All users</h3>
        {loading ? (
          <EmptyState>Loading...</EmptyState>
        ) : users.length === 0 ? (
          <EmptyState>No users yet.</EmptyState>
        ) : (
          <>
            <div className="mt-4">
              <SearchField
                id="users-search"
                value={query}
                onChange={setQuery}
                placeholder="Search name, email, role, farm…"
                resultCount={filteredUsers.length}
                totalCount={users.length}
              />
            </div>
            {filteredUsers.length === 0 ? (
              <EmptyState>No users match your search.</EmptyState>
            ) : (
              <>
                <MobileCardList>
                  {pagedUsers.map((user) => (
                    <MobileCard
                      key={user.id}
                      title={user.full_name ?? '—'}
                      subtitle={user.email}
                      fields={[
                        { label: 'Role', value: roleLabels[user.role] },
                        { label: 'Farm', value: (user.companies as { name: string } | null)?.name ?? '—' },
                      ]}
                      action={
                        user.id === profile?.id ? undefined : (
                          <button
                            type="button"
                            className="text-xs font-semibold text-red-700 hover:text-red-800 disabled:opacity-50"
                            disabled={deletingId === user.id}
                            onClick={() => handleDelete(user)}
                          >
                            {deletingId === user.id ? 'Deleting...' : 'Delete'}
                          </button>
                        )
                      }
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
                      <th className="pb-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedUsers.map((user) => (
                      <tr key={user.id} className="border-b border-field-dark/60">
                        <td className="py-3 font-medium text-soil-800">{user.full_name ?? '—'}</td>
                        <td className="py-3 text-soil-600">{user.email}</td>
                        <td className="py-3 text-soil-600">{roleLabels[user.role]}</td>
                        <td className="py-3 text-soil-600">
                          {(user.companies as { name: string } | null)?.name ?? '—'}
                        </td>
                        <td className="py-3 text-right">
                          {user.id === profile?.id ? (
                            <span className="text-xs text-soil-500">You</span>
                          ) : (
                            <button
                              type="button"
                              className="font-semibold text-red-700 hover:text-red-800 disabled:opacity-50"
                              disabled={deletingId === user.id}
                              onClick={() => handleDelete(user)}
                            >
                              {deletingId === user.id ? 'Deleting...' : 'Delete'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DesktopTable>

                <Pagination
                  page={page}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  start={start}
                  end={end}
                  onPageChange={setPage}
                />
              </>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
