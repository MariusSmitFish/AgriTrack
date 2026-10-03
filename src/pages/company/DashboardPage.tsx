import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Animal, AnimalInoculation, BreedingEvent } from '../../lib/types'
import { animalLabel } from '../../lib/animals'
import { formatInoculationDate } from '../../lib/inoculations'
import { fetchCompanyInoculations } from '../../lib/inoculations'
import { fetchCompanyBreedingEvents, formatBreedingOutcome } from '../../lib/breeding'
import {
  buildInoculationAlerts,
  computeCampHeadcounts,
  computeHerdStats,
} from '../../lib/herdInsights'
import { mixedSpeciesBirthLabels } from '../../lib/speciesTerms'
import { exportCsv } from '../../lib/exportCsv'
import { Card, ActionLink, StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { EmptyState, PageHeader } from '../../components/layout/AppShell'

export function CompanyDashboardPage() {
  const { profile } = useAuth()
  const [animals, setAnimals] = useState<Animal[]>([])
  const [inoculations, setInoculations] = useState<AnimalInoculation[]>([])
  const [breedingEvents, setBreedingEvents] = useState<BreedingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!profile?.company_id) return
      setLoading(true)
      setError('')
      try {
        const [animalsRes, inoculationsData, breedingData] = await Promise.all([
          supabase
            .from('animals')
            .select('*, encampments(id, name, location_id, locations(id, name))')
            .eq('company_id', profile.company_id)
            .order('created_at', { ascending: false }),
          fetchCompanyInoculations(profile.company_id),
          fetchCompanyBreedingEvents(profile.company_id),
        ])

        if (animalsRes.error) throw animalsRes.error
        setAnimals(animalsRes.data ?? [])
        setInoculations(inoculationsData)
        setBreedingEvents(breedingData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [profile?.company_id])

  const stats = useMemo(() => computeHerdStats(animals), [animals])
  const campCounts = useMemo(() => computeCampHeadcounts(animals), [animals])
  const { overdue, upcoming } = useMemo(
    () => buildInoculationAlerts(inoculations, animals, 30),
    [inoculations, animals],
  )

  const birthAlerts = useMemo(() => {
    const today = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
    const horizonDate = new Date(today)
    horizonDate.setDate(horizonDate.getDate() + 60)
    const horizon = `${horizonDate.getFullYear()}-${pad(horizonDate.getMonth() + 1)}-${pad(horizonDate.getDate())}`

    const open = breedingEvents.filter(
      (e) =>
        e.expected_calving_at &&
        (e.outcome === 'open' || e.outcome === 'pregnant'),
    )

    const overdueBirths = open
      .filter((e) => e.expected_calving_at! < todayStr)
      .sort((a, b) => a.expected_calving_at!.localeCompare(b.expected_calving_at!))

    const upcomingBirths = open
      .filter((e) => e.expected_calving_at! >= todayStr && e.expected_calving_at! <= horizon)
      .sort((a, b) => a.expected_calving_at!.localeCompare(b.expected_calving_at!))

    return { overdueBirths, upcomingBirths }
  }, [breedingEvents])

  const animalById = (id: string) => animals.find((a) => a.id === id)

  const animalName = (id: string) => {
    const animal = animalById(id)
    return animal ? animalLabel(animal) : 'Unknown'
  }

  const exportHealthCsv = () => {
    const rows = [...overdue, ...upcoming].map((alert) => [
      alert.animalLabel,
      alert.name,
      alert.nextDueAt,
      alert.overdue ? 'Overdue' : 'Upcoming',
    ])
    exportCsv(
      'inoculation-alerts.csv',
      ['Animal', 'Inoculation', 'Next due', 'Status'],
      rows,
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Welcome back"
        description={
          profile?.full_name
            ? `Good to see you, ${profile.full_name}.`
            : 'Manage your herd and farm from here.'
        }
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <EmptyState>Loading herd overview...</EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 sm:gap-4">
            <StatCard label="Active herd" value={stats.active} />
            <StatCard label="Females" value={stats.females} />
            <StatCard label="Males" value={stats.males} />
            <StatCard label="Parents linked" value={stats.withParentsLinked} />
            <StatCard label="No camp" value={stats.unassignedCamp} accent="barn" />
            <StatCard label="All records" value={stats.total} accent="barn" />
          </div>

          <Card>
            <h3 className="font-display font-semibold text-pasture-900">Quick actions</h3>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
              <ActionLink to="/app/animals/new">Capture animal</ActionLink>
              <ActionLink to="/app/breeding">Breeding</ActionLink>
              <ActionLink to="/app/family-trees">Family trees</ActionLink>
              <ActionLink to="/app/locations">Locations</ActionLink>
              {profile?.role === 'company_admin' && (
                <ActionLink to="/app/users">Manage farm team</ActionLink>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card tone={overdue.length > 0 ? 'muted' : 'default'}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display font-semibold text-pasture-900">Health alerts</h3>
                  <p className="mt-1 text-sm text-soil-500">
                    Overdue and due within 30 days.
                  </p>
                </div>
                {(overdue.length > 0 || upcoming.length > 0) && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="px-3 py-1.5 text-xs"
                    onClick={exportHealthCsv}
                  >
                    Export CSV
                  </Button>
                )}
              </div>

              {overdue.length === 0 && upcoming.length === 0 ? (
                <EmptyState>No upcoming or overdue inoculations.</EmptyState>
              ) : (
                <ul className="mt-4 space-y-2">
                  {overdue.slice(0, 8).map((alert) => (
                    <li key={alert.id}>
                      <Link
                        to={`/app/animals/${alert.animalId}`}
                        className="block rounded-xl border border-barn-500/40 bg-barn-100/40 px-3 py-2.5 transition hover:bg-barn-100"
                      >
                        <p className="text-sm font-semibold text-soil-800">
                          {alert.animalLabel}
                          <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-barn-800">
                            Overdue
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-soil-600">
                          {alert.name} · due {formatInoculationDate(alert.nextDueAt)}
                        </p>
                      </Link>
                    </li>
                  ))}
                  {upcoming.slice(0, 8).map((alert) => (
                    <li key={alert.id}>
                      <Link
                        to={`/app/animals/${alert.animalId}`}
                        className="block rounded-xl border border-field-dark bg-panel-muted px-3 py-2.5 transition hover:bg-pasture-50"
                      >
                        <p className="text-sm font-semibold text-soil-800">{alert.animalLabel}</p>
                        <p className="mt-0.5 text-xs text-soil-600">
                          {alert.name} · due {formatInoculationDate(alert.nextDueAt)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display font-semibold text-pasture-900">
                    {mixedSpeciesBirthLabels.outlookTitle}
                  </h3>
                  <p className="mt-1 text-sm text-soil-500">
                    {mixedSpeciesBirthLabels.outlookDescription}
                  </p>
                </div>
                <ActionLink to="/app/breeding" className="!py-1.5 text-xs">
                  Open breeding
                </ActionLink>
              </div>

              {birthAlerts.overdueBirths.length === 0 &&
              birthAlerts.upcomingBirths.length === 0 ? (
                <EmptyState>{mixedSpeciesBirthLabels.emptyUpcoming}</EmptyState>
              ) : (
                <ul className="mt-4 space-y-2">
                  {birthAlerts.overdueBirths.slice(0, 6).map((event) => (
                    <li key={event.id}>
                      <Link
                        to={`/app/animals/${event.dam_id}`}
                        className="block rounded-xl border border-barn-500/40 bg-barn-100/40 px-3 py-2.5 transition hover:bg-barn-100"
                      >
                        <p className="text-sm font-semibold text-soil-800">
                          {animalName(event.dam_id)}
                          <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-barn-800">
                            Overdue
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-soil-600">
                          Expected {formatInoculationDate(event.expected_calving_at)} ·{' '}
                          {formatBreedingOutcome(
                            event.outcome,
                            animalById(event.dam_id)?.species,
                          )}
                        </p>
                      </Link>
                    </li>
                  ))}
                  {birthAlerts.upcomingBirths.slice(0, 6).map((event) => (
                    <li key={event.id}>
                      <Link
                        to={`/app/animals/${event.dam_id}`}
                        className="block rounded-xl border border-field-dark bg-panel-muted px-3 py-2.5 transition hover:bg-pasture-50"
                      >
                        <p className="text-sm font-semibold text-soil-800">
                          {animalName(event.dam_id)}
                        </p>
                        <p className="mt-0.5 text-xs text-soil-600">
                          Expected {formatInoculationDate(event.expected_calving_at)} ·{' '}
                          {formatBreedingOutcome(
                            event.outcome,
                            animalById(event.dam_id)?.species,
                          )}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {campCounts.length > 0 && (
            <Card>
              <h3 className="font-display font-semibold text-pasture-900">Headcount by place</h3>
              <p className="mt-1 text-sm text-soil-500">Active animals by location / encampment.</p>
              <ul className="mt-4 divide-y divide-field-dark/70">
                {campCounts.map((row) => (
                  <li
                    key={row.key}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span className="text-soil-700">{row.label}</span>
                    <span className="font-semibold text-pasture-900">{row.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
