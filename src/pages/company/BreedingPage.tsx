import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Animal, BreedingEvent, BreedingEventFormData } from '../../lib/types'
import { animalLabel, animalOptionLabel, formatAnimalSex } from '../../lib/animals'
import { formatInoculationDate, todayDateValue } from '../../lib/inoculations'
import {
  breedingEventToForm,
  breedingOutcomeOptionsForSpecies,
  createBreedingEvent,
  deleteBreedingEvent,
  emptyBreedingForm,
  fetchCompanyBreedingEvents,
  formatBreedingOutcome,
  isBirthOverdue,
  updateBreedingEvent,
} from '../../lib/breeding'
import { addDaysToDateValue } from '../../lib/herdInsights'
import {
  expectedBirthLabel,
  gestationDaysForSpecies,
  mixedSpeciesBirthLabels,
  offspringNoun,
} from '../../lib/speciesTerms'
import { filterBySearch } from '../../lib/search'
import { useClientPagination } from '../../lib/pagination'
import { exportCsv } from '../../lib/exportCsv'
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

type FilterMode = 'all' | 'upcoming' | 'overdue'

export function BreedingPage() {
  const { profile } = useAuth()
  const [animals, setAnimals] = useState<Animal[]>([])
  const [events, setEvents] = useState<BreedingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState<BreedingEventFormData>(() => emptyBreedingForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')
  const deferredQuery = useDeferredValue(query)

  const load = async () => {
    if (!profile?.company_id) return
    setLoading(true)
    setError('')
    try {
      const [animalsRes, breedingData] = await Promise.all([
        supabase
          .from('animals')
          .select('*')
          .eq('company_id', profile.company_id)
          .order('tag_number', { ascending: true }),
        fetchCompanyBreedingEvents(profile.company_id),
      ])
      if (animalsRes.error) throw animalsRes.error
      setAnimals(animalsRes.data ?? [])
      setEvents(breedingData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load breeding data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [profile?.company_id])

  const dams = useMemo(
    () => animals.filter((a) => a.sex === 'female' || a.sex === 'unknown' || !a.sex),
    [animals],
  )
  const sires = useMemo(
    () => animals.filter((a) => a.sex === 'male' || a.sex === 'unknown' || !a.sex),
    [animals],
  )

  const animalById = (id: string | null) => (id ? animals.find((a) => a.id === id) ?? null : null)

  const labelFor = (id: string | null) => {
    const animal = animalById(id)
    return animal ? animalLabel(animal) : id ? '—' : '—'
  }

  const offspringIdsFor = (event: BreedingEvent) =>
    event.offspring_ids?.length ? event.offspring_ids : event.calf_id ? [event.calf_id] : []

  const offspringLabel = (event: BreedingEvent) => {
    const labels = offspringIdsFor(event).map((id) => labelFor(id))
    return labels.length > 0 ? labels.join(', ') : ''
  }

  const speciesForDam = (damId: string | null) => animalById(damId)?.species ?? null

  const selectedDamSpecies = speciesForDam(form.dam_id)
  const selectedGestation = gestationDaysForSpecies(selectedDamSpecies)
  const outcomeOptions = breedingOutcomeOptionsForSpecies(selectedDamSpecies)

  const today = todayDateValue()
  const horizon = addDaysToDateValue(today, 60)

  const filteredEvents = useMemo(() => {
    let list = events

    if (filter === 'overdue') {
      list = list.filter((e) => isBirthOverdue(e.expected_calving_at, e.outcome))
    } else if (filter === 'upcoming') {
      list = list.filter(
        (e) =>
          e.expected_calving_at &&
          (e.outcome === 'open' || e.outcome === 'pregnant') &&
          e.expected_calving_at >= today &&
          e.expected_calving_at <= horizon,
      )
    }

    return filterBySearch(list, deferredQuery, (event) => [
      labelFor(event.dam_id),
      labelFor(event.sire_id),
      formatBreedingOutcome(event.outcome, speciesForDam(event.dam_id)),
      formatInoculationDate(event.served_at),
      formatInoculationDate(event.expected_calving_at),
      offspringLabel(event),
      event.notes,
    ])
  }, [events, filter, deferredQuery, animals, today, horizon])

  const {
    pageItems: pagedEvents,
    page,
    setPage,
    totalPages,
    totalItems,
    start,
    end,
  } = useClientPagination(filteredEvents, { resetKey: `${filter}:${deferredQuery}` })

  const set = <K extends keyof BreedingEventFormData>(key: K, value: BreedingEventFormData[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      const damSpecies =
        key === 'dam_id' && typeof value === 'string'
          ? speciesForDam(value)
          : speciesForDam(prev.dam_id)
      const gestation = gestationDaysForSpecies(damSpecies)

      if (key === 'served_at' && typeof value === 'string' && value) {
        next.expected_calving_at = addDaysToDateValue(value, gestation)
      }
      if (key === 'dam_id' && prev.served_at) {
        next.expected_calving_at = addDaysToDateValue(prev.served_at, gestation)
      }
      return next
    })
  }

  const resetForm = () => {
    setForm(emptyBreedingForm())
    setEditingId(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile?.company_id) return
    if (!form.dam_id) {
      setError('Select a dam.')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      if (editingId) {
        const updated = await updateBreedingEvent(editingId, form, selectedDamSpecies)
        setEvents((prev) => prev.map((ev) => (ev.id === editingId ? updated : ev)))
        setSuccess('Breeding event updated.')
      } else {
        const created = await createBreedingEvent({
          companyId: profile.company_id,
          userId: profile.id,
          form,
          species: selectedDamSpecies,
        })
        setEvents((prev) => [created, ...prev])
        setSuccess('Breeding event recorded.')
      }
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save breeding event')
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (event: BreedingEvent) => {
    setEditingId(event.id)
    setForm(breedingEventToForm(event))
    setSuccess('')
    setError('')
  }

  const handleDelete = async (event: BreedingEvent) => {
    if (!window.confirm(`Delete breeding record for ${labelFor(event.dam_id)}?`)) return
    try {
      await deleteBreedingEvent(event.id)
      setEvents((prev) => prev.filter((e) => e.id !== event.id))
      if (editingId === event.id) resetForm()
      setSuccess('Breeding event deleted.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const handleExport = () => {
    exportCsv(
      'breeding-events.csv',
      ['Dam', 'Sire', 'Mated', mixedSpeciesBirthLabels.expectedShort, 'Outcome', 'Offspring', 'Notes'],
      filteredEvents.map((event) => [
        labelFor(event.dam_id),
        labelFor(event.sire_id),
        event.served_at,
        event.expected_calving_at,
        formatBreedingOutcome(event.outcome, speciesForDam(event.dam_id)),
        offspringLabel(event),
        event.notes,
      ]),
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Breeding"
          description={mixedSpeciesBirthLabels.trackDescription}
        />
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link to="/app/births" className="block w-full sm:w-auto">
            <Button type="button" className="w-full sm:w-auto">
              Capture birth
            </Button>
          </Link>
          {filteredEvents.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={handleExport}
            >
              Export CSV
            </Button>
          )}
        </div>
      </div>

      <Card>
        <h3 className="font-display font-semibold text-pasture-900">
          {editingId ? 'Edit breeding event' : 'Log service'}
        </h3>
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="Dam (mother)"
            id="breeding-dam"
            value={form.dam_id}
            onChange={(e) => set('dam_id', e.target.value)}
            required
          >
            <option value="">Select dam</option>
            {dams.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animalOptionLabel(animal)}
              </option>
            ))}
          </Select>
          <Select
            label="Sire (father)"
            id="breeding-sire"
            value={form.sire_id}
            onChange={(e) => set('sire_id', e.target.value)}
          >
            <option value="">Not linked</option>
            {sires.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animalOptionLabel(animal)}
              </option>
            ))}
          </Select>
          <Input
            label="Mated date"
            type="date"
            value={form.served_at}
            onChange={(e) => set('served_at', e.target.value)}
            required
          />
          <Input
            label={`${expectedBirthLabel(selectedDamSpecies)} (~${selectedGestation} days)`}
            type="date"
            value={form.expected_calving_at}
            onChange={(e) => set('expected_calving_at', e.target.value)}
          />
          <Select
            label="Outcome"
            id="breeding-outcome"
            value={form.outcome}
            onChange={(e) => set('outcome', e.target.value as BreedingEventFormData['outcome'])}
          >
            {outcomeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Select
            label={`${offspringNoun(selectedDamSpecies).charAt(0).toUpperCase()}${offspringNoun(selectedDamSpecies).slice(1)} (if born)`}
            id="breeding-calf"
            value={form.calf_id}
            onChange={(e) => set('calf_id', e.target.value)}
          >
            <option value="">Not linked</option>
            {animals.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animalOptionLabel(animal)}
              </option>
            ))}
          </Select>
          <div className="md:col-span-2">
            <Input
              label="Notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="AI bull, natural service, ultrasound notes…"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? 'Saving...' : editingId ? 'Update event' : 'Save event'}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={resetForm}
              >
                Cancel edit
              </Button>
            )}
          </div>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-3 text-sm text-pasture-800">{success}</p>}
      </Card>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h3 className="font-display font-semibold text-pasture-900">Breeding calendar</h3>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['all', 'All'],
                ['upcoming', 'Next 60 days'],
                ['overdue', 'Overdue'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  filter === value
                    ? 'bg-pasture-700 text-white'
                    : 'border border-field-dark bg-panel-muted text-soil-700 hover:bg-pasture-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <EmptyState>Loading breeding events...</EmptyState>
        ) : events.length === 0 ? (
          <EmptyState>No breeding events yet. Log a service above.</EmptyState>
        ) : (
          <>
            <div className="mt-4">
              <SearchField
                id="breeding-search"
                value={query}
                onChange={setQuery}
                placeholder="Search dam, sire, outcome, notes…"
                resultCount={filteredEvents.length}
                totalCount={events.length}
              />
            </div>
            {filteredEvents.length === 0 ? (
              <EmptyState>No events match this filter.</EmptyState>
            ) : (
              <>
                <MobileCardList>
                  {pagedEvents.map((event) => (
                    <MobileCard
                      key={event.id}
                      title={labelFor(event.dam_id)}
                      subtitle={`Sire: ${labelFor(event.sire_id)}`}
                      fields={[
                        { label: 'Mated', value: formatInoculationDate(event.served_at) },
                        {
                          label: 'Expected',
                          value: event.expected_calving_at
                            ? `${formatInoculationDate(event.expected_calving_at)}${
                                isBirthOverdue(event.expected_calving_at, event.outcome)
                                  ? ' (overdue)'
                                  : ''
                              }`
                            : '—',
                        },
                        {
                          label: 'Outcome',
                          value: formatBreedingOutcome(
                            event.outcome,
                            speciesForDam(event.dam_id),
                          ),
                        },
                        ...(offspringLabel(event)
                          ? [{ label: 'Offspring', value: offspringLabel(event) }]
                          : []),
                      ]}
                      action={
                        <div className="flex flex-col items-end gap-1">
                          {(event.outcome === 'open' || event.outcome === 'pregnant') && (
                            <Link
                              to={`/app/births?event=${event.id}`}
                              className="text-xs font-semibold text-pasture-800"
                            >
                              Record birth
                            </Link>
                          )}
                          <Link
                            to={`/app/animals/${event.dam_id}`}
                            className="text-xs font-semibold text-pasture-800"
                          >
                            Dam
                          </Link>
                          <button
                            type="button"
                            className="text-xs font-semibold text-pasture-800"
                            onClick={() => startEdit(event)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-xs font-semibold text-red-700"
                            onClick={() => handleDelete(event)}
                          >
                            Delete
                          </button>
                        </div>
                      }
                    />
                  ))}
                </MobileCardList>

                <DesktopTable>
                  <thead>
                    <tr className="border-b border-field-dark text-soil-500">
                      <th className="pb-2 font-medium">Dam</th>
                      <th className="pb-2 font-medium">Sire</th>
                      <th className="pb-2 font-medium">Mated</th>
                      <th className="pb-2 font-medium">Expected</th>
                      <th className="pb-2 font-medium">Outcome</th>
                      <th className="pb-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedEvents.map((event) => (
                      <tr key={event.id} className="border-b border-field-dark/60">
                        <td className="py-3 font-medium text-soil-800">
                          <Link
                            to={`/app/animals/${event.dam_id}`}
                            className="hover:text-pasture-800"
                          >
                            {labelFor(event.dam_id)}
                          </Link>
                          <span className="mt-0.5 block text-xs font-normal text-soil-500">
                            {formatAnimalSex(
                              animals.find((a) => a.id === event.dam_id)?.sex ?? null,
                            )}
                          </span>
                        </td>
                        <td className="py-3 text-soil-600">{labelFor(event.sire_id)}</td>
                        <td className="py-3 text-soil-600">
                          {formatInoculationDate(event.served_at)}
                        </td>
                        <td className="py-3 text-soil-600">
                          {event.expected_calving_at ? (
                            <span
                              className={
                                isBirthOverdue(event.expected_calving_at, event.outcome)
                                  ? 'font-semibold text-barn-600'
                                  : undefined
                              }
                            >
                              {formatInoculationDate(event.expected_calving_at)}
                              {isBirthOverdue(event.expected_calving_at, event.outcome)
                                ? ' · overdue'
                                : ''}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 text-soil-600">
                          {formatBreedingOutcome(event.outcome, speciesForDam(event.dam_id))}
                          {offspringLabel(event) && (
                            <span className="mt-0.5 block text-xs text-soil-500">
                              {offspringLabel(event)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          {(event.outcome === 'open' || event.outcome === 'pregnant') && (
                            <Link
                              to={`/app/births?event=${event.id}`}
                              className="mr-3 font-semibold text-pasture-800 hover:text-pasture-700"
                            >
                              Record birth
                            </Link>
                          )}
                          <button
                            type="button"
                            className="mr-3 font-semibold text-pasture-800 hover:text-pasture-700"
                            onClick={() => startEdit(event)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="font-semibold text-red-700 hover:text-red-800"
                            onClick={() => handleDelete(event)}
                          >
                            Delete
                          </button>
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
