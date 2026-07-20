import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  animalFormToPayload,
  emptyAnimalForm,
  type AnimalFormData,
} from '../../lib/types'
import {
  animalSexOptions,
  animalSpeciesOptions,
  animalStatusOptions,
} from '../../lib/animals'
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
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const set = <K extends keyof AnimalFormData>(key: K, value: AnimalFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile?.company_id) {
      setError('Your account is not linked to a farm.')
      return
    }

    setError('')
    setSubmitting(true)

    const payload = animalFormToPayload(form)
    const { error: insertError } = await supabase.from('animals').insert({
      ...payload,
      company_id: profile.company_id,
      created_by: profile.id,
    })

    if (insertError) {
      setError(insertError.message)
      setSubmitting(false)
      return
    }

    navigate('/app/animals')
  }

  useEffect(() => {
    if (!profile?.company_id) {
      setError('Your account is not linked to a farm.')
    }
  }, [profile?.company_id])

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Capture animal"
        description="Record a new animal. All fields are optional — add what you know."
      />

      <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
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
          <Input
            label="Dam tag number"
            value={form.dam_tag_number}
            onChange={(e) => set('dam_tag_number', e.target.value)}
            placeholder="Mother's tag"
          />
          <Input
            label="Sire name"
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
          <Input
            label="Location / pasture"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="e.g. North paddock"
          />
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
