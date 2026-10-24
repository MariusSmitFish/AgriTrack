import { supabase } from './supabase'
import type { Animal } from './types'

export interface StambookImportRow {
  animalNumber: string
  sex: string
  birthDate: string
  damAnimalNumber: string | null
  sireAnimalNumber: string | null
}

export interface StambookImportResult {
  created: number
  skipped: number
  errors: string[]
  warnings: string[]
}

interface ParsedAnimal {
  tag: string
  sex: 'male' | 'female' | 'unknown'
  birthDate: string | null
  damTag: string | null
  sireTag: string | null
}

function normalizeAnimalNumber(raw: string): string | null {
  if (!raw) return null
  // Remove leading zeros and common prefixes
  const cleaned = raw.trim().replace(/^0+/, '')
  // Extract the actual animal number (e.g., BBGF1637180045, BBGM1637230200)
  const match = cleaned.match(/(BBG[MF]?\s*\d+)/i)
  if (match) {
    return match[1].replace(/\s+/g, '').toUpperCase()
  }
  return cleaned || null
}

function parseSex(sex: string): 'male' | 'female' | 'unknown' {
  const normalized = sex.trim().toUpperCase()
  if (normalized === 'F' || normalized === 'FEMALE') return 'female'
  if (normalized === 'M' || normalized === 'MALE') return 'male'
  return 'unknown'
}

function parseBirthDate(dateStr: string): string | null {
  if (!dateStr) return null
  
  // Handle ISO format: 2026-04-07
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return dateStr.substring(0, 10)
  
  // Handle formats like "07-APR-26"
  const monthMap: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
  }
  
  const ddMmmYy = dateStr.match(/(\d{2})-([A-Z]{3})-(\d{2})/)
  if (ddMmmYy) {
    const [, day, monthAbbr, year] = ddMmmYy
    const month = monthMap[monthAbbr]
    if (!month) return null
    // Assume years 00-49 are 2000s, 50-99 are 1900s
    const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`
    return `${fullYear}-${month}-${day}`
  }
  
  return null
}

export function parseStambookCsv(csvContent: string): StambookImportRow[] {
  const rows: StambookImportRow[] = []
  
  // Normalize line endings
  let normalized = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  
  // This CSV format uses "," as field delimiter and "" for escaping quotes
  // Split on newlines first, then handle multi-line records
  const lines = normalized.split('\n')
  const records: string[][] = []
  let currentRecordLines: string[] = []
  let inQuote = false
  
  for (const line of lines) {
    currentRecordLines.push(line)
    
    // Count quotes in all accumulated lines
    const allLines = currentRecordLines.join('\n')
    let quoteCount = 0
    for (const char of allLines) {
      if (char === '"') quoteCount++
    }
    
    // If even number of quotes, record is complete
    if (quoteCount % 2 === 0) {
      const recordLine = currentRecordLines.join('\n')
      if (recordLine.trim()) {
        // Split by "," pattern - field separator in this format
        const fields: string[] = []
        let i = 0
        while (i < recordLine.length) {
          // Skip leading quote
          if (recordLine[i] === '"') i++
          
          let field = ''
          while (i < recordLine.length) {
            if (recordLine[i] === '"' && recordLine[i + 1] === '"') {
              // Escaped quote
              field += '"'
              i += 2
            } else if (recordLine[i] === '"' && recordLine[i + 1] === ',' && recordLine[i + 2] === '"') {
              // End of field: ","
              i += 3
              break
            } else if (recordLine[i] === '"' && i + 1 >= recordLine.length) {
              // End of line/record
              i++
              break
            } else {
              field += recordLine[i]
              i++
            }
          }
          
          fields.push(field.trim())
        }
        
        if (fields.length > 0) {
          records.push(fields)
        }
      }
      currentRecordLines = []
    }
  }
  
  if (records.length === 0) return rows
  
  // Find header
  let headerIndex = -1
  for (let i = 0; i < Math.min(records.length, 5); i++) {
    const record = records[i]
    if (record.some(field => field === 'ANIMAL_NUMBER') && 
        record.some(field => field === 'SEX')) {
      headerIndex = i
      break
    }
  }
  
  if (headerIndex === -1) return rows
  
  const header = records[headerIndex]
  const animalNumberIdx = header.findIndex(col => col === 'ANIMAL_NUMBER')
  const sexIdx = header.findIndex(col => col === 'SEX')
  const birthDateIdx = header.findIndex(col => col === 'BIRTH_DTM')
  const damIdx = header.findIndex(col => col === 'DAM_ANIMAL_NUMBER')
  const sireIdx = header.findIndex(col => col === 'SIRE_ANIMAL_NUMBER')
  
  if (animalNumberIdx === -1 || sexIdx === -1) return rows
  
  // Parse data rows
  for (let i = headerIndex + 1; i < records.length; i++) {
    const record = records[i]
    if (record.length <= Math.max(animalNumberIdx, sexIdx, birthDateIdx || 0, damIdx || 0, sireIdx || 0)) continue
    
    const animalNumber = record[animalNumberIdx]?.trim()
    if (!animalNumber || animalNumber === '0') continue
    
    rows.push({
      animalNumber,
      sex: record[sexIdx]?.trim() || '',
      birthDate: birthDateIdx >= 0 ? record[birthDateIdx]?.trim() || '' : '',
      damAnimalNumber: damIdx >= 0 && record[damIdx]?.trim() ? record[damIdx].trim() : null,
      sireAnimalNumber: sireIdx >= 0 && record[sireIdx]?.trim() ? record[sireIdx].trim() : null,
    })
  }
  
  return rows
}

function prepareAnimal(row: StambookImportRow): ParsedAnimal | null {
  const tag = normalizeAnimalNumber(row.animalNumber)
  if (!tag) return null
  
  return {
    tag,
    sex: parseSex(row.sex),
    birthDate: parseBirthDate(row.birthDate),
    damTag: normalizeAnimalNumber(row.damAnimalNumber || ''),
    sireTag: normalizeAnimalNumber(row.sireAnimalNumber || ''),
  }
}

export async function importStambookAnimals(
  companyId: string,
  createdBy: string,
  rows: StambookImportRow[],
): Promise<StambookImportResult> {
  const result: StambookImportResult = {
    created: 0,
    skipped: 0,
    errors: [],
    warnings: [],
  }
  
  // Get existing animals to check for duplicates
  const { data: existingAnimals, error: fetchError } = await supabase
    .from('animals')
    .select('id, tag_number, stud_tag_number, studbook_number')
    .eq('company_id', companyId)
  
  if (fetchError) {
    result.errors.push(`Failed to fetch existing animals: ${fetchError.message}`)
    return result
  }
  
  const existingTags = new Set<string>()
  const existingById = new Map<string, Animal>()
  
  for (const animal of existingAnimals || []) {
    if (animal.tag_number) existingTags.add(animal.tag_number.toUpperCase())
    if (animal.stud_tag_number) existingTags.add(animal.stud_tag_number.toUpperCase())
    if (animal.studbook_number) {
      existingTags.add(animal.studbook_number.toUpperCase())
      existingById.set(animal.studbook_number.toUpperCase(), animal as Animal)
    }
  }
  
  // Parse and prepare animals
  const toCreate: Array<ParsedAnimal & { originalRow: number }> = []
  const animalsByTag = new Map<string, ParsedAnimal & { originalRow: number }>()
  
  for (let i = 0; i < rows.length; i++) {
    const parsed = prepareAnimal(rows[i])
    if (!parsed) {
      result.warnings.push(`Row ${i + 2}: Could not parse animal number "${rows[i].animalNumber}"`)
      result.skipped++
      continue
    }
    
    // Check if already exists
    if (existingTags.has(parsed.tag.toUpperCase())) {
      result.skipped++
      continue
    }
    
    // Check for duplicates within this import
    if (animalsByTag.has(parsed.tag.toUpperCase())) {
      result.warnings.push(`Row ${i + 2}: Duplicate animal ${parsed.tag} in CSV, skipping`)
      result.skipped++
      continue
    }
    
    const entry = { ...parsed, originalRow: i + 2 }
    toCreate.push(entry)
    animalsByTag.set(parsed.tag.toUpperCase(), entry)
  }
  
  if (toCreate.length === 0) {
    return result
  }
  
  // Create animals in batches
  const batchSize = 100
  const createdAnimals: Animal[] = []
  
  for (let i = 0; i < toCreate.length; i += batchSize) {
    const batch = toCreate.slice(i, i + batchSize)
    const animalsToInsert = batch.map(animal => ({
      company_id: companyId,
      created_by: createdBy,
      studbook_number: animal.tag,
      tag_number: animal.tag,
      species: 'goat',
      sex: animal.sex,
      birth_date: animal.birthDate,
      status: 'stamboek' as const,
    }))
    
    const { data: inserted, error: insertError } = await supabase
      .from('animals')
      .insert(animalsToInsert)
      .select('id, tag_number, studbook_number')
    
    if (insertError) {
      result.errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${insertError.message}`)
      continue
    }
    
    if (inserted) {
      createdAnimals.push(...(inserted as Animal[]))
      result.created += inserted.length
    }
  }
  
  // Now link parents
  // Build a map of all animals (existing + newly created)
  const allAnimals = new Map<string, string>() // tag -> id
  
  for (const animal of existingAnimals || []) {
    if (animal.tag_number) allAnimals.set(animal.tag_number.toUpperCase(), animal.id)
    if (animal.stud_tag_number) allAnimals.set(animal.stud_tag_number.toUpperCase(), animal.id)
    if (animal.studbook_number) allAnimals.set(animal.studbook_number.toUpperCase(), animal.id)
  }
  
  for (const animal of createdAnimals) {
    if (animal.studbook_number) allAnimals.set(animal.studbook_number.toUpperCase(), animal.id)
    if (animal.tag_number) allAnimals.set(animal.tag_number.toUpperCase(), animal.id)
  }
  
  // Link parents
  for (const created of createdAnimals) {
    const tag = created.studbook_number || created.tag_number
    if (!tag) continue
    
    const original = animalsByTag.get(tag.toUpperCase())
    if (!original) continue
    
    const damId = original.damTag ? allAnimals.get(original.damTag.toUpperCase()) : null
    const sireId = original.sireTag ? allAnimals.get(original.sireTag.toUpperCase()) : null
    
    if (!damId && !sireId) continue
    
    const updates: Partial<Animal> = {}
    if (damId) {
      updates.dam_id = damId
      updates.dam_tag_number = original.damTag
    }
    if (sireId) {
      updates.sire_id = sireId
    }
    
    const { error: updateError } = await supabase
      .from('animals')
      .update(updates)
      .eq('id', created.id)
    
    if (updateError) {
      result.warnings.push(`Row ${original.originalRow}: Created ${tag} but could not link parents: ${updateError.message}`)
    }
  }
  
  return result
}
