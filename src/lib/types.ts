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
  password: string
  full_name: string
  role: UserRole
  company_id?: string | null
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
  sire_name: string | null
  sire_stud_code: string | null
  dam_tag_number: string | null
  status: AnimalStatus | null
  location: string | null
  notes: string | null
  created_at: string
  updated_at: string
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
  sire_name: string
  sire_stud_code: string
  dam_tag_number: string
  status: AnimalStatus | ''
  location: string
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
  sire_name: '',
  sire_stud_code: '',
  dam_tag_number: '',
  status: 'active',
  location: '',
  notes: '',
})

export function animalFormToPayload(form: AnimalFormData) {
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
    sire_name: opt(form.sire_name),
    sire_stud_code: opt(form.sire_stud_code),
    dam_tag_number: opt(form.dam_tag_number),
    status: form.status === '' ? null : form.status,
    location: opt(form.location),
    notes: opt(form.notes),
  }
}
