import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
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
  animalSelectionOptions,
  animalSexOptions,
  animalSpeciesOptions,
  animalStatusOptions,
  digitsOnly,
  formatAnimalId,
  formatTagNumber,
  normalizeTagNumber,
  padDigits,
  studbookScheduleOptions,
  tagNumberDraft,
} from '../../lib/animals'
import { animalPlaceLabel, encampmentLabel, locationLabel } from '../../lib/locations'
import { ParentPicker } from '../../components/animals/ParentPicker'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Card } from '../../components/ui/Card'
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

  const mothers = useMemo(() => herd.filter((animal) => animal.sex !== 'male'), [herd])
  const fathers = useMemo(() => herd.filter((animal) => animal.sex !== 'female'), [herd])
  const studPreview = padDigits(form.stud_number, 4)
  const yearPreview = padDigits(form.id_year, 2)
  const numberPreview = padDigits(form.id_number, 4)
  const animalIdPreview = formatAnimalId({
    stud_number: studPreview,
    id_year: yearPreview,
    id_number: numberPreview,
  })
  const applyTagNumber = (raw: string, finalize: boolean) => {
    const draft = tagNumberDraft(raw)
    const complete = draft.match(/^(\d{2})-(\d{4})$/)
    const parsed = finalize || complete ? normalizeTagNumber(draft) : null
    setForm((prev) => {
      if (!parsed) return { ...prev, tag_number: draft }
      return {
        ...prev,
        tag_number: parsed.tag,
        id_year: parsed.year,
        id_number: parsed.number,
      }
    })
  }

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
        <FormSection title="Identification">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:col-span-2">
            <Input
              id="stud_number"
              label="Stud number"
              inputMode="numeric"
              autoComplete="off"
              placeholder="####"
              maxLength={4}
              value={form.stud_number}
              onChange={(e) => set('stud_number', digitsOnly(e.target.value, 4))}
              onBlur={(e) => set('stud_number', padDigits(e.target.value, 4))}
            />
            <Input
              id="id_year"
              label="Year"
              inputMode="numeric"
              autoComplete="off"
              placeholder="##"
              maxLength={2}
              value={form.id_year}
              onChange={(e) => set('id_year', digitsOnly(e.target.value, 2))}
              onBlur={(e) => {
                const year = padDigits(e.target.value, 2)
                setForm((prev) => ({
                  ...prev,
                  id_year: year,
                  tag_number:
                    year && prev.id_number
                      ? `${year}-${padDigits(prev.id_number, 4)}`
                      : prev.tag_number,
                }))
              }}
            />
            <Input
              id="id_number"
              label="Number"
              inputMode="numeric"
              autoComplete="off"
              placeholder="####"
              maxLength={4}
              value={form.id_number}
              onChange={(e) => set('id_number', digitsOnly(e.target.value, 4))}
              onBlur={(e) => {
                const number = padDigits(e.target.value, 4)
                setForm((prev) => ({
                  ...prev,
                  id_number: number,
                  tag_number:
                    prev.id_year && number
                      ? `${padDigits(prev.id_year, 2)}-${number}`
                      : prev.tag_number,
                }))
              }}
            />
          </div>
          <div className="section-inset rounded-xl px-3 py-2.5 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-soil-500">Animal ID</p>
            <p className={`mt-0.5 text-sm font-medium ${animalIdPreview ? 'text-soil-800' : 'text-soil-400'}`}>
              {animalIdPreview ?? '####-##-####'}
            </p>
            <p className="mt-1 text-xs text-soil-500">Stud number – year – number</p>
          </div>
          <div className="md:col-span-2">
            <TagScannerField
              id="tag_number"
              label="Tag number"
              hint="Year – number, for example 01-1000."
              placeholder="01-1000"
              value={form.tag_number}
              onChange={(v) => applyTagNumber(v, false)}
              onCommit={(v) => applyTagNumber(v, true)}
            />
          </div>
          <Input
            id="studbook_number"
            label="Studbook number"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Large number"
            maxLength={20}
            value={form.studbook_number}
            onChange={(e) => set('studbook_number', digitsOnly(e.target.value, 20))}
          />
          <Select
            label="Studbook schedule"
            id="studbook_schedule"
            value={form.studbook_schedule}
            onChange={(e) =>
              set('studbook_schedule', e.target.value as AnimalFormData['studbook_schedule'])
            }
          >
            {studbookScheduleOptions.map((o) => (
              <option key={o.value || 'none'} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            label="Selection"
            id="selection"
            value={form.selection}
            onChange={(e) => set('selection', e.target.value as AnimalFormData['selection'])}
          >
            {animalSelectionOptions.map((o) => (
              <option key={o.value || 'none'} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
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
          <ParentPicker
            id="capture-mother"
            label="Mother"
            animals={mothers}
            selectedId={form.dam_id}
            onSelect={(id) => {
              const dam = mothers.find((animal) => animal.id === id)
              set('dam_id', id)
              set('dam_tag_number', dam ? formatTagNumber(dam) ?? '' : '')
            }}
          />
          <ParentPicker
            id="capture-father"
            label="Father"
            animals={fathers}
            selectedId={form.sire_id}
            onSelect={(id) => {
              const sire = fathers.find((animal) => animal.id === id)
              set('sire_id', id)
              set('sire_name', sire ? animalLabel(sire) : '')
            }}
          />
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
            label="Camp"
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
              className="mt-1 w-full min-h-11 rounded-xl border border-field-dark bg-white px-3 py-2.5 text-base outline-none focus:border-pasture-600 focus:ring-2 focus:ring-pasture-100 sm:min-h-0 sm:text-sm"
              placeholder="Health, treatments, breeding notes..."
            />
          </div>
        </FormSection>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="hidden gap-2 md:flex md:flex-row">
          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
            {submitting ? 'Saving...' : 'Save animal'}
          </Button>
          <Link to="/app/animals" className="block w-full sm:w-auto">
            <Button type="button" variant="secondary" className="w-full sm:w-auto">
              Cancel
            </Button>
          </Link>
        </div>

        <div className="h-20 md:hidden" aria-hidden="true" />
        <div className="print-hide fixed inset-x-0 bottom-0 z-30 border-t border-field-dark bg-panel/95 px-3 pt-3 shadow-lg shadow-pasture-900/15 backdrop-blur md:hidden pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-7xl gap-2">
            <Button type="submit" disabled={submitting} className="min-h-12 flex-1">
              {submitting ? 'Saving...' : 'Save animal'}
            </Button>
            <Link to="/app/animals" className="block flex-1">
              <Button type="button" variant="secondary" className="min-h-12 w-full">
                Cancel
              </Button>
            </Link>
          </div>
        </div>
      </form>
    </div>
  )
}
