import { useDeferredValue, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  animalFormToPayload,
  emptyAnimalForm,
  type Animal,
  type AnimalFormData,
  type Encampment,
  type FarmLocation,
} from '../../lib/types'
import {
  animalLabel,
  animalOptionLabel,
  animalSexOptions,
  animalSpeciesOptions,
  animalStatusOptions,
} from '../../lib/animals'
import { animalPlaceLabel, encampmentLabel, locationLabel } from '../../lib/locations'
import { filterBySearch } from '../../lib/search'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Card } from '../../components/ui/Card'
import { SearchField } from '../../components/ui/SearchField'
import { TagScannerField } from '../../components/ui/TagScannerField'
import { PageHeader } from '../../components/layout/AppShell'

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <h3 className="font-display font-semibold text-pasture-900">{title}</h3>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </Card>
  )
}

export function CaptureAnimalPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<AnimalFormData>(emptyAnimalForm())
  const [herd, setHerd] = useState<Animal[]>([])
  const [locations, setLocations] = useState<FarmLocation[]>([])
  const [encampments, setEncampments] = useState<Encampment[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [parentQuery, setParentQuery] = useState('')
  const deferredParentQuery = useDeferredValue(parentQuery)

  const set = <K extends keyof AnimalFormData>(key: K, value: AnimalFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    if (!profile?.company_id) {
      setError('Your account is not linked to a farm.')
      return
    }

    Promise.all([
      supabase
        .from('animals')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('locations')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name'),
      supabase
        .from('encampments')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name'),
    ]).then(([animalsRes, locationsRes, encampmentsRes]) => {
      if (animalsRes.error) setError(animalsRes.error.message)
      else setHerd(animalsRes.data ?? [])

      if (locationsRes.error) setError(locationsRes.error.message)
      else setLocations(locationsRes.data ?? [])

      if (encampmentsRes.error) setError(encampmentsRes.error.message)
      else setEncampments(encampmentsRes.data ?? [])
    })
  }, [profile?.company_id])

  const damOptions = useMemo(() => {
    const dams = herd.filter((a) => a.sex !== 'male')
    return filterBySearch(dams, deferredParentQuery, (animal) => [
      animal.tag_number,
      animal.stud_tag_number,
      animal.name,
      animal.breed,
    ])
  }, [herd, deferredParentQuery])

  const sireOptions = useMemo(() => {
    const sires = herd.filter((a) => a.sex !== 'female')
    return filterBySearch(sires, deferredParentQuery, (animal) => [
      animal.tag_number,
      animal.stud_tag_number,
      animal.name,
      animal.breed,
    ])
  }, [herd, deferredParentQuery])
  const campsForLocation = useMemo(
    () => encampments.filter((e) => e.location_id === form.location_id),
    [encampments, form.location_id],
  )

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile?.company_id) {
      setError('Your account is not linked to a farm.')
      return
    }

    setError('')
    setSubmitting(true)

    const selectedLocation = locations.find((l) => l.id === form.location_id)
    const selectedCamp = encampments.find((e) => e.id === form.encampment_id)
    const placeLabel = animalPlaceLabel({
      location: selectedLocation,
      encampment: selectedCamp,
    })
    const payload = animalFormToPayload(
      form,
      placeLabel === '—' ? null : placeLabel,
    )
    const { data, error: insertError } = await supabase
      .from('animals')
      .insert({
        ...payload,
        company_id: profile.company_id,
        created_by: profile.id,
      })
      .select('id')
      .single()

    if (insertError) {
      setError(insertError.message)
      setSubmitting(false)
      return
    }

    if (data?.id) navigate(`/app/animals/${data.id}`)
    else navigate('/app/animals')
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Capture animal"
        description="Record a new animal. Link dam and sire when you know them."
      />

      <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
        <FormSection title="Ear tags">
          <div className="md:col-span-2">
            <TagScannerField
              id="tag_number"
              label="Visual tag number"
              hint="Primary ear tag — the main ID you read in the field."
              value={form.tag_number}
              onChange={(v) => set('tag_number', v)}
            />
          </div>
          <div className="md:col-span-2">
            <TagScannerField
              id="stud_tag_number"
              label="Stud / backup tag number"
              hint="Secondary tag or stud code — used when animals have two tags."
              value={form.stud_tag_number}
              onChange={(v) => set('stud_tag_number', v)}
            />
          </div>
          <Input
            label="Name or nickname"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Optional"
          />
        </FormSection>

        <FormSection title="Animal details">
          <Select
            label="Species"
            value={form.species}
            onChange={(e) => set('species', e.target.value)}
          >
            {animalSpeciesOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input label="Breed" value={form.breed} onChange={(e) => set('breed', e.target.value)} />
          <Select label="Sex" value={form.sex} onChange={(e) => set('sex', e.target.value as AnimalFormData['sex'])}>
            {animalSexOptions.map((o) => (
              <option key={o.value || 'none'} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input
            label="Birth date"
            type="date"
            value={form.birth_date}
            onChange={(e) => set('birth_date', e.target.value)}
          />
          <div className="md:col-span-2">
            <Input
              label="Color / markings"
              value={form.color_markings}
              onChange={(e) => set('color_markings', e.target.value)}
              placeholder="e.g. Black white face, horned"
            />
          </div>
        </FormSection>

        <FormSection title="Pedigree">
          <div className="md:col-span-2">
            <SearchField
              id="parent-search"
              value={parentQuery}
              onChange={setParentQuery}
              placeholder="Filter dam/sire list by tag or name…"
              resultCount={damOptions.length + sireOptions.length}
              totalCount={herd.length}
            />
          </div>
          <Select
            label="Dam (mother) in herd"
            id="dam_id"
            value={form.dam_id}
            onChange={(e) => {
              const id = e.target.value
              const dam = damOptions.find((a) => a.id === id)
              set('dam_id', id)
              if (dam?.tag_number) set('dam_tag_number', dam.tag_number)
            }}
          >
            <option value="">Not linked</option>
            {damOptions.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animalOptionLabel(animal)}
              </option>
            ))}
          </Select>
          <Select
            label="Sire (father) in herd"
            id="sire_id"
            value={form.sire_id}
            onChange={(e) => {
              const id = e.target.value
              const sire = sireOptions.find((a) => a.id === id)
              set('sire_id', id)
              if (sire) set('sire_name', animalLabel(sire))
            }}
          >
            <option value="">Not linked</option>
            {sireOptions.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animalOptionLabel(animal)}
              </option>
            ))}
          </Select>
          <Input
            label="Dam tag (if not in herd)"
            value={form.dam_tag_number}
            onChange={(e) => set('dam_tag_number', e.target.value)}
            placeholder="Mother's tag"
          />
          <Input
            label="Sire name (if not in herd)"
            value={form.sire_name}
            onChange={(e) => set('sire_name', e.target.value)}
            placeholder="Father's name"
          />
          <div className="md:col-span-2">
            <Input
              label="Sire stud code"
              value={form.sire_stud_code}
              onChange={(e) => set('sire_stud_code', e.target.value)}
              placeholder="Semen company / stud identifier"
            />
          </div>
        </FormSection>

        <FormSection title="Management">
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => set('status', e.target.value as AnimalFormData['status'])}
          >
            {animalStatusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            label="Location"
            id="location_id"
            value={form.location_id}
            onChange={(e) => {
              set('location_id', e.target.value)
              set('encampment_id', '')
            }}
          >
            <option value="">Not assigned</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {locationLabel(location)}
              </option>
            ))}
          </Select>
          <Select
            label="Encampment"
            id="encampment_id"
            value={form.encampment_id}
            onChange={(e) => set('encampment_id', e.target.value)}
            disabled={!form.location_id}
          >
            <option value="">{form.location_id ? 'Not assigned' : 'Select a location first'}</option>
            {campsForLocation.map((camp) => (
              <option key={camp.id} value={camp.id}>
                {encampmentLabel(camp)}
              </option>
            ))}
          </Select>
          {locations.length === 0 && (
            <p className="md:col-span-2 text-sm text-soil-500">
              No locations yet.{' '}
              <Link to="/app/locations" className="font-semibold text-pasture-800 hover:text-pasture-700">
                Set up locations
              </Link>{' '}
              to assign where this animal lives.
            </p>
          )}
          <div className="md:col-span-2">
            <label htmlFor="notes" className="block text-sm font-semibold text-soil-700">
              Notes
            </label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-field-dark bg-white px-3 py-2.5 text-base outline-none focus:border-pasture-600 focus:ring-2 focus:ring-pasture-100 sm:text-sm"
              placeholder="Health, treatments, calving notes..."
            />
          </div>
        </FormSection>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
            {submitting ? 'Saving...' : 'Save animal'}
          </Button>
          <Link to="/app/animals">
            <Button type="button" variant="secondary" className="w-full sm:w-auto">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
