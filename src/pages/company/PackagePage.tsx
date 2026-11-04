import { useEffect, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { EmptyState, PageHeader } from '../../components/layout/AppShell'
import {
  PACKAGE_LIMITS,
  fetchCompanyPlan,
  formatLimit,
  formatPackagePrice,
  limitReached,
  type CompanyPlan,
} from '../../lib/packages'

export function PackagePage() {
  const [plan, setPlan] = useState<CompanyPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const next = await fetchCompanyPlan()
        if (!cancelled) setPlan(next)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load your package'
        const missingSetup =
          message.includes('company_plan_usage') || message.toLowerCase().includes('schema cache')
        if (!cancelled) {
          setError(
            missingSetup
              ? 'Packages are not set up on the database yet. A super admin needs to apply the packages migration.'
              : message,
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const pkg = plan?.package

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Your package"
        description="What this farm is on, and how much of each limit you have used."
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <EmptyState>Loading package...</EmptyState>
      ) : error ? null : !plan || !pkg ? (
        <Card>
          <p className="text-sm text-soil-600">
            This farm does not have a package yet. A super admin can assign one from Farms.
          </p>
        </Card>
      ) : (
        <>
          <Card tone="accent">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pasture-700">
              Current package
            </p>
            <h3 className="mt-2 font-display text-2xl font-bold text-pasture-900">{pkg.name}</h3>
            {pkg.description && <p className="mt-2 max-w-2xl text-sm text-soil-700">{pkg.description}</p>}
            <p className="mt-4 text-sm font-semibold text-pasture-900">
              {formatPackagePrice(pkg.yearly_price, pkg.currency)}
            </p>
            <p className="mt-2 text-sm text-soil-600">
              A super admin assigns the package. Health records, weights, breeding, and show results are not
              capped on their own — they follow the animals you already keep.
            </p>
          </Card>

          <Card>
            <h3 className="font-display font-semibold text-pasture-900">Limits</h3>
            <ul className="mt-4 space-y-5">
              {PACKAGE_LIMITS.map((field) => {
                const max = pkg[field.limit]
                const used = plan.usage[field.usage] ?? 0
                const unlimited = max == null
                const full = limitReached(used, max)
                const over = max != null && used > max
                const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(max, 1)) * 100))

                return (
                  <li key={field.limit}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-semibold text-soil-800">{field.label}</p>
                      <p className={`text-sm font-semibold ${full ? 'text-barn-800' : 'text-pasture-800'}`}>
                        {unlimited ? `${used} · Unlimited` : `${used} of ${formatLimit(max)}`}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-soil-500">{field.hint}</p>
                    {!unlimited && (
                      <div
                        className="mt-2 h-2 overflow-hidden rounded-full bg-field-dark"
                        role="progressbar"
                        aria-label={field.label}
                        aria-valuemin={0}
                        aria-valuemax={max}
                        aria-valuenow={Math.min(used, max)}
                      >
                        <div
                          className={`h-full rounded-full ${full ? 'bg-barn-500' : 'bg-pasture-600'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                    {over && (
                      <p className="mt-1 text-xs font-medium text-barn-800">
                        Over the limit. Existing records stay. New ones are blocked until the count drops or the
                        package changes.
                      </p>
                    )}
                    {full && !over && (
                      <p className="mt-1 text-xs font-medium text-barn-800">
                        Limit reached. New {field.label.toLowerCase()} are blocked.
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}
