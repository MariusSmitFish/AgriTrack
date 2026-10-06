import { supabase } from './supabase'
import type { Animal } from './types'

/** Delete an animal and clean up related photo and document files in storage. */
export async function deleteAnimal(animal: Pick<Animal, 'id' | 'company_id'>) {
  const { data: photos, error: photosError } = await supabase
    .from('animal_photos')
    .select('storage_path')
    .eq('animal_id', animal.id)

  if (photosError) throw photosError

  const { data: documents, error: documentsError } = await supabase
    .from('animal_documents')
    .select('storage_path')
    .eq('animal_id', animal.id)

  if (documentsError) throw documentsError

  const { error: deleteError } = await supabase.from('animals').delete().eq('id', animal.id)
  if (deleteError) throw deleteError

  const paths = (photos ?? []).map((photo) => photo.storage_path).filter(Boolean)
  if (paths.length > 0) {
    await supabase.storage.from('animal-photos').remove(paths)
  }

  const documentPaths = (documents ?? []).map((document) => document.storage_path).filter(Boolean)
  if (documentPaths.length > 0) {
    await supabase.storage.from('animal-documents').remove(documentPaths)
  }

  // Best-effort cleanup if any orphaned files remain in the animal folder
  const folder = `${animal.company_id}/${animal.id}`
  const { data: leftovers } = await supabase.storage.from('animal-photos').list(folder)
  if (leftovers && leftovers.length > 0) {
    await supabase.storage
      .from('animal-photos')
      .remove(leftovers.map((file) => `${folder}/${file.name}`))
  }

  const { data: documentLeftovers } = await supabase.storage.from('animal-documents').list(folder)
  if (documentLeftovers && documentLeftovers.length > 0) {
    await supabase.storage
      .from('animal-documents')
      .remove(documentLeftovers.map((file) => `${folder}/${file.name}`))
  }
}

/** Shape a tag draft as year–number (`01-1000`) while the user is still typing. */
export function tagNumberDraft(value: string) {
  const cleaned = value.replace(/[^\d-]/g, '')
  if (cleaned.includes('-')) {
    const [yearRaw, ...rest] = cleaned.split('-')
    const year = yearRaw.replace(/\D/g, '').slice(0, 2)
    const number = rest.join('').replace(/\D/g, '').slice(0, 4)
    return `${year}-${number}`
  }

  const digits = cleaned.replace(/\D/g, '').slice(0, 6)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}-${digits.slice(2)}`
}

/** A finished visual tag (`##-####`). Partial numbers are left alone. */
export function exactTagQuery(value: string) {
  const draft = tagNumberDraft(value.trim())
  return /^\d{2}-\d{4}$/.test(draft) ? draft : null
}

/** Pad a tag to `##-####` when both parts are present. */
export function normalizeTagNumber(value: string) {
  const match = tagNumberDraft(value).match(/^(\d{1,2})-(\d{1,4})$/)
  if (!match) return null
  const year = match[1].padStart(2, '0').slice(-2)
  const number = match[2].padStart(4, '0').slice(-4)
  return { year, number, tag: `${year}-${number}` }
}

/** Extract the most likely ear-tag number from OCR text. */
export function extractTagFromOcr(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''

  const hyphenated = cleaned.match(/\d{1,2}\s*[-–]\s*\d{1,4}/)
  if (hyphenated) return tagNumberDraft(hyphenated[0].replace(/[–\s]/g, ''))

  const six = cleaned.match(/\d{6}/)
  if (six) return `${six[0].slice(0, 2)}-${six[0].slice(2)}`

  const candidates = cleaned.match(/[A-Za-z]?[0-9]{2,}[A-Za-z0-9-]*/g) ?? []
  if (candidates.length === 0) {
    return tagNumberDraft(cleaned)
  }

  return tagNumberDraft(candidates.sort((a, b) => b.length - a.length)[0] ?? '')
}

export function digitsOnly(value: string, maxLength: number) {
  return value.replace(/\D/g, '').slice(0, maxLength)
}

export function padDigits(value: string, length: number) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  return digits.padStart(length, '0').slice(-length)
}

/** Animal ID: stud number – year – number (`####-##-####`). */
export function formatAnimalId(
  animal: {
    stud_number?: string | null
    id_year?: string | null
    id_number?: string | null
  } | null | undefined,
) {
  if (!animal) return null
  const stud = animal.stud_number?.trim()
  const year = animal.id_year?.trim()
  const number = animal.id_number?.trim()
  if (!stud || !year || !number) return null
  return `${stud}-${year}-${number}`
}

/** Tag number: year – number (`##-####`). Falls back to a stored tag. */
export function formatTagNumber(
  animal: {
    id_year?: string | null
    id_number?: string | null
    tag_number?: string | null
  } | null | undefined,
) {
  if (!animal) return null
  const year = animal.id_year?.trim()
  const number = animal.id_number?.trim()
  if (year && number) return `${year}-${number}`
  const tag = animal.tag_number?.trim()
  return tag || null
}

export function animalsWithExactTag<T extends Parameters<typeof formatTagNumber>[0]>(
  animals: T[],
  tag: string,
) {
  return animals.filter((animal) => animal && formatTagNumber(animal) === tag)
}

/** Choice row when several animals share one visual tag. */
export function studTagChoiceLabel(
  animal: Pick<Animal, 'stud_number' | 'name'> & Parameters<typeof formatTagNumber>[0],
) {
  const stud = animal.stud_number?.trim() || 'No stud number'
  const tag = formatTagNumber(animal) ?? '—'
  const name = animal.name?.trim()
  return [`Stud ${stud}`, tag, name].filter(Boolean).join(' · ')
}

export function animalLabel(
  animal:
    | (Pick<Animal, 'tag_number' | 'stud_tag_number' | 'name'> &
        Partial<Pick<Animal, 'stud_number' | 'id_year' | 'id_number'>>)
    | null
    | undefined,
) {
  if (!animal) return 'Unknown'
  return (
    formatAnimalId(animal) ||
    formatTagNumber(animal) ||
    animal.stud_tag_number ||
    animal.name ||
    'Untagged'
  )
}

/** Label used in every animal dropdown: Animal ID first. */
export function animalOptionLabel(animal: Animal) {
  const animalId = formatAnimalId(animal)
  const bits = [animalId ?? formatTagNumber(animal) ?? animal.name ?? 'Untagged']
  if (animal.name && animal.name !== bits[0]) bits.push(animal.name)
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
  { value: 'goat', label: 'Goat' },
  { value: 'cattle', label: 'Cattle' },
  { value: 'sheep', label: 'Sheep' },
  { value: 'other', label: 'Other' },
] as const

export function formatSpecies(species: string | null | undefined) {
  if (!species) return '—'
  return animalSpeciesOptions.find((option) => option.value === species)?.label ?? species
}

export const studbookScheduleOptions = [
  { value: '', label: 'Not specified' },
  { value: 'Base', label: 'Base' },
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'SP', label: 'SP' },
] as const

export const animalSelectionOptions = [
  { value: '', label: 'Not specified' },
  { value: 'F', label: 'F' },
  { value: 'FC', label: 'FC' },
  { value: 'FR', label: 'FR' },
  { value: 'FT', label: 'FT' },
  { value: 'Stud', label: 'Stud' },
] as const
