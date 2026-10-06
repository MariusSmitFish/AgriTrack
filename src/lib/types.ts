export type UserRole = 'superadmin' | 'company_admin' | 'company_user'

export type AnimalSex = 'male' | 'female' | 'unknown'
export type AnimalStatus = 'active' | 'sold' | 'deceased' | 'transferred'
export type StudbookSchedule = 'Base' | 'A' | 'B' | 'SP'
export type AnimalSelection = 'F' | 'FC' | 'FR' | 'FT' | 'Stud'

export interface Company {
  id: string
  name: string
  slug: string
  stud_number: string | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  company_id: string | null
  created_at: string
  updated_at: string
  companies?: Company | null
}

export interface CreateUserPayload {
  email: string
  full_name: string
  role: UserRole
  company_id?: string | null
  redirect_to?: string
}

export interface FarmLocation {
  id: string
  company_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface Encampment {
  id: string
  company_id: string
  location_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  locations?: Pick<FarmLocation, 'id' | 'name'> | null
}

export interface Animal {
  id: string
  company_id: string
  created_by: string | null
  tag_number: string | null
  stud_number: string | null
  id_year: string | null
  id_number: string | null
  studbook_number: string | null
  studbook_schedule: StudbookSchedule | null
  selection: AnimalSelection | null
  stud_tag_number: string | null
  electronic_id: string | null
  name: string | null
  species: string | null
  breed: string | null
  sex: AnimalSex | null
  birth_date: string | null
  color_markings: string | null
  dam_id: string | null
  sire_id: string | null
  sire_name: string | null
  sire_stud_code: string | null
  dam_tag_number: string | null
  status: AnimalStatus | null
  encampment_id: string | null
  location: string | null
  notes: string | null
  created_at: string
  updated_at: string
  encampments?: (Pick<Encampment, 'id' | 'name' | 'location_id'> & {
    locations?: Pick<FarmLocation, 'id' | 'name'> | null
  }) | null
}

export interface AnimalPhoto {
  id: string
  company_id: string
  animal_id: string
  storage_path: string
  captured_at: string
  caption: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AnimalPhotoWithUrl extends AnimalPhoto {
  url: string | null
}

export type HealthRecordKind = 'vaccination' | 'treatment'

export interface HealthOption {
  id: string
  company_id: string
  kind: HealthRecordKind
  name: string
  created_at: string
  updated_at: string
}

export interface AnimalInoculation {
  id: string
  company_id: string
  animal_id: string
  kind: HealthRecordKind
  name: string
  administered_at: string
  next_due_at: string | null
  batch_number: string | null
  dosage: string | null
  administered_by: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AnimalInoculationFormData {
  kind: HealthRecordKind
  name: string
  administered_at: string
  next_due_at: string
  batch_number: string
  dosage: string
  administered_by: string
  notes: string
}

export interface AnimalWeight {
  id: string
  company_id: string
  animal_id: string
  weighed_at: string
  weight_kg: number
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AnimalWeightFormData {
  weighed_at: string
  weight_kg: string
  notes: string
}

export interface AnimalDocument {
  id: string
  company_id: string
  animal_id: string
  title: string
  storage_path: string
  file_name: string
  mime_type: string | null
  file_size: number | null
  document_date: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AnimalDocumentWithUrl extends AnimalDocument {
  url: string | null
}

export interface AnimalDocumentFormData {
  title: string
  document_date: string
  notes: string
}

export interface AnimalAchievement {
  id: string
  company_id: string
  animal_id: string
  show_name: string
  shown_at: string
  class_name: string | null
  result: string
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AnimalAchievementFormData {
  show_name: string
  shown_at: string
  class_name: string
  result: string
  notes: string
}

export type BreedingOutcome = 'open' | 'pregnant' | 'calved' | 'failed'

export interface BreedingEvent {
  id: string
  company_id: string
  dam_id: string
  sire_id: string | null
  served_at: string
  expected_calving_at: string | null
  outcome: BreedingOutcome
  calf_id: string | null
  offspring_ids: string[]
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface BreedingEventFormData {
  dam_id: string
  sire_id: string
  served_at: string
  expected_calving_at: string
  outcome: BreedingOutcome
  calf_id: string
  notes: string
}

export interface AnimalFormData {
  tag_number: string
  stud_number: string
  id_year: string
  id_number: string
  studbook_number: string
  studbook_schedule: StudbookSchedule | ''
  selection: AnimalSelection | ''
  electronic_id: string
  name: string
  species: string
  breed: string
  sex: AnimalSex | ''
  birth_date: string
  color_markings: string
  dam_id: string
  sire_id: string
  sire_name: string
  sire_stud_code: string
  dam_tag_number: string
  status: AnimalStatus | ''
  location_id: string
  encampment_id: string
  notes: string
}

export const emptyAnimalForm = (): AnimalFormData => ({
  tag_number: '',
  stud_number: '',
  id_year: '',
  id_number: '',
  studbook_number: '',
  studbook_schedule: '',
  selection: '',
  electronic_id: '',
  name: '',
  species: 'goat',
  breed: 'Boer goat',
  sex: '',
  birth_date: '',
  color_markings: '',
  dam_id: '',
  sire_id: '',
  sire_name: '',
  sire_stud_code: '',
  dam_tag_number: '',
  status: 'active',
  location_id: '',
  encampment_id: '',
  notes: '',
})

function digitsOrNull(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits || null
}

function padIdPart(value: string, length: number) {
  const digits = digitsOrNull(value)
  if (!digits) return null
  return digits.padStart(length, '0').slice(-length)
}

function tagParts(value: string) {
  const cleaned = value.replace(/[^\d-]/g, '')
  let year = ''
  let number = ''
  if (cleaned.includes('-')) {
    const [yearRaw, ...rest] = cleaned.split('-')
    year = yearRaw.replace(/\D/g, '').slice(0, 2)
    number = rest.join('').replace(/\D/g, '').slice(0, 4)
  } else {
    const digits = cleaned.replace(/\D/g, '').slice(0, 6)
    year = digits.slice(0, 2)
    number = digits.slice(2)
  }
  if (!year || !number) return null
  const idYear = year.padStart(2, '0').slice(-2)
  const idNumber = number.padStart(4, '0').slice(-4)
  return { year: idYear, number: idNumber }
}

export function animalFormToPayload(
  form: AnimalFormData,
  placeLabel?: string | null,
) {
  const opt = (v: string) => (v.trim() === '' ? null : v.trim())
  const studNumber = padIdPart(form.stud_number, 4)
  const parsedTag = tagParts(form.tag_number)
  const idYear = padIdPart(form.id_year, 2) ?? parsedTag?.year ?? null
  const idNumber = padIdPart(form.id_number, 4) ?? parsedTag?.number ?? null
  const tagNumber = idYear && idNumber ? `${idYear}-${idNumber}` : null

  return {
    tag_number: tagNumber,
    stud_number: studNumber,
    id_year: idYear,
    id_number: idNumber,
    studbook_number: digitsOrNull(form.studbook_number),
    studbook_schedule: form.studbook_schedule === '' ? null : form.studbook_schedule,
    selection: form.selection === '' ? null : form.selection,
    electronic_id: opt(form.electronic_id),
    name: opt(form.name),
    species: opt(form.species) ?? 'goat',
    breed: opt(form.breed),
    sex: form.sex === '' ? null : form.sex,
    birth_date: form.birth_date === '' ? null : form.birth_date,
    color_markings: opt(form.color_markings),
    dam_id: opt(form.dam_id),
    sire_id: opt(form.sire_id),
    sire_name: opt(form.sire_name),
    sire_stud_code: opt(form.sire_stud_code),
    dam_tag_number: opt(form.dam_tag_number),
    status: form.status === '' ? null : form.status,
    encampment_id: opt(form.encampment_id),
    location: placeLabel?.trim() || null,
    notes: opt(form.notes),
  }
}
