import { supabase } from './supabase'
import type { AnimalInoculation, AnimalInoculationFormData, HealthRecordKind } from './types'

export function healthKindLabel(kind: string | null | undefined) {
  return kind === 'treatment' ? 'Treatment' : 'Vaccination'
}

export function todayDateValue() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function formatInoculationDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function emptyInoculationForm(kind: HealthRecordKind): AnimalInoculationFormData {
  return {
    kind,
    name: '',
    condition: '',
    medication: '',
    administered_at: todayDateValue(),
    next_due_at: '',
    batch_number: '',
    dosage: '',
    administered_by: '',
    notes: '',
  }
}

export function treatmentMedication(record: {
  kind?: string | null
  name: string
  medication?: string | null
}) {
  if (record.kind !== 'treatment') return ''
  return (record.medication ?? record.name).trim()
}

export function inoculationDisplayName(record: {
  kind?: string | null
  name: string
  condition?: string | null
  medication?: string | null
}) {
  if (record.kind !== 'treatment') return record.name
  const condition = record.condition?.trim()
  const medication = treatmentMedication(record)
  if (condition && medication) return `${condition} · ${medication}`
  return condition || medication || record.name
}

export function inoculationFormToPayload(form: AnimalInoculationFormData) {
  const opt = (v: string) => (v.trim() === '' ? null : v.trim())
  const condition = form.kind === 'treatment' ? opt(form.condition) : null
  const medication = form.kind === 'treatment' ? opt(form.medication) : null

  return {
    kind: form.kind,
    name: form.kind === 'treatment' ? (medication ?? form.name.trim()) : form.name.trim(),
    condition,
    medication,
    administered_at: form.administered_at,
    next_due_at: opt(form.next_due_at),
    batch_number: opt(form.batch_number),
    dosage: opt(form.dosage),
    administered_by: opt(form.administered_by),
    notes: opt(form.notes),
  }
}

export async function fetchAnimalInoculations(animalId: string) {
  const { data, error } = await supabase
    .from('animal_inoculations')
    .select('*')
    .eq('animal_id', animalId)
    .order('administered_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as AnimalInoculation[]
}

export async function fetchCompanyInoculations(companyId: string) {
  const { data, error } = await supabase
    .from('animal_inoculations')
    .select('*')
    .eq('company_id', companyId)
    .not('next_due_at', 'is', null)
    .order('next_due_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as AnimalInoculation[]
}

export async function createAnimalInoculation(params: {
  companyId: string
  animalId: string
  userId: string
  form: AnimalInoculationFormData
}) {
  const payload = inoculationFormToPayload(params.form)
  const { data, error } = await supabase
    .from('animal_inoculations')
    .insert({
      ...payload,
      company_id: params.companyId,
      animal_id: params.animalId,
      created_by: params.userId,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as AnimalInoculation
}

export async function updateAnimalInoculation(
  id: string,
  form: AnimalInoculationFormData,
) {
  const payload = inoculationFormToPayload(form)
  const { data, error } = await supabase
    .from('animal_inoculations')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as AnimalInoculation
}

export async function deleteAnimalInoculation(id: string) {
  const { error } = await supabase.from('animal_inoculations').delete().eq('id', id)
  if (error) throw error
}

export function isInoculationOverdue(nextDueAt: string | null) {
  if (!nextDueAt) return false
  return nextDueAt < todayDateValue()
}
