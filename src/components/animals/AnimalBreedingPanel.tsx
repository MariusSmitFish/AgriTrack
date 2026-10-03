import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Animal, BreedingEvent, BreedingEventFormData } from '../../lib/types'
import { animalLabel, animalOptionLabel } from '../../lib/animals'
import { formatInoculationDate } from '../../lib/inoculations'
import {
  breedingOutcomeOptionsForSpecies,
  createBreedingEvent,
  deleteBreedingEvent,
  emptyBreedingForm,
  fetchAnimalBreedingEvents,
  formatBreedingOutcome,
  isBirthOverdue,
} from '../../lib/breeding'
import { addDaysToDateValue } from '../../lib/herdInsights'
import {
  expectedBirthLabel,
  gestationDaysForSpecies,
  offspringNoun,
} from '../../lib/speciesTerms'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Card } from '../ui/Card'
import { EmptyState } from '../layout/AppShell'

interface AnimalBreedingPanelProps {
  animal: Animal
  companyId: string
  userId: string
  herdAnimals: Animal[]
}

export function AnimalBreedingPanel({
  animal,
  companyId,
  userId,
  herdAnimals,
}: AnimalBreedingPanelProps) {
  const species = animal.species
  const gestation = gestationDaysForSpecies(species)
  const outcomeOptions = breedingOutcomeOptionsForSpecies(species)
  const youngLabel = offspringNoun(species)

  const [events, setEvents] = useState<BreedingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState<BreedingEventFormData>(() =>
    emptyBreedingForm(
      {
        dam_id: animal.sex === 'male' ? '' : animal.id,
        sire_id: animal.sex === 'male' ? animal.id : '',
      },
      species,
    ),
  )

  const canBeDam = animal.sex !== 'male'
  const labelFor = (id: string | null) => {
    if (!id) return '—'
    if (id === animal.id) return animalLabel(animal)
    const found = herdAnimals.find((a) => a.id === id)
    return found ? animalLabel(found) : '—'
  }

  const speciesFor = (id: string | null) => {
    if (!id) return null
    if (id === animal.id) return animal.species
    return herdAnimals.find((a) => a.id === id)?.species ?? null
  }

  const sires = useMemo(
    () =>
      herdAnimals.filter(
        (a) => a.id !== animal.id && (a.sex === 'male' || a.sex === 'unknown' || !a.sex),
      ),
    [herdAnimals, animal.id],
  )

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setEvents(await fetchAnimalBreedingEvents(animal.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load breeding events')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [animal.id])

  const set = <K extends keyof BreedingEventFormData>(key: K, value: BreedingEventFormData[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'served_at' && typeof value === 'string' && value) {
        next.expected_calving_at = addDaysToDateValue(value, gestation)
      }
      return next
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canBeDam) {
      setError('Breeding events are logged against the dam. Open the dam’s record to add one.')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const created = await createBreedingEvent({
        companyId,
        userId,
        form: { ...form, dam_id: animal.id },
        species,
      })
      setEvents((prev) => [created, ...prev])
      setForm(
        emptyBreedingForm(
          {
            dam_id: animal.id,
            sire_id: '',
          },
          species,
        ),
      )
      setSuccess('Breeding event recorded.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (event: BreedingEvent) => {
    if (!window.confirm('Delete this breeding event?')) return
    try {
      await deleteBreedingEvent(event.id)
      setEvents((prev) => prev.filter((e) => e.id !== event.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-semibold text-pasture-900">Breeding</h3>
          <p className="mt-1 text-sm text-soil-500">
            Services and {expectedBirthLabel(species).toLowerCase()} dates for this animal.
          </p>
        </div>
        <p className="text-sm font-semibold text-soil-600">{events.length}</p>
      </div>

      {canBeDam && (
        <form
          onSubmit={handleSubmit}
          className="section-inset mt-4 grid grid-cols-1 gap-4 rounded-2xl p-4 md:grid-cols-2"
        >
          <Select
            label="Sire"
            id={`animal-breeding-sire-${animal.id}`}
            value={form.sire_id}
            onChange={(e) => set('sire_id', e.target.value)}
          >
            <option value="">Not linked</option>
            {sires.map((sire) => (
              <option key={sire.id} value={sire.id}>
                {animalOptionLabel(sire)}
              </option>
            ))}
          </Select>
          <Select
            label="Outcome"
            id={`animal-breeding-outcome-${animal.id}`}
            value={form.outcome}
            onChange={(e) => set('outcome', e.target.value as BreedingEventFormData['outcome'])}
          >
            {outcomeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Input
            label="Served date"
            type="date"
            value={form.served_at}
            onChange={(e) => set('served_at', e.target.value)}
            required
          />
          <Input
            label={`${expectedBirthLabel(species)} (~${gestation} days)`}
            type="date"
            value={form.expected_calving_at}
            onChange={(e) => set('expected_calving_at', e.target.value)}
          />
          <div className="md:col-span-2">
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? 'Saving...' : 'Log service'}
            </Button>
          </div>
        </form>
      )}

      {!canBeDam && (
        <p className="mt-4 text-sm text-soil-500">
          This animal is recorded as male. Breeding events appear here when he is used as a sire;
          log new services from the dam’s page or Breeding.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-3 text-sm text-pasture-800">{success}</p>}

      {loading ? (
        <EmptyState>Loading breeding history...</EmptyState>
      ) : events.length === 0 ? (
        <EmptyState>No breeding events yet.</EmptyState>
      ) : (
        <ul className="mt-4 space-y-2">
          {events.map((event) => {
            const damSpecies = speciesFor(event.dam_id)
            return (
              <li
                key={event.id}
                className="rounded-xl border border-field-dark bg-panel-muted px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-soil-800">
                      Dam {labelFor(event.dam_id)}
                      {event.sire_id ? ` · Sire ${labelFor(event.sire_id)}` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-soil-600">
                      Served {formatInoculationDate(event.served_at)}
                      {event.expected_calving_at
                        ? ` · Expected ${formatInoculationDate(event.expected_calving_at)}${
                            isBirthOverdue(event.expected_calving_at, event.outcome)
                              ? ' (overdue)'
                              : ''
                          }`
                        : ''}
                      {' · '}
                      {formatBreedingOutcome(event.outcome, damSpecies)}
                    </p>
                  </div>
                  {event.dam_id === animal.id && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-700"
                      onClick={() => handleDelete(event)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {canBeDam && events.some((e) => e.calf_id) && (
        <p className="mt-3 text-xs text-soil-500">
          Linked {youngLabel} records show on the full Breeding page.
        </p>
      )}
    </Card>
  )
}
