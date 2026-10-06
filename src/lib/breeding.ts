import { supabase } from './supabase'
import type { BreedingEvent, BreedingEventFormData, BreedingOutcome } from './types'
import { todayDateValue } from './inoculations'
import { addDaysToDateValue } from './herdInsights'
import { bornOutcomeLabel, gestationDaysForSpecies } from './speciesTerms'

/** @deprecated Prefer gestationDaysForSpecies — kept for callers without a species yet */
export const DEFAULT_GESTATION_DAYS = 283

export function breedingOutcomeOptionsForSpecies(species?: string | null) {
  return [
    { value: 'open' as const, label: 'Open / mated' },
    { value: 'pregnant' as const, label: 'Pregnant' },
    { value: 'calved' as const, label: bornOutcomeLabel(species) },
    { value: 'failed' as const, label: 'Failed / open' },
  ]
}

/** Neutral options when species is unknown / mixed list */
export const breedingOutcomeOptions = breedingOutcomeOptionsForSpecies(null)

export function formatBreedingOutcome(
  outcome: BreedingOutcome | string,
  species?: string | null,
) {
  if (outcome === 'calved') return bornOutcomeLabel(species)
  return breedingOutcomeOptionsForSpecies(species).find((o) => o.value === outcome)?.label ?? outcome
}

export function emptyBreedingForm(
  overrides?: Partial<BreedingEventFormData>,
  species?: string | null,
): BreedingEventFormData {
  const servedAt = todayDateValue()
  const gestation = gestationDaysForSpecies(species)
  return {
    dam_id: '',
    sire_id: '',
    served_at: servedAt,
    expected_calving_at: addDaysToDateValue(servedAt, gestation),
    outcome: 'open',
    calf_id: '',
    notes: '',
    ...overrides,
  }
}

export function breedingFormToPayload(
  form: BreedingEventFormData,
  species?: string | null,
) {
  const opt = (v: string) => (v.trim() === '' ? null : v.trim())
  const servedAt = form.served_at || todayDateValue()
  const gestation = gestationDaysForSpecies(species)

  return {
    dam_id: form.dam_id,
    sire_id: opt(form.sire_id),
    served_at: servedAt,
    expected_calving_at:
      opt(form.expected_calving_at) ?? addDaysToDateValue(servedAt, gestation),
    outcome: form.outcome,
    calf_id: opt(form.calf_id),
    notes: opt(form.notes),
  }
}

export function breedingEventToForm(event: BreedingEvent): BreedingEventFormData {
  return {
    dam_id: event.dam_id,
    sire_id: event.sire_id ?? '',
    served_at: event.served_at,
    expected_calving_at: event.expected_calving_at ?? '',
    outcome: event.outcome,
    calf_id: event.calf_id ?? '',
    notes: event.notes ?? '',
  }
}

export async function fetchCompanyBreedingEvents(companyId: string) {
  const { data, error } = await supabase
    .from('breeding_events')
    .select('*')
    .eq('company_id', companyId)
    .order('served_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as BreedingEvent[]
}

export async function fetchAnimalBreedingEvents(animalId: string) {
  const { data, error } = await supabase
    .from('breeding_events')
    .select('*')
    .or(`dam_id.eq.${animalId},sire_id.eq.${animalId}`)
    .order('served_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as BreedingEvent[]
}

export async function createBreedingEvent(params: {
  companyId: string
  userId: string
  form: BreedingEventFormData
  species?: string | null
}) {
  const payload = breedingFormToPayload(params.form, params.species)
  const { data, error } = await supabase
    .from('breeding_events')
    .insert({
      ...payload,
      company_id: params.companyId,
      created_by: params.userId,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as BreedingEvent
}

export async function updateBreedingEvent(
  id: string,
  form: BreedingEventFormData,
  species?: string | null,
) {
  const payload = breedingFormToPayload(form, species)
  const { data, error } = await supabase
    .from('breeding_events')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as BreedingEvent
}

export async function deleteBreedingEvent(id: string) {
  const { error } = await supabase.from('breeding_events').delete().eq('id', id)
  if (error) throw error
}

/** True when expected birth date has passed and outcome is still open/pregnant. */
export function isBirthOverdue(expectedBirthAt: string | null, outcome: BreedingOutcome) {
  if (!expectedBirthAt) return false
  if (outcome === 'calved' || outcome === 'failed') return false
  return expectedBirthAt < todayDateValue()
}

/** @deprecated Use isBirthOverdue */
export const isCalvingOverdue = isBirthOverdue
