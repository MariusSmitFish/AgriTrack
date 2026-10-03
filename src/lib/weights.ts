import { supabase } from './supabase'
import type { AnimalWeight, AnimalWeightFormData } from './types'
import { todayDateValue, formatInoculationDate } from './inoculations'

export function emptyWeightForm(): AnimalWeightFormData {
  return {
    weighed_at: todayDateValue(),
    weight_kg: '',
    notes: '',
  }
}

export function formatWeightDate(value: string | null | undefined) {
  return formatInoculationDate(value)
}

export function formatWeightKg(weightKg: number) {
  const rounded = Math.round(weightKg * 100) / 100
  return `${rounded.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 2,
  })} kg`
}

export function weightChangeKg(current: number, previous: number | null | undefined) {
  if (previous == null) return null
  return Math.round((current - previous) * 100) / 100
}

export function formatWeightChange(change: number | null) {
  if (change == null) return '—'
  if (change === 0) return '0 kg'
  const sign = change > 0 ? '+' : ''
  return `${sign}${change.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(change) ? 0 : 1,
    maximumFractionDigits: 2,
  })} kg`
}

export function weightFormToPayload(form: AnimalWeightFormData) {
  const weight = Number(form.weight_kg)
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error('Enter a weight greater than zero.')
  }

  return {
    weighed_at: form.weighed_at || todayDateValue(),
    weight_kg: Math.round(weight * 100) / 100,
    notes: form.notes.trim() === '' ? null : form.notes.trim(),
  }
}

export async function fetchAnimalWeights(animalId: string) {
  const { data, error } = await supabase
    .from('animal_weights')
    .select('*')
    .eq('animal_id', animalId)
    .order('weighed_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    weight_kg: Number(row.weight_kg),
  })) as AnimalWeight[]
}

export async function createAnimalWeight(params: {
  companyId: string
  animalId: string
  userId: string
  form: AnimalWeightFormData
}) {
  const payload = weightFormToPayload(params.form)
  const { data, error } = await supabase
    .from('animal_weights')
    .insert({
      ...payload,
      company_id: params.companyId,
      animal_id: params.animalId,
      created_by: params.userId,
    })
    .select('*')
    .single()

  if (error) throw error
  return { ...data, weight_kg: Number(data.weight_kg) } as AnimalWeight
}

export async function updateAnimalWeight(id: string, form: AnimalWeightFormData) {
  const payload = weightFormToPayload(form)
  const { data, error } = await supabase
    .from('animal_weights')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return { ...data, weight_kg: Number(data.weight_kg) } as AnimalWeight
}

export async function deleteAnimalWeight(id: string) {
  const { error } = await supabase.from('animal_weights').delete().eq('id', id)
  if (error) throw error
}
