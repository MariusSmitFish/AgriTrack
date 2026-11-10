import { supabase } from './supabase'
import type { AnimalFamacha, AnimalFamachaFormData } from './types'
import { todayDateValue, formatInoculationDate } from './inoculations'

export const famachaScoreOptions = ['1', '2', '3', '4', '5'] as const

export function emptyFamachaForm(): AnimalFamachaFormData {
  return {
    checked_at: todayDateValue(),
    score: '',
  }
}

export function normalizeAnimalFamacha(row: AnimalFamacha): AnimalFamacha {
  const score = Number(row.score)
  return {
    ...row,
    score: Number.isInteger(score) && score >= 1 && score <= 5 ? score : 0,
  }
}

export function formatFamachaDate(value: string | null | undefined) {
  return formatInoculationDate(value)
}

export function famachaScoreClass(score: number) {
  if (score <= 2) return 'font-semibold text-pasture-800'
  if (score === 3) return 'font-semibold text-barn-600'
  if (score >= 4) return 'font-semibold text-red-700'
  return 'text-soil-600'
}

export function famachaFormToPayload(form: AnimalFamachaFormData) {
  const score = Number(form.score)
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error('Choose a FAMACHA score from 1 to 5.')
  }

  return {
    checked_at: form.checked_at || todayDateValue(),
    score,
  }
}

export async function fetchAnimalFamacha(animalId: string) {
  const { data, error } = await supabase
    .from('animal_famacha')
    .select('*')
    .eq('animal_id', animalId)
    .order('checked_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => normalizeAnimalFamacha(row as AnimalFamacha))
}

export async function createAnimalFamacha(params: {
  companyId: string
  animalId: string
  userId: string
  form: AnimalFamachaFormData
}) {
  const payload = famachaFormToPayload(params.form)
  const { data, error } = await supabase
    .from('animal_famacha')
    .insert({
      ...payload,
      company_id: params.companyId,
      animal_id: params.animalId,
      created_by: params.userId,
    })
    .select('*')
    .single()

  if (error) throw error
  return normalizeAnimalFamacha(data as AnimalFamacha)
}

export async function updateAnimalFamacha(id: string, form: AnimalFamachaFormData) {
  const payload = famachaFormToPayload(form)
  const { data, error } = await supabase
    .from('animal_famacha')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return normalizeAnimalFamacha(data as AnimalFamacha)
}

export async function deleteAnimalFamacha(id: string) {
  const { error } = await supabase.from('animal_famacha').delete().eq('id', id)
  if (error) throw error
}
