import { supabase } from './supabase'
import type { Animal, FarmBackup } from './types'
import {
  formatAnimalId,
  formatAnimalSex,
  formatAnimalStatus,
  formatSpecies,
  formatTagNumber,
} from './animals'
import { rowsToCsv } from './exportCsv'

const BUCKET = 'farm-backups'

const headers = [
  'Record id',
  'Animal ID',
  'Stud number',
  'Year',
  'Number',
  'Tag number',
  'Name',
  'Species',
  'Breed',
  'Sex',
  'Birth date',
  'Color / markings',
  'Studbook number',
  'Studbook schedule',
  'Selection',
  'Electronic ID',
  'Status',
  'Sale price',
  'Sold on',
  'Buyer name',
  'Buyer surname',
  'Sale notes',
  'Location',
  'Camp',
  'Dam ID',
  'Dam tag',
  'Sire ID',
  'Sire tag',
  'Sire name',
  'Sire stud code',
  'Notes',
]

function backupFileName(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `animals-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.csv`
}

function placeParts(animal: Animal) {
  const camp = Array.isArray(animal.encampments) ? animal.encampments[0] : animal.encampments
  const location = Array.isArray(camp?.locations) ? camp.locations[0] : camp?.locations
  return {
    location: location?.name?.trim() || animal.location?.trim() || '',
    camp: camp?.name?.trim() || '',
  }
}

function animalsToCsv(animals: Animal[]) {
  const byId = new Map(animals.map((animal) => [animal.id, animal]))
  const rows = [...animals]
    .sort((a, b) => (formatAnimalId(a) ?? '').localeCompare(formatAnimalId(b) ?? ''))
    .map((animal) => {
      const dam = animal.dam_id ? byId.get(animal.dam_id) : undefined
      const sire = animal.sire_id ? byId.get(animal.sire_id) : undefined
      const place = placeParts(animal)
      return [
        animal.id,
        formatAnimalId(animal) ?? '',
        animal.stud_number,
        animal.id_year,
        animal.id_number,
        formatTagNumber(animal) ?? '',
        animal.name,
        animal.species ? formatSpecies(animal.species) : '',
        animal.breed,
        animal.sex ? formatAnimalSex(animal.sex) : '',
        animal.birth_date,
        animal.color_markings,
        animal.studbook_number,
        animal.studbook_schedule,
        animal.selection,
        animal.electronic_id,
        animal.status ? formatAnimalStatus(animal.status) : '',
        animal.sale_price ?? '',
        animal.sold_on,
        animal.buyer_name,
        animal.buyer_surname,
        animal.sale_notes,
        place.location,
        place.camp,
        formatAnimalId(dam) ?? '',
        formatTagNumber(dam) || animal.dam_tag_number || '',
        formatAnimalId(sire) ?? '',
        formatTagNumber(sire) ?? '',
        animal.sire_name,
        animal.sire_stud_code,
        animal.notes,
      ]
    })

  return rowsToCsv(headers, rows)
}

export async function fetchFarmBackups(companyId: string) {
  const { data, error } = await supabase
    .from('farm_backups')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as FarmBackup[]).map((backup) => ({
    ...backup,
    file_size: backup.file_size == null ? null : Number(backup.file_size),
    animal_count: Number(backup.animal_count),
  }))
}

export async function createAnimalBackup(companyId: string, userId: string) {
  const { data, error } = await supabase
    .from('animals')
    .select('*, encampments(id, name, location_id, locations(id, name))')
    .eq('company_id', companyId)

  if (error) throw error

  const animals = (data ?? []) as Animal[]
  const csv = animalsToCsv(animals)
  const backupId = crypto.randomUUID()
  const fileName = backupFileName()
  const storagePath = `${companyId}/${backupId}.csv`
  const file = new Blob([csv], { type: 'text/csv' })

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    contentType: 'text/csv',
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { data: row, error: insertError } = await supabase
    .from('farm_backups')
    .insert({
      id: backupId,
      company_id: companyId,
      created_by: userId,
      storage_path: storagePath,
      file_name: fileName,
      file_size: file.size,
      animal_count: animals.length,
    })
    .select('*')
    .single()

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    throw insertError
  }

  const saved = row as FarmBackup
  return {
    ...saved,
    file_size: saved.file_size == null ? null : Number(saved.file_size),
    animal_count: Number(saved.animal_count),
  }
}

export async function downloadFarmBackup(backup: Pick<FarmBackup, 'storage_path' | 'file_name'>) {
  const { data, error } = await supabase.storage.from(BUCKET).download(backup.storage_path)
  if (error) throw error
  if (!data) throw new Error('Backup file is missing.')

  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = backup.file_name
  link.click()
  URL.revokeObjectURL(url)
}

export async function deleteFarmBackup(backup: Pick<FarmBackup, 'id' | 'storage_path'>) {
  const { error } = await supabase.from('farm_backups').delete().eq('id', backup.id)
  if (error) throw error
  await supabase.storage.from(BUCKET).remove([backup.storage_path])
}
