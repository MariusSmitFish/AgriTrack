import { supabase } from './supabase'
import type { AnimalSex } from './types'
import { formatAnimalSex, type PedigreeNode } from './animals'

export type OtherFarmRelation =
  | 'offspring_dam'
  | 'offspring_sire'
  | 'dam'
  | 'sire'
  | 'maternal_granddam'
  | 'maternal_grandsire'
  | 'paternal_granddam'
  | 'paternal_grandsire'

export interface OtherFarmRelative {
  relation: OtherFarmRelation
  animalKey: string
  sex: AnimalSex | null
  birthDate: string | null
  breed: string | null
  name: string | null
}

export async function fetchOtherFarmRelatives(animalId: string) {
  const { data, error } = await supabase.rpc('family_tree_other_farm', {
    p_animal_id: animalId,
  })
  if (error) throw error

  return ((data ?? []) as Array<{
    relation: string
    animal_key: string
    sex: string | null
    birth_date: string | null
    breed: string | null
    name: string | null
  }>)
    .filter((row): row is typeof row & { relation: OtherFarmRelation } =>
      row.relation === 'offspring_dam' ||
      row.relation === 'offspring_sire' ||
      row.relation === 'dam' ||
      row.relation === 'sire' ||
      row.relation === 'maternal_granddam' ||
      row.relation === 'maternal_grandsire' ||
      row.relation === 'paternal_granddam' ||
      row.relation === 'paternal_grandsire',
    )
    .map((row) => ({
      relation: row.relation,
      animalKey: row.animal_key,
      sex: row.sex === 'female' || row.sex === 'male' || row.sex === 'unknown' ? row.sex : null,
      birthDate: row.birth_date,
      breed: row.breed,
      name: row.name,
    })) satisfies OtherFarmRelative[]
}

export function otherFarmPedigreeNode(relative: OtherFarmRelative, role: string): PedigreeNode {
  const sexLabel = relative.sex ? formatAnimalSex(relative.sex) : null
  const name = relative.name?.trim()
  return {
    kind: 'external',
    animal: null,
    label: relative.animalKey,
    detail: ['Another farm', name && name !== relative.animalKey ? name : null, relative.breed, sexLabel, relative.birthDate]
      .filter(Boolean)
      .join(' · '),
    role,
    viewOnly: true,
    sex: relative.sex,
  }
}
