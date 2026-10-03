import { supabase } from './supabase'
import type { AnimalInoculation, AnimalInoculationFormData } from './types'

export const commonInoculationNames = [
  'Anthrax',
  'Blackleg / Clostridial',
  'Botulism',
  'Brucellosis',
  'Foot and mouth',
  'Lumpy skin disease',
  'Pasteurella',
  'Rabies',
  'Rift Valley fever',
  'Tetanus',
] as const

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

export function emptyInoculationForm(): AnimalInoculationFormData {
  return {
    name: '',
    administered_at: todayDateValue(),
    next_due_at: '',
    batch_number: '',
    dosage: '',
    administered_by: '',
    notes: '',
  }
}

export function inoculationFormToPayload(form: AnimalInoculationFormData) {
  const opt = (v: string) => (v.trim() === '' ? null : v.trim())

  return {
    name: form.name.trim(),
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
