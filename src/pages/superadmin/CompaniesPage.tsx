import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { Company, Package } from '../../lib/types'
import { filterBySearch } from '../../lib/search'
import { useClientPagination } from '../../lib/pagination'
import {
  clearFarmDemoData,
  resetFarmData,
  seedFarmDemoData,
} from '../../lib/farmDemo'
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

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function SuperAdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [packageId, setPackageId] = useState('')
  const [savingPackageId, setSavingPackageId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const filteredCompanies = useMemo(
    () =>
      filterBySearch(companies, deferredQuery, (company) => [
        company.name,
        company.slug,
        company.packages?.name,
      ]),
    [companies, deferredQuery],
  )

  const {
    pageItems: pagedCompanies,
    page,
    setPage,
    totalPages,
    totalItems,
    start,
    end,
  } = useClientPagination(filteredCompanies, { resetKey: deferredQuery })

  const loadCompanies = async () => {
    setLoading(true)
    const withPackages = await supabase
      .from('companies')
      .select('*, packages(id, name, slug)')
      .order('created_at', { ascending: false })

    const [companiesRes, packagesRes] = await Promise.all([
      withPackages.error
        ? supabase.from('companies').select('*').order('created_at', { ascending: false })
        : Promise.resolve(withPackages),
      supabase.from('packages').select('*').order('sort_order'),
    ])

    if (companiesRes.error) {
      setError(companiesRes.error.message)
    } else {
      setCompanies(companiesRes.data ?? [])
    }

    if (packagesRes.error) {
      setError(packagesRes.error.message)
    } else {
      const nextPackages = (packagesRes.data ?? []) as Package[]
      setPackages(nextPackages)
      setPackageId((current) => {
        if (current && nextPackages.some((pkg) => pkg.id === current)) return current
        return nextPackages.find((pkg) => pkg.slug === 'entry')?.id ?? nextPackages[0]?.id ?? ''
      })
    }
    setLoading(false)
  }

  useEffect(() => {
    loadCompanies()
  }, [])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    const slug = slugify(name)
    const { error: insertError } = await supabase.from('companies').insert({
      name,
      slug,
      ...(packageId ? { package_id: packageId } : {}),
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      setName('')
      setSuccess('Farm created.')
      await loadCompanies()
    }
    setSubmitting(false)
  }

  const handleDelete = async (company: Company) => {
    if (!confirm(`Delete farm "${company.name}"? Users will be unlinked.`)) return

    setError('')
    setSuccess('')
    const { error: deleteError } = await supabase.from('companies').delete().eq('id', company.id)
    if (deleteError) {
      setError(deleteError.message)
    } else {
      setSuccess(`Farm "${company.name}" deleted.`)
      await loadCompanies()
    }
  }

  const handleSeedDemo = async (company: Company) => {
    if (
      !confirm(
        `Seed demo locations, animals, pedigrees, and inoculations on "${company.name}"?\n\nExisting demo-tagged data on this farm will be replaced first. Users are not changed.`,
      )
    ) {
      return
    }

    setBusyId(company.id)
    setError('')
    setSuccess('')

    try {
      const result = await seedFarmDemoData(company.id)
      setSuccess(
        `Demo data seeded on ${company.name}: ${result.animals} animals, ${result.locations} locations, ${result.encampments} camps, ${result.inoculations} inoculations.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed demo data')
    } finally {
      setBusyId(null)
    }
  }

  const handleClearDemo = async (company: Company) => {
    if (
      !confirm(
        `Remove demo data from "${company.name}"?\n\nOnly demo-tagged locations, animals, and inoculations are deleted. Real farm data stays.`,
      )
    ) {
      return
    }

    setBusyId(company.id)
    setError('')
    setSuccess('')

    try {
      const result = await clearFarmDemoData(company.id)
      setSuccess(
        `Demo data cleared on ${company.name}: ${result.deleted_animals} animals, ${result.deleted_locations} locations removed.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear demo data')
    } finally {
      setBusyId(null)
    }
  }

  const handleResetFarm = async (company: Company) => {
    if (
      !confirm(
        `RESET "${company.name}"?\n\nThis deletes ALL animals, locations, camps, inoculations, and photo records on this farm.\nUsers and the farm itself are kept.\n\nThis cannot be undone.`,
      )
    ) {
      return
    }

    setBusyId(company.id)
    setError('')
    setSuccess('')

    try {
      const result = await resetFarmData(company.id)
      setSuccess(
        `Farm reset for ${company.name}: removed ${result.deleted_animals} animals, ${result.deleted_locations} locations, ${result.deleted_encampments} camps.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset farm')
    } finally {
      setBusyId(null)
    }
  }

  const handleAssignPackage = async (company: Company, nextPackageId: string) => {
    if (!nextPackageId || nextPackageId === company.package_id) return

    setSavingPackageId(company.id)
    setError('')
    setSuccess('')

    const { error: updateError } = await supabase
      .from('companies')
      .update({ package_id: nextPackageId })
      .eq('id', company.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      const next = packages.find((pkg) => pkg.id === nextPackageId) ?? null
      setCompanies((current) =>
        current.map((row) =>
          row.id === company.id ? { ...row, package_id: nextPackageId, packages: next } : row,
        ),
      )
      setSuccess(`${company.name} is now on ${next?.name ?? 'the selected package'}. Existing records stay.`)
    }
    setSavingPackageId(null)
  }

  const packageSelect = (company: Company) => (
    <Select
      aria-label={`Package for ${company.name}`}
      value={company.package_id ?? ''}
      disabled={savingPackageId === company.id || packages.length === 0}
      onChange={(e) => handleAssignPackage(company, e.target.value)}
    >
      {packages.length === 0 && <option value="">No packages</option>}
      {packages.map((pkg) => (
        <option key={pkg.id} value={pkg.id}>
          {pkg.name}
        </option>
      ))}
    </Select>
  )

  const farmActions = (company: Company) => {
    const busy = busyId === company.id
    return (
      <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
        <Button
          type="button"
          variant="secondary"
          className="px-3 py-1.5 text-xs"
          disabled={busy}
          onClick={() => handleSeedDemo(company)}
        >
          {busy ? 'Working...' : 'Seed demo'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="px-3 py-1.5 text-xs"
          disabled={busy}
          onClick={() => handleClearDemo(company)}
        >
          Clear demo
        </Button>
        <Button
          type="button"
          variant="danger"
          className="px-3 py-1.5 text-xs"
          disabled={busy}
          onClick={() => handleResetFarm(company)}
        >
          Reset farm
        </Button>
        <Button
          type="button"
          variant="danger"
          className="px-3 py-1.5 text-xs"
          disabled={busy}
          onClick={() => handleDelete(company)}
        >
          Delete farm
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Farms"
        description="Register farms, assign a package, seed demo livestock data, or reset a farm’s operational data."
      />

      <Card>
        <h3 className="font-display font-semibold text-pasture-900">Add farm</h3>
        <form onSubmit={handleCreate} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Farm name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Green Valley Ranch"
            required
          />
          <Select
            label="Package"
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
            disabled={packages.length === 0}
          >
            {packages.length === 0 && <option value="">Entry (after migration)</option>}
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.name}
              </option>
            ))}
          </Select>
          <div className="md:col-span-2">
            <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
              {submitting ? 'Creating...' : 'Add farm'}
            </Button>
          </div>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-3 text-sm text-pasture-800">{success}</p>}
      </Card>

      <Card tone="muted">
        <h3 className="font-display font-semibold text-pasture-900">Demo data tools</h3>
        <p className="mt-1 text-sm text-soil-600">
          <span className="font-semibold">Seed demo</span> adds locations, camps, ~265 Boer goats
          (with animal IDs and pedigrees), and inoculations. <span className="font-semibold">Clear demo</span> removes
          only that demo-tagged data. <span className="font-semibold">Reset farm</span> wipes all
          animals/locations on the farm (keeps users).
        </p>
      </Card>

      <Card>
        <h3 className="font-display font-semibold text-pasture-900">All farms</h3>
        {loading ? (
          <EmptyState>Loading...</EmptyState>
        ) : companies.length === 0 ? (
          <EmptyState>No farms registered yet.</EmptyState>
        ) : (
          <>
            <div className="mt-4">
              <SearchField
                id="farms-search"
                value={query}
                onChange={setQuery}
                placeholder="Search farm name or slug…"
                resultCount={filteredCompanies.length}
                totalCount={companies.length}
              />
            </div>
            {filteredCompanies.length === 0 ? (
              <EmptyState>No farms match your search.</EmptyState>
            ) : (
              <>
                <MobileCardList>
                  {pagedCompanies.map((company) => (
                    <MobileCard
                      key={company.id}
                      title={company.name}
                      subtitle={company.slug}
                      fields={[
                        ...(packages.length > 0
                          ? [{ label: 'Package', value: company.packages?.name ?? '—' }]
                          : []),
                        { label: 'Created', value: new Date(company.created_at).toLocaleDateString() },
                      ]}
                      action={
                        <div className="flex w-36 flex-col gap-2">
                          {packages.length > 0 && packageSelect(company)}
                          {farmActions(company)}
                        </div>
                      }
                    />
                  ))}
                </MobileCardList>

                <DesktopTable>
                  <thead>
                    <tr className="border-b border-field-dark text-soil-500">
                      <th className="pb-2 font-medium">Name</th>
                      <th className="pb-2 font-medium">Slug</th>
                      {packages.length > 0 && <th className="pb-2 font-medium">Package</th>}
                      <th className="pb-2 font-medium">Created</th>
                      <th className="pb-2 font-medium">Demo / reset</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCompanies.map((company) => (
                      <tr key={company.id} className="border-b border-field-dark/60">
                        <td className="py-3 font-medium text-soil-800">{company.name}</td>
                        <td className="py-3 text-soil-600">{company.slug}</td>
                        {packages.length > 0 && (
                          <td className="min-w-40 py-3">{packageSelect(company)}</td>
                        )}
                        <td className="py-3 text-soil-600">
                          {new Date(company.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              className="px-3 py-1.5 text-xs"
                              disabled={busyId === company.id}
                              onClick={() => handleSeedDemo(company)}
                            >
                              {busyId === company.id ? 'Working...' : 'Seed demo'}
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              className="px-3 py-1.5 text-xs"
                              disabled={busyId === company.id}
                              onClick={() => handleClearDemo(company)}
                            >
                              Clear demo
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              className="px-3 py-1.5 text-xs"
                              disabled={busyId === company.id}
                              onClick={() => handleResetFarm(company)}
                            >
                              Reset farm
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              className="px-3 py-1.5 text-xs"
                              disabled={busyId === company.id}
                              onClick={() => handleDelete(company)}
                            >
                              Delete farm
                            </Button>
                          </div>
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
