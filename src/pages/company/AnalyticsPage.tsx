import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useOfflineRead } from '../../contexts/OfflineContext'
import { errorText } from '../../lib/offlineHerd'
import { fetchFarmSnapshot } from '../../lib/farmSnapshot'
import {
  analyticsYears,
  buildAnalytics,
  type AnalyticsPeriod,
  type CountRow,
} from '../../lib/analytics'
import { Card, StatCard } from '../../components/ui/Card'
import { Select } from '../../components/ui/Select'
import { EmptyState, PageHeader } from '../../components/layout/AppShell'

function BarList({
  rows,
  total,
  tone = 'pasture',
  showShare = true,
}: {
  rows: CountRow[]
  total?: number
  tone?: 'pasture' | 'barn'
  showShare?: boolean
}) {
  const max = Math.max(1, ...rows.map((row) => row.count))
  const sum = total ?? rows.reduce((count, row) => count + row.count, 0)
  const barClass = tone === 'barn' ? 'bg-barn-500' : 'bg-pasture-600'

  return (
    <ul className="mt-4 space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-soil-700">{row.label}</span>
            <span className="shrink-0 font-semibold text-pasture-900">
              {row.count}
              {showShare && sum > 0 && row.count > 0 && (
                <span className="ml-1.5 text-xs font-medium text-soil-500">
                  {Math.round((row.count / sum) * 100)}%
                </span>
              )}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-field-dark/70">
            <div
              className={`h-full rounded-full ${barClass}`}
              style={{ width: row.count === 0 ? '0%' : `${Math.max(6, (row.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Breakdown({
  title,
  description,
  rows,
  tone = 'pasture',
  empty,
  showShare = true,
}: {
  title: string
  description?: string
  rows: CountRow[]
  tone?: 'pasture' | 'barn'
  empty: string
  showShare?: boolean
}) {
  const visible = rows.some((row) => row.count > 0)
  return (
    <Card>
      <h3 className="font-display font-semibold text-pasture-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-soil-500">{description}</p>}
      {visible ? <BarList rows={rows} tone={tone} showShare={showShare} /> : <EmptyState>{empty}</EmptyState>}
    </Card>
  )
}

function hasCounts(rows: CountRow[]) {
  return rows.some((row) => row.count > 0)
}

export function AnalyticsPage() {
  const { profile } = useAuth()
  const { ready, read, cacheKey } = useOfflineRead()
  const [input, setInput] = useState({
    animals: [] as Awaited<ReturnType<typeof fetchFarmSnapshot>>['animals'],
    breedingEvents: [] as Awaited<ReturnType<typeof fetchFarmSnapshot>>['breedingEvents'],
    inoculations: [] as Awaited<ReturnType<typeof fetchFarmSnapshot>>['inoculations'],
    weights: [] as Awaited<ReturnType<typeof fetchFarmSnapshot>>['weights'],
    achievements: [] as Awaited<ReturnType<typeof fetchFarmSnapshot>>['achievements'],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState<AnalyticsPeriod>(() => new Date().getFullYear())

  useEffect(() => {
    if (!profile?.company_id || !ready) return
    const companyId = profile.company_id
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await read(
          (saved) => ({
            animals: saved.animals,
            breedingEvents: saved.breedingEvents,
            inoculations: saved.inoculations,
            weights: saved.weights,
            achievements: saved.achievements,
          }),
          async () => {
            const snapshot = await fetchFarmSnapshot(companyId)
            return {
              animals: snapshot.animals,
              breedingEvents: snapshot.breedingEvents,
              inoculations: snapshot.inoculations,
              weights: snapshot.weights,
              achievements: snapshot.achievements,
            }
          },
        )
        if (!cancelled) setInput(data)
      } catch (err) {
        if (!cancelled) setError(errorText(err, 'Failed to load analytics'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [profile?.company_id, ready, cacheKey, read])

  const years = useMemo(() => analyticsYears(input), [input])
  const report = useMemo(() => buildAnalytics(input, period), [input, period])

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Analytics"
          description="Herd makeup is the herd today. Births, sales, breeding, health, weights, and shows follow the period."
        />
        <div className="w-full sm:w-48">
          <Select
            label="Period"
            value={String(period)}
            onChange={(event) => {
              const value = event.target.value
              setPeriod(value === 'all' ? 'all' : Number(value))
            }}
          >
            <option value="all">All time</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <EmptyState>Loading analytics...</EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <StatCard label="Active herd" value={report.active} />
            <StatCard label="Females" value={report.females} />
            <StatCard label="Males" value={report.males} />
            <StatCard label="Parents linked" value={report.parentsLinked} />
            <StatCard label={`Births · ${report.periodLabel}`} value={report.births} />
            <StatCard label="Pregnant now" value={report.pregnant} accent="barn" />
            <StatCard label={`Sold · ${report.periodLabel}`} value={report.sold} accent="barn" />
            <StatCard label={`Sale total · ${report.periodLabel}`} value={report.saleTotalLabel} accent="barn" />
          </div>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-semibold text-pasture-900">Herd</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Breakdown title="Species" rows={report.species} empty="No active animals yet." />
              <Breakdown title="Breed" rows={report.breeds} empty="No active animals yet." />
              <Breakdown title="Sex" rows={report.sexes} empty="No active animals yet." />
              <Breakdown title="Age" description="From birth dates on active animals." rows={report.ages} empty="No active animals yet." />
              <Breakdown title="Status" description="Every animal record, including animals that have left the herd." rows={report.statuses} empty="No animal records yet." />
              <Breakdown title="Camp" description="Where active animals are standing." rows={report.places} empty="No active animals yet." />
              {report.selections.length > 0 && (
                <Breakdown title="Selection" rows={report.selections} empty="No selection recorded." />
              )}
              {report.schedules.length > 0 && (
                <Breakdown title="Studbook schedule" rows={report.schedules} empty="No schedule recorded." />
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-semibold text-pasture-900">Breeding and births</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <h3 className="font-display font-semibold text-pasture-900">Services · {report.periodLabel}</h3>
                <p className="mt-1 text-sm text-soil-500">
                  Success is pregnant or born, among services that are no longer open.
                </p>
                <dl className="mt-4 grid grid-cols-3 gap-3">
                  <div>
                    <dt className="text-sm text-soil-500">Services</dt>
                    <dd className="font-display text-2xl font-bold text-pasture-900">{report.services}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-soil-500">Success</dt>
                    <dd className="font-display text-2xl font-bold text-pasture-900">{report.breedingSuccessLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-soil-500">Litter</dt>
                    <dd className="font-display text-2xl font-bold text-pasture-900">{report.averageLitterLabel}</dd>
                  </div>
                </dl>
                {hasCounts(report.breedingOutcomes) ? (
                  <BarList rows={report.breedingOutcomes} />
                ) : (
                  <EmptyState>No breeding records in this period.</EmptyState>
                )}
              </Card>

              <Breakdown
                title={report.birthsByPeriodMode === 'month' ? `Births by month · ${report.periodLabel}` : 'Births by year'}
                description="Animals with a birth date in the period."
                rows={report.birthsByPeriod}
                empty="No births recorded in this period."
                showShare={false}
              />

              <Breakdown title="Sex of births" rows={report.birthSexes} empty="No births recorded in this period." />

              <Card>
                <h3 className="font-display font-semibold text-pasture-900">Dams with the most offspring</h3>
                <p className="mt-1 text-sm text-soil-500">Offspring recorded in this period.</p>
                {report.topDams.length === 0 ? (
                  <EmptyState>No offspring linked to a dam in this period.</EmptyState>
                ) : (
                  <ul className="mt-4 divide-y divide-field-dark/70">
                    {report.topDams.map((dam) => (
                      <li key={dam.animalId}>
                        <Link
                          to={`/app/animals/${dam.animalId}`}
                          className="flex items-center justify-between gap-3 py-2.5 text-sm transition hover:text-pasture-800"
                        >
                          <span className="font-semibold text-soil-800">{dam.label}</span>
                          <span className="text-pasture-900">{dam.count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-semibold text-pasture-900">Sales</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <h3 className="font-display font-semibold text-pasture-900">Sale value · {report.periodLabel}</h3>
                <p className="mt-1 text-sm text-soil-500">
                  {report.pricedSales} of {report.sold} sold {report.sold === 1 ? 'animal has' : 'animals have'} a price.
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-sm text-soil-500">Total</dt>
                    <dd className="font-display text-2xl font-bold text-pasture-900">{report.saleTotalLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-soil-500">Average</dt>
                    <dd className="font-display text-2xl font-bold text-pasture-900">{report.saleAverageLabel}</dd>
                  </div>
                </dl>
              </Card>
              <Breakdown
                title={report.salesByPeriodMode === 'month' ? `Sales by month · ${report.periodLabel}` : 'Sales by year'}
                description="Uses the date the animal was sold."
                rows={report.salesByPeriod}
                tone="barn"
                empty="No dated sales in this period."
                showShare={false}
              />
              <Breakdown title="Buyers" rows={report.buyers} tone="barn" empty="No sales in this period." />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-semibold text-pasture-900">Health and weights</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <h3 className="font-display font-semibold text-pasture-900">Treatments · {report.periodLabel}</h3>
                <p className="mt-1 text-sm text-soil-500">Overdue is whatever is late today, not limited to the period.</p>
                <dl className="mt-4 grid grid-cols-3 gap-3">
                  <div>
                    <dt className="text-sm text-soil-500">Vaccinations</dt>
                    <dd className="font-display text-2xl font-bold text-pasture-900">{report.vaccinations}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-soil-500">Treatments</dt>
                    <dd className="font-display text-2xl font-bold text-pasture-900">{report.treatments}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-soil-500">Overdue</dt>
                    <dd className="font-display text-2xl font-bold text-pasture-900">{report.overdueHealth}</dd>
                  </div>
                </dl>
                {hasCounts(report.healthNames) ? (
                  <BarList rows={report.healthNames} />
                ) : (
                  <EmptyState>No vaccinations or treatments in this period.</EmptyState>
                )}
              </Card>

              <Card>
                <h3 className="font-display font-semibold text-pasture-900">Weights</h3>
                <p className="mt-1 text-sm text-soil-500">
                  Averages use the latest weight of each active animal. Weigh-ins follow this period.
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <dt className="text-sm text-soil-500">Weighed</dt>
                    <dd className="font-display text-2xl font-bold text-pasture-900">{report.weighedAnimals}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-soil-500">Average</dt>
                    <dd className="font-display text-2xl font-bold text-pasture-900">{report.averageWeightLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-soil-500">Females</dt>
                    <dd className="font-display text-2xl font-bold text-pasture-900">{report.femaleWeightLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-soil-500">Males</dt>
                    <dd className="font-display text-2xl font-bold text-pasture-900">{report.maleWeightLabel}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-sm text-soil-600">
                  {report.weighIns} weigh-in{report.weighIns === 1 ? '' : 's'} in this period.
                </p>
              </Card>
            </div>
          </section>

          {report.shows > 0 && (
            <section className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-pasture-900">Shows</h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <h3 className="font-display font-semibold text-pasture-900">Results · {report.periodLabel}</h3>
                  <p className="mt-4 font-display text-2xl font-bold text-pasture-900">{report.shows}</p>
                  <p className="text-sm text-soil-500">Show entries recorded.</p>
                </Card>
                <Breakdown title="Placings" rows={report.showResults} empty="No show results in this period." />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
