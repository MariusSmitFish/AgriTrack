import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { Company } from '../../lib/types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import {
  DesktopTable,
  EmptyState,
  MobileCard,
  MobileCardList,
  PageHeader,
} from '../../components/layout/AppShell'

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function SuperAdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadCompanies = async () => {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setCompanies(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadCompanies()
  }, [])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const slug = slugify(name)
    const { error: insertError } = await supabase.from('companies').insert({ name, slug })

    if (insertError) {
      setError(insertError.message)
    } else {
      setName('')
      await loadCompanies()
    }
    setSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this company? Users will be unlinked.')) return

    const { error: deleteError } = await supabase.from('companies').delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
    } else {
      await loadCompanies()
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title="Farms" description="Register and manage farm operations on the platform." />

      <Card>
        <h3 className="font-display font-semibold text-pasture-900">Add farm</h3>
        <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Farm name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Green Valley Ranch"
              required
            />
          </div>
          <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
            {submitting ? 'Creating...' : 'Add farm'}
          </Button>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Card>

      <Card>
        <h3 className="font-display font-semibold text-pasture-900">All farms</h3>
        {loading ? (
          <EmptyState>Loading...</EmptyState>
        ) : companies.length === 0 ? (
          <EmptyState>No farms registered yet.</EmptyState>
        ) : (
          <>
            <MobileCardList>
              {companies.map((company) => (
                <MobileCard
                  key={company.id}
                  title={company.name}
                  subtitle={company.slug}
                  fields={[
                    { label: 'Created', value: new Date(company.created_at).toLocaleDateString() },
                  ]}
                  action={
                    <Button variant="danger" className="shrink-0 px-3 text-xs" onClick={() => handleDelete(company.id)}>
                      Delete
                    </Button>
                  }
                />
              ))}
            </MobileCardList>

            <DesktopTable>
              <thead>
                <tr className="border-b border-field-dark text-soil-500">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Slug</th>
                  <th className="pb-2 font-medium">Created</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id} className="border-b border-field-dark/60">
                    <td className="py-3 font-medium text-soil-800">{company.name}</td>
                    <td className="py-3 text-soil-600">{company.slug}</td>
                    <td className="py-3 text-soil-600">
                      {new Date(company.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-right">
                      <Button variant="danger" onClick={() => handleDelete(company.id)}>
                        Delete
                      </Button>
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
