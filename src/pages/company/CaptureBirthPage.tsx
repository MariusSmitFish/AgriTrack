import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Animal, BreedingEvent } from '../../lib/types'
import { animalLabel, animalOptionLabel, digitsOnly, formatAnimalId, formatTagNumber, padDigits } from '../../lib/animals'
import { fetchCompanyBreedingEvents } from '../../lib/breeding'
import {
  birthYearPart,
  nextFreeIdNumber,
  openBreedingEvents,
  recordBirth,
  usedIdNumbers,
} from '../../lib/births'
import { fetchCompanyStudNumber } from '../../lib/companySettings'
import { formatInoculationDate, todayDateValue } from '../../lib/inoculations'
import { bornOutcomeLabel, offspringNoun } from '../../lib/speciesTerms'
import { ParentPicker } from '../../components/animals/ParentPicker'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/layout/AppShell'

interface KidRow {
  key: string
  number: string
  sex: '' | 'male' | 'female'
  touched: boolean
}

function newKid(number = ''): KidRow {
  return { key: crypto.randomUUID(), number, sex: '', touched: false }
}

export function CaptureBirthPage() {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const [animals, setAnimals] = useState<Animal[]>([])
  const [events, setEvents] = useState<BreedingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<Animal[]>([])
  const [damId, setDamId] = useState('')
  const [sireId, setSireId] = useState('')
  const [breedingEventId, setBreedingEventId] = useState('')
  const [birthDate, setBirthDate] = useState(todayDateValue)
  const [companyStud, setCompanyStud] = useState('')
  const [kids, setKids] = useState<KidRow[]>(() => [newKid()])
  const [appliedQuery, setAppliedQuery] = useState(false)

  const load = async (showLoading = false) => {
    if (!profile?.company_id) return
    if (showLoading) setLoading(true)
    setError('')
    try {
      const [animalsRes, breedingData, stud] = await Promise.all([
        supabase.from('animals').select('*').eq('company_id', profile.company_id),
        fetchCompanyBreedingEvents(profile.company_id),
        fetchCompanyStudNumber(profile.company_id),
      ])
      if (animalsRes.error) throw animalsRes.error
      setAnimals(animalsRes.data ?? [])
      setEvents(breedingData)
      setCompanyStud(stud)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load herd')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(true)
  }, [profile?.company_id])

  const dams = useMemo(
    () => animals.filter((animal) => animal.sex === 'female' || animal.sex === 'unknown' || !animal.sex),
    [animals],
  )
  const sires = useMemo(
    () => animals.filter((animal) => animal.sex === 'male' || animal.sex === 'unknown' || !animal.sex),
    [animals],
  )

  const dam = animals.find((animal) => animal.id === damId) ?? null
  const sire = animals.find((animal) => animal.id === sireId) ?? null
  const openEvents = damId ? openBreedingEvents(events, damId) : []
  const stud = companyStud
  const year = birthYearPart(birthDate)
  const young = offspringNoun(dam?.species, true)
  const bornLabel = bornOutcomeLabel(dam?.species)

  useEffect(() => {
    if (appliedQuery || loading) return
    const eventId = searchParams.get('event')
    const event = eventId ? events.find((item) => item.id === eventId) : null
    if (event) {
      setDamId(event.dam_id)
      if (event.sire_id) setSireId(event.sire_id)
      setBreedingEventId(event.id)
    }
    setAppliedQuery(true)
  }, [appliedQuery, loading, events, searchParams])

  useEffect(() => {
    if (!stud || !year) return
    setKids((prev) => {
      const used = usedIdNumbers(animals, stud, year)
      let changed = false
      const next = prev.map((kid) => {
        if (kid.touched) {
          const taken = Number.parseInt(padDigits(kid.number, 4), 10)
          if (kid.number && Number.isFinite(taken)) used.add(taken)
          return kid
        }
        const number = nextFreeIdNumber(used)
        if (number) used.add(Number.parseInt(number, 10))
        if (kid.number !== number) changed = true
        return number === kid.number ? kid : { ...kid, number }
      })
      return changed ? next : prev
    })
  }, [animals, stud, year])

  const selectDam = (id: string) => {
    setDamId(id)
    setCreated([])
    setError('')
    const open = openBreedingEvents(events, id)
    const matched = sireId ? open.find((event) => event.sire_id === sireId) : null
    const chosen = matched ?? (open.length === 1 ? open[0] : null)
    setBreedingEventId(chosen?.id ?? '')
    if (chosen?.sire_id) setSireId(chosen.sire_id)
  }

  const selectEvent = (id: string) => {
    setBreedingEventId(id)
    const event = events.find((item) => item.id === id)
    if (event?.sire_id) setSireId(event.sire_id)
  }

  const updateKid = (key: string, patch: Partial<KidRow>) => {
    setKids((prev) => prev.map((kid) => (kid.key === key ? { ...kid, ...patch } : kid)))
  }

  const addKid = () => {
    const used = usedIdNumbers(animals, stud, year)
    for (const kid of kids) {
      const taken = Number.parseInt(padDigits(kid.number, 4), 10)
      if (kid.number && Number.isFinite(taken)) used.add(taken)
    }
    setKids((prev) => [...prev, { ...newKid(nextFreeIdNumber(used)), touched: true }])
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile?.company_id || !dam || !sire) return
    const eventToUpdate =
      openEvents.find((event) => event.id === breedingEventId) ??
      (openEvents.length === 1 ? openEvents[0] : null)
    if (openEvents.length > 1 && !eventToUpdate) {
      setError('Choose which breeding record this birth updates.')
      return
    }
    if (kids.some((kid) => !kid.sex)) {
      setError('Choose male or female for each kid.')
      return
    }

    const numbers = kids.map((kid) => padDigits(kid.number, 4))
    if (numbers.some((number) => !/^\d{4}$/.test(number))) {
      setError('Each kid needs a number.')
      return
    }
    if (new Set(numbers).size !== numbers.length) {
      setError('Each kid needs a different number.')
      return
    }
    const used = usedIdNumbers(animals, stud, year)
    const clash = numbers.find((number) => used.has(Number.parseInt(number, 10)))
    if (clash) {
      setError(`Number ${clash} is already used for stud ${stud} in ${year}.`)
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const offspring = await recordBirth({
        companyId: profile.company_id,
        userId: profile.id,
        dam,
        sire,
        birthDate,
        studNumber: stud,
        kids: kids.map((kid) => ({ number: kid.number, sex: kid.sex as 'male' | 'female' })),
        breedingEvent: eventToUpdate,
      })
      setCreated(offspring)
      setAnimals((prev) => [...offspring, ...prev])
      setKids([newKid()])
      setBreedingEventId('')
      await load(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record the birth')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Capture birth"
        description="Choose the mother and father, then enter each new number. One birth date covers the whole delivery, and the breeding record is updated."
      />

      {loading ? (
        <Card>
          <p className="text-sm text-soil-500">Loading herd...</p>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <h3 className="font-display font-semibold text-pasture-900">Parents</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <ParentPicker
                id="birth-dam"
                label="Mother"
                animals={dams}
                selectedId={damId}
                onSelect={selectDam}
                enableTagScan
                placeholder="Search the mother’s animal ID or tag…"
              />
              <ParentPicker
                id="birth-sire"
                label="Father"
                animals={sires}
                selectedId={sireId}
                onSelect={(id) => {
                  setSireId(id)
                  setError('')
                }}
                enableTagScan
                placeholder="Search the father’s animal ID or tag…"
              />
            </div>

            {dam && openEvents.length > 0 && (
              <fieldset className="mt-4 space-y-2">
                <legend className="text-sm font-semibold text-soil-700">Breeding record</legend>
                {openEvents.map((event) => {
                  const eventSire = animals.find((animal) => animal.id === event.sire_id)
                  return (
                    <label
                      key={event.id}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-field-dark px-3 py-2.5"
                    >
                      <input
                        type="radio"
                        name="breeding-event"
                        className="mt-1"
                        checked={breedingEventId === event.id}
                        onChange={() => selectEvent(event.id)}
                      />
                      <span className="text-sm text-soil-700">
                        Mated {formatInoculationDate(event.served_at)}
                        {event.expected_calving_at
                          ? ` · expected ${formatInoculationDate(event.expected_calving_at)}`
                          : ''}
                        {eventSire ? ` · ${animalOptionLabel(eventSire)}` : ''}
                        <span className="mt-0.5 block text-xs text-soil-500">
                          This record will be marked {bornLabel.toLowerCase()}.
                        </span>
                      </span>
                    </label>
                  )
                })}
              </fieldset>
            )}

            {dam && openEvents.length === 0 && (
              <p className="mt-4 text-sm text-soil-500">
                No open breeding record for this mother. Saving will add one and mark it{' '}
                {bornLabel.toLowerCase()}.
              </p>
            )}
          </Card>

          <Card>
            <h3 className="font-display font-semibold text-pasture-900">
              {young.charAt(0).toUpperCase()}
              {young.slice(1)}
            </h3>
            <p className="mt-1 text-sm text-soil-500">
              The stud number comes from Configurations
              {stud ? ` (${stud})` : ''}. The year comes from the birth date. Enter the new number for
              each {offspringNoun(dam?.species)}. Animal ID is stud–year–number, and the tag is year–number.
            </p>
            {!stud && (
              <p className="mt-3 text-sm text-soil-600">
                <Link to="/app/configurations" className="font-semibold text-pasture-800 hover:text-pasture-700">
                  Set the farm stud number in Configurations
                </Link>{' '}
                before saving this birth.
              </p>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Birth date"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
              />
            </div>

            <div className="mt-4 space-y-3">
              {kids.map((kid, index) => {
                const number = padDigits(kid.number, 4)
                const animalId = stud && year && number ? `${stud}-${year}-${number}` : ''
                const tag = year && number ? `${year}-${number}` : ''
                return (
                  <div
                    key={kid.key}
                    className="grid grid-cols-1 gap-3 rounded-2xl border border-field-dark p-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end"
                  >
                    <Input
                      label={index === 0 ? 'Number' : `Kid ${index + 1} number`}
                      inputMode="numeric"
                      value={kid.number}
                      onChange={(e) =>
                        updateKid(kid.key, { number: digitsOnly(e.target.value, 4), touched: true })
                      }
                      placeholder="0001"
                      required
                    />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-soil-700">Sex</p>
                      <div className="flex gap-2">
                        <SexChoice
                          selected={kid.sex === 'female'}
                          onClick={() => updateKid(kid.key, { sex: 'female' })}
                        >
                          Female
                        </SexChoice>
                        <SexChoice
                          selected={kid.sex === 'male'}
                          onClick={() => updateKid(kid.key, { sex: 'male' })}
                        >
                          Male
                        </SexChoice>
                      </div>
                      {animalId && (
                        <p className="text-xs text-soil-500">
                          Animal ID {animalId}
                          {tag ? ` · tag ${tag}` : ''}
                        </p>
                      )}
                    </div>
                    {kids.length > 1 && (
                      <button
                        type="button"
                        className="text-sm font-semibold text-red-700 hover:text-red-800 sm:mb-2"
                        onClick={() => setKids((prev) => prev.filter((item) => item.key !== kid.key))}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <Button type="button" variant="secondary" className="mt-4 w-full sm:w-auto" onClick={addKid}>
              Add another {offspringNoun(dam?.species)}
            </Button>
          </Card>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {created.length > 0 && (
            <Card>
              <p className="text-sm font-semibold text-pasture-900">
                {created.length === 1 ? 'Kid recorded.' : `${created.length} kids recorded.`} The breeding
                record is marked {bornLabel.toLowerCase()}.
              </p>
              <ul className="mt-2 space-y-1">
                {created.map((animal) => (
                  <li key={animal.id}>
                    <Link
                      to={`/app/animals/${animal.id}`}
                      className="text-sm font-semibold text-pasture-800 hover:text-pasture-700"
                    >
                      {animalLabel(animal) || formatAnimalId(animal) || formatTagNumber(animal)}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Button type="submit" disabled={submitting || !dam || !sire || !stud} className="w-full sm:w-auto">
            {submitting ? 'Saving...' : `Save ${kids.length === 1 ? offspringNoun(dam?.species) : young}`}
          </Button>
        </form>
      )}
    </div>
  )
}

function SexChoice({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${
        selected
          ? 'border-pasture-700 bg-pasture-800 text-white'
          : 'border-field-dark bg-panel text-soil-700 hover:bg-pasture-50'
      }`}
    >
      {children}
    </button>
  )
}
