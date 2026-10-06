import { supabase } from './supabase'
import type { AnimalAchievement, AnimalAchievementFormData } from './types'
import { todayDateValue } from './inoculations'

export const showResultSuggestions = [
  'Grand champion',
  'Reserve grand champion',
  'Champion',
  'Reserve champion',
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  'Highly commended',
] as const

export function emptyAchievementForm(): AnimalAchievementFormData {
  return {
    show_name: '',
    shown_at: todayDateValue(),
    class_name: '',
    result: '',
    notes: '',
  }
}

export function achievementFormToPayload(form: AnimalAchievementFormData) {
  const showName = form.show_name.trim()
  const result = form.result.trim()
  if (!showName) throw new Error('Enter the show name.')
  if (!result) throw new Error('Enter the result.')
  if (!form.shown_at) throw new Error('Enter the show date.')

  return {
    show_name: showName,
    shown_at: form.shown_at,
    class_name: form.class_name.trim() || null,
    result,
    notes: form.notes.trim() || null,
  }
}

export async function fetchAnimalAchievements(animalId: string) {
  const { data, error } = await supabase
    .from('animal_achievements')
    .select('*')
    .eq('animal_id', animalId)
    .order('shown_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as AnimalAchievement[]
}

export async function createAnimalAchievement(params: {
  companyId: string
  animalId: string
  userId: string
  form: AnimalAchievementFormData
}) {
  const payload = achievementFormToPayload(params.form)
  const { data, error } = await supabase
    .from('animal_achievements')
    .insert({
      ...payload,
      company_id: params.companyId,
      animal_id: params.animalId,
      created_by: params.userId,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as AnimalAchievement
}

export async function updateAnimalAchievement(id: string, form: AnimalAchievementFormData) {
  const payload = achievementFormToPayload(form)
  const { data, error } = await supabase
    .from('animal_achievements')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as AnimalAchievement
}

export async function deleteAnimalAchievement(id: string) {
  const { error } = await supabase.from('animal_achievements').delete().eq('id', id)
  if (error) throw error
}
