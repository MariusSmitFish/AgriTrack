export type UserRole = 'superadmin' | 'company_admin' | 'company_user'

export type AnimalSex = 'male' | 'female' | 'unknown'
export type AnimalStatus = 'active' | 'sold' | 'deceased' | 'transferred'

export interface Company {
  id: string
  name: string
  slug: string
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

export interface AnimalInoculation {
  id: string
  company_id: string
  animal_id: string
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
  name: string
  administered_at: string
  next_due_at: string
  batch_number: string
  dosage: string
  administered_by: string
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
  stud_tag_number: string
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
  stud_tag_number: '',
  electronic_id: '',
  name: '',
  species: 'cattle',
  breed: '',
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

export function animalFormToPayload(
  form: AnimalFormData,
  placeLabel?: string | null,
) {
  const opt = (v: string) => (v.trim() === '' ? null : v.trim())

  return {
    tag_number: opt(form.tag_number),
    stud_tag_number: opt(form.stud_tag_number),
    electronic_id: opt(form.electronic_id),
    name: opt(form.name),
    species: opt(form.species) ?? 'cattle',
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
