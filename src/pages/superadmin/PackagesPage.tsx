import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { EmptyState, PageHeader } from '../../components/layout/AppShell'
import { supabase } from '../../lib/supabase'
import {
  PACKAGE_LIMITS,
  fetchPackages,
  formatPackagePrice,
  parseOptionalLimit,
} from '../../lib/packages'
import type { Package, PackageLimitKey } from '../../lib/types'
import { friendlyError } from '../../lib/userError'

interface PackageDraft {
  name: string
  description: string
  yearlyPrice: string
  currency: string
  limits: Record<PackageLimitKey, string>
}

function toDraft(pkg: Package): PackageDraft {
  return {
    name: pkg.name,
    description: pkg.description ?? '',
    yearlyPrice: pkg.yearly_price == null ? '0' : String(pkg.yearly_price),
    currency: pkg.currency || 'ZAR',
    limits: Object.fromEntries(
      PACKAGE_LIMITS.map((field) => [
        field.limit,
        pkg[field.limit] == null ? '' : String(pkg[field.limit]),
      ]),
    ) as Record<PackageLimitKey, string>,
  }
}

export function SuperAdminPackagesPage() {
  const [packages, setPackages] = useState<Package[]>([])
  const [drafts, setDrafts] = useState<Record<string, PackageDraft>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const next = await fetchPackages()
      setPackages(next)
      setDrafts(Object.fromEntries(next.map((pkg) => [pkg.id, toDraft(pkg)])))
      setError('')
    } catch (err) {
      setError(friendlyError(err, 'Failed to load packages'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const updateDraft = (id: string, patch: Partial<PackageDraft>) => {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }))
  }

  const updateLimit = (id: string, key: PackageLimitKey, value: string) => {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        limits: { ...current[id].limits, [key]: value },
      },
    }))
  }

  const save = async (pkg: Package) => {
    const draft = drafts[pkg.id]
    if (!draft) return

    setError('')
    setSuccess('')
    setSavingId(pkg.id)

    try {
      const name = draft.name.trim()
      if (!name) throw new Error('Package name is required.')

      const currency = draft.currency.trim().toUpperCase()
      if (currency.length < 3) throw new Error('Currency should be a code such as ZAR.')

      const price = Number(draft.yearlyPrice)
      if (!Number.isFinite(price) || price < 0) {
        throw new Error('Yearly price must be zero or more.')
      }

      const limits = Object.fromEntries(
        PACKAGE_LIMITS.map((field) => [field.limit, parseOptionalLimit(draft.limits[field.limit], field.label)]),
      )

      const { error: updateError } = await supabase
        .from('packages')
        .update({
          name,
          description: draft.description.trim() || null,
          yearly_price: price,
          currency,
          ...limits,
        })
        .eq('id', pkg.id)

      if (updateError) throw new Error(updateError.message)
      setSuccess(`${name} saved. Farms on this package use the new limits immediately.`)
      await load()
    } catch (err) {
      setError(friendlyError(err, 'Failed to save package'))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Packages"
        description="Entry, Intermediate, and Unlimited. Set the yearly price and the caps, then assign a package on each farm."
      />

      <Card tone="muted">
        <p className="text-sm text-soil-700">
          Leave a limit blank for unlimited. Caps apply when a farm user adds team members, animals, locations,
          camps, photos, documents, or backups. Health records, weights, breeding, and show results are not capped
          separately. Existing farms start on Unlimited. New farms start on Entry. Demo seed run by a super admin
          is not capped.
        </p>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-pasture-800">{success}</p>}

      {loading ? (
        <EmptyState>Loading packages...</EmptyState>
      ) : packages.length === 0 ? (
        <EmptyState>No packages found. Apply the packages migration first.</EmptyState>
      ) : (
        packages.map((pkg) => {
          const draft = drafts[pkg.id]
          if (!draft) return null
          const saving = savingId === pkg.id

          return (
            <Card key={pkg.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-soil-500">{pkg.slug}</p>
                  <h3 className="mt-1 font-display text-xl font-bold text-pasture-900">{draft.name || pkg.name}</h3>
                  <p className="mt-1 text-sm text-soil-600">
                    {formatPackagePrice(draft.yearlyPrice, draft.currency)}
                  </p>
                </div>
                <Button type="button" className="w-full sm:w-auto" disabled={saving} onClick={() => save(pkg)}>
                  {saving ? 'Saving...' : 'Save package'}
                </Button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  label="Name"
                  value={draft.name}
                  onChange={(e) => updateDraft(pkg.id, { name: e.target.value })}
                  required
                />
                <Input
                  label="Yearly price"
                  inputMode="decimal"
                  value={draft.yearlyPrice}
                  onChange={(e) => updateDraft(pkg.id, { yearlyPrice: e.target.value })}
                />
                <Input
                  label="Currency"
                  value={draft.currency}
                  maxLength={8}
                  onChange={(e) => updateDraft(pkg.id, { currency: e.target.value.toUpperCase() })}
                />
                <div className="space-y-1 md:col-span-2">
                  <label htmlFor={`${pkg.id}-description`} className="block text-sm font-semibold text-soil-700">
                    Description
                  </label>
                  <textarea
                    id={`${pkg.id}-description`}
                    value={draft.description}
                    rows={3}
                    onChange={(e) => updateDraft(pkg.id, { description: e.target.value })}
                    className="w-full rounded-xl border border-field-dark bg-panel px-3 py-2.5 text-base outline-none focus:border-pasture-600 focus:ring-2 focus:ring-pasture-100 sm:text-sm"
                  />
                </div>
                {PACKAGE_LIMITS.map((field) => (
                  <Input
                    key={field.limit}
                    label={field.label}
                    inputMode="numeric"
                    placeholder="Unlimited"
                    value={draft.limits[field.limit]}
                    onChange={(e) => updateLimit(pkg.id, field.limit, e.target.value)}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs text-soil-500">Blank limit fields mean unlimited.</p>
            </Card>
          )
        })
      )}
    </div>
  )
}
