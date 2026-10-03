import { supabase } from './supabase'
import type { Animal } from './types'

/** Delete an animal and clean up related photo files in storage. */
export async function deleteAnimal(animal: Pick<Animal, 'id' | 'company_id'>) {
  const { data: photos, error: photosError } = await supabase
    .from('animal_photos')
    .select('storage_path')
    .eq('animal_id', animal.id)

  if (photosError) throw photosError

  const { error: deleteError } = await supabase.from('animals').delete().eq('id', animal.id)
  if (deleteError) throw deleteError

  const paths = (photos ?? []).map((photo) => photo.storage_path).filter(Boolean)
  if (paths.length > 0) {
    await supabase.storage.from('animal-photos').remove(paths)
  }

  // Best-effort cleanup if any orphaned files remain in the animal folder
  const folder = `${animal.company_id}/${animal.id}`
  const { data: leftovers } = await supabase.storage.from('animal-photos').list(folder)
  if (leftovers && leftovers.length > 0) {
    await supabase.storage
      .from('animal-photos')
      .remove(leftovers.map((file) => `${folder}/${file.name}`))
  }
}

/** Extract the most likely ear-tag number from OCR text. */
export function extractTagFromOcr(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''

  // Prefer sequences of digits (common for ear tags), optionally with letter prefix
  const candidates = cleaned.match(/[A-Za-z]?[0-9]{2,}[A-Za-z0-9-]*/g) ?? []
  if (candidates.length === 0) {
    return cleaned.replace(/[^A-Za-z0-9-]/g, '').slice(0, 20)
  }

  return candidates.sort((a, b) => b.length - a.length)[0]?.toUpperCase() ?? ''
}

export function animalLabel(
  animal: Pick<Animal, 'tag_number' | 'stud_tag_number' | 'name'> | null | undefined,
) {
  if (!animal) return 'Unknown'
  return animal.tag_number || animal.stud_tag_number || animal.name || 'Untagged'
}

export function animalOptionLabel(animal: Animal) {
  const id = animalLabel(animal)
  const bits = [id]
  if (animal.breed) bits.push(animal.breed)
  if (animal.sex) bits.push(formatAnimalSex(animal.sex))
  return bits.join(' · ')
}

export function formatAnimalSex(sex: string | null) {
  if (!sex) return '—'
  if (sex === 'male') return 'Male'
  if (sex === 'female') return 'Female'
  return 'Unknown'
}

export function formatAnimalStatus(status: string | null) {
  if (!status) return '—'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function getAnimalById(animals: Animal[], id: string | null | undefined) {
  if (!id) return null
  return animals.find((a) => a.id === id) ?? null
}

export function getOffspring(animals: Animal[], parentId: string) {
  return animals
    .filter((a) => a.dam_id === parentId || a.sire_id === parentId)
    .sort((a, b) => {
      const ad = a.birth_date ?? ''
      const bd = b.birth_date ?? ''
      if (ad !== bd) return bd.localeCompare(ad)
      return animalLabel(a).localeCompare(animalLabel(b))
    })
}

/** True if `candidateId` appears in the ancestry of `animalId` (would create a cycle). */
export function wouldCreatePedigreeCycle(
  animals: Animal[],
  animalId: string,
  candidateId: string,
) {
  if (animalId === candidateId) return true

  const stack = [animalId]
  const seen = new Set<string>()

  while (stack.length > 0) {
    const current = stack.pop()!
    if (seen.has(current)) continue
    seen.add(current)

    for (const child of animals) {
      if (child.dam_id !== current && child.sire_id !== current) continue
      if (child.id === candidateId) return true
      stack.push(child.id)
    }
  }

  return false
}

export type PedigreeNodeKind = 'animal' | 'external' | 'empty'

export interface PedigreeNode {
  kind: PedigreeNodeKind
  animal: Animal | null
  label: string
  detail?: string
  role: string
}

export interface PedigreeTree {
  focus: Animal
  sire: PedigreeNode
  dam: PedigreeNode
  paternalGrandsire: PedigreeNode
  paternalGranddam: PedigreeNode
  maternalGrandsire: PedigreeNode
  maternalGranddam: PedigreeNode
  offspring: Animal[]
}

function emptyNode(role: string): PedigreeNode {
  return { kind: 'empty', animal: null, label: 'Not linked', role }
}

function animalNode(animal: Animal | null, role: string, externalLabel?: string | null, externalDetail?: string | null): PedigreeNode {
  if (animal) {
    return {
      kind: 'animal',
      animal,
      label: animalLabel(animal),
      detail: [animal.breed, formatAnimalSex(animal.sex)].filter(Boolean).join(' · ') || undefined,
      role,
    }
  }

  if (externalLabel?.trim()) {
    return {
      kind: 'external',
      animal: null,
      label: externalLabel.trim(),
      detail: externalDetail?.trim() || 'External / not in herd',
      role,
    }
  }

  return emptyNode(role)
}

export function buildPedigreeTree(animals: Animal[], focusId: string): PedigreeTree | null {
  const focus = getAnimalById(animals, focusId)
  if (!focus) return null

  const sire = getAnimalById(animals, focus.sire_id)
  const dam = getAnimalById(animals, focus.dam_id)

  return {
    focus,
    sire: animalNode(sire, 'Sire', focus.sire_name, focus.sire_stud_code),
    dam: animalNode(dam, 'Dam', focus.dam_tag_number ? `Tag ${focus.dam_tag_number}` : null),
    paternalGrandsire: animalNode(
      getAnimalById(animals, sire?.sire_id),
      'Paternal grandsire',
      sire?.sire_name,
      sire?.sire_stud_code,
    ),
    paternalGranddam: animalNode(
      getAnimalById(animals, sire?.dam_id),
      'Paternal granddam',
      sire?.dam_tag_number ? `Tag ${sire.dam_tag_number}` : null,
    ),
    maternalGrandsire: animalNode(
      getAnimalById(animals, dam?.sire_id),
      'Maternal grandsire',
      dam?.sire_name,
      dam?.sire_stud_code,
    ),
    maternalGranddam: animalNode(
      getAnimalById(animals, dam?.dam_id),
      'Maternal granddam',
      dam?.dam_tag_number ? `Tag ${dam.dam_tag_number}` : null,
    ),
    offspring: getOffspring(animals, focus.id),
  }
}

export const animalSexOptions = [
  { value: '', label: 'Not specified' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'unknown', label: 'Unknown' },
] as const

export const animalStatusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'sold', label: 'Sold' },
  { value: 'deceased', label: 'Deceased' },
  { value: 'transferred', label: 'Transferred' },
] as const

export const animalSpeciesOptions = [
  { value: 'cattle', label: 'Cattle' },
  { value: 'sheep', label: 'Sheep' },
  { value: 'goat', label: 'Goat' },
  { value: 'other', label: 'Other' },
] as const
