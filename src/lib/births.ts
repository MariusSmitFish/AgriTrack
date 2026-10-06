import { supabase } from './supabase'
import type { Animal, AnimalSex, BreedingEvent } from './types'
import { formatAnimalId, formatTagNumber, padDigits } from './animals'
import { addDaysToDateValue } from './herdInsights'
import { gestationDaysForSpecies } from './speciesTerms'

export interface BirthKidInput {
  number: string
  sex: Extract<AnimalSex, 'male' | 'female'>
}

export function birthYearPart(birthDate: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? birthDate.slice(2, 4) : ''
}

export function usedIdNumbers(animals: Animal[], stud: string, year: string) {
  const used = new Set<number>()
  if (!stud || !year) return used
  for (const animal of animals) {
    if (padDigits(animal.stud_number ?? '', 4) !== stud) continue
    if ((animal.id_year ?? '') !== year) continue
    const number = Number.parseInt(animal.id_number ?? '', 10)
    if (Number.isFinite(number)) used.add(number)
  }
  return used
}

export function nextFreeIdNumber(used: Set<number>, startAt = 1) {
  let number = Math.max(1, startAt)
  while (used.has(number) && number <= 9999) number += 1
  if (number > 9999) return ''
  return String(number).padStart(4, '0')
}

export function openBreedingEvents(events: BreedingEvent[], damId: string) {
  return events
    .filter(
      (event) =>
        event.dam_id === damId && (event.outcome === 'open' || event.outcome === 'pregnant'),
    )
    .sort((a, b) => b.served_at.localeCompare(a.served_at))
}

export async function recordBirth(params: {
  companyId: string
  userId: string
  dam: Animal
  sire: Animal
  birthDate: string
  studNumber: string
  kids: BirthKidInput[]
  breedingEvent: BreedingEvent | null
}) {
  const stud = padDigits(params.studNumber, 4)
  const year = birthYearPart(params.birthDate)
  if (!stud) throw new Error('Set the farm stud number in Configurations before capturing a birth.')
  if (!year) throw new Error('Enter the birth date.')
  if (params.kids.length === 0) throw new Error('Add at least one kid.')

  const seen = new Set<string>()
  const rows = params.kids.map((kid) => {
    const number = padDigits(kid.number, 4)
    if (!/^\d{4}$/.test(number)) throw new Error('Each kid needs a number.')
    if (seen.has(number)) throw new Error(`Number ${number} is used more than once.`)
    seen.add(number)
    if (!kid.sex) throw new Error('Choose male or female for each kid.')

    return {
      company_id: params.companyId,
      created_by: params.userId,
      stud_number: stud,
      id_year: year,
      id_number: number,
      tag_number: `${year}-${number}`,
      species: params.dam.species || 'goat',
      breed: params.dam.breed || 'Boer goat',
      sex: kid.sex,
      birth_date: params.birthDate,
      dam_id: params.dam.id,
      sire_id: params.sire.id,
      dam_tag_number: formatTagNumber(params.dam),
      sire_name: params.sire.name?.trim() || formatAnimalId(params.sire),
      status: 'active',
      encampment_id: params.dam.encampment_id,
      location: params.dam.location,
    }
  })

  const { data, error } = await supabase.from('animals').insert(rows).select('*')
  if (error) throw error

  const offspring = (data ?? []) as Animal[]
  const offspringIds = offspring.map((animal) => animal.id)
  const breedingPatch = {
    outcome: 'calved' as const,
    calf_id: offspringIds[0] ?? null,
    offspring_ids: offspringIds,
    sire_id: params.sire.id,
  }

  if (params.breedingEvent) {
    const { error: updateError } = await supabase
      .from('breeding_events')
      .update(breedingPatch)
      .eq('id', params.breedingEvent.id)
    if (updateError) throw updateError
  } else {
    const gestation = gestationDaysForSpecies(params.dam.species)
    const { error: insertError } = await supabase.from('breeding_events').insert({
      ...breedingPatch,
      company_id: params.companyId,
      dam_id: params.dam.id,
      served_at: addDaysToDateValue(params.birthDate, -gestation),
      expected_calving_at: params.birthDate,
      created_by: params.userId,
    })
    if (insertError) throw insertError
  }

  return offspring
}
