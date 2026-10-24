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
  studNumber: string
  year: string
  animalNumber: string
  fullTag: string
  sex: 'male' | 'female' | 'unknown'
  birthDate: string | null
  damStudNumber: string | null
  damYear: string | null
  damAnimalNumber: string | null
  sireStudNumber: string | null
  sireYear: string | null
  sireAnimalNumber: string | null
}

interface ParsedAnimalNumber {
  studNumber: string  // 4 digits, zero-padded
  year: string        // 2 digits
  animalNumber: string // 4 digits
  fullTag: string     // Combined year-number format
}

function parseAnimalNumber(raw: string): ParsedAnimalNumber | null {
  if (!raw) return null
  
  const cleaned = raw.trim()
  
  // Format: studNumber(4) + year(2) + animalNumber(4) = 10 digits total
  // Example: 0114780273 -> stud: 0114, year: 78, animal: 0273
  if (cleaned.length >= 10) {
    const studNumber = cleaned.slice(0, 4)
    const year = cleaned.slice(4, 6)
    const animalNumber = cleaned.slice(6, 10)
    
    return {
      studNumber,
      year,
      animalNumber,
      fullTag: `${year}-${animalNumber}`,
    }
  }
  
  // If less than 10 digits, try to parse from the end
  // Last 4: animal number, Previous 2: year, Rest: stud number (pad to 4)
  if (cleaned.length >= 6) {
    const animalNumber = cleaned.slice(-4)
    const year = cleaned.slice(-6, -4)
    let studNumber = cleaned.slice(0, -6)
    
    // Pad stud number to 4 digits
    if (studNumber.length < 4) {
      studNumber = studNumber.padStart(4, '0')
    } else if (studNumber.length > 4) {
      studNumber = studNumber.slice(0, 4)
    }
    
    return {
      studNumber,
      year,
      animalNumber,
      fullTag: `${year}-${animalNumber}`,
    }
  }
  
  return null
}

function parseSex(sex: string): 'male' | 'female' | 'unknown' {
  const normalized = sex.trim().toUpperCase()
  if (normalized === 'F') return 'female'
  if (normalized === 'M') return 'male'
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
  
  // This CSV uses comma delimiters with quoted fields and "" for escaping quotes
  // Handle multi-line records by tracking quote balance
  const lines = normalized.split('\n')
  const records: string[][] = []
  let currentRecordLines: string[] = []
  let expectedFieldCount = 0
  
  for (const line of lines) {
    currentRecordLines.push(line)
    
    // Count quotes to detect complete records (even count = potentially complete)
    const allLines = currentRecordLines.join('\n')
    let quoteCount = 0
    for (const char of allLines) {
      if (char === '"') quoteCount++
    }
    
    // Even number of quotes means record might be complete
    // But we need to verify by parsing it
    if (quoteCount % 2 === 0) {
      let recordLine = currentRecordLines.join('\n').trim()
      if (recordLine) {
        // Remove outer quotes if the entire record is wrapped
        if (recordLine.startsWith('"') && recordLine.endsWith('"')) {
          recordLine = recordLine.slice(1, -1)
        }
        
        // Parse CSV: comma-separated fields with "" escaping quotes
        const fields: string[] = []
        let currentField = ''
        let inQuotes = false
        let i = 0
        
        while (i < recordLine.length) {
          const char = recordLine[i]
          const nextChar = recordLine[i + 1]
          
          if (char === '"' && nextChar === '"') {
            // Escaped quote: "" becomes "
            currentField += '"'
            i += 2
          } else if (char === '"') {
            // Toggle quote mode
            inQuotes = !inQuotes
            i++
          } else if (char === ',' && !inQuotes) {
            // Field separator
            fields.push(currentField.trim())
            currentField = ''
            i++
          } else {
            // Regular character
            currentField += char
            i++
          }
        }
        
        // Add last field
        if (currentField || fields.length > 0) {
          fields.push(currentField.trim())
        }
        
        // Clean fields: remove surrounding quotes
        const cleanFields = fields.map(f => {
          let cleaned = f.trim()
          // Remove surrounding quotes if present
          if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            cleaned = cleaned.slice(1, -1)
          }
          return cleaned
        })
        
        // Set expected field count from first record (header)
        if (records.length === 0 && cleanFields.length > 10) {
          expectedFieldCount = cleanFields.length
        }
        
        // Only accept record if it has enough fields
        // First record sets the standard, subsequent records should match (or be close)
        if (cleanFields.length > 1) {
          if (records.length === 0 || cleanFields.length >= expectedFieldCount * 0.8) {
            records.push(cleanFields)
            currentRecordLines = []
          }
          // else: not enough fields yet, keep accumulating lines (don't reset)
        } else {
          currentRecordLines = []
        }
      }
      // else: odd quote count, keep accumulating
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
  // Use ANIMAL_NUMBER column for the numeric IDs (format: studNumber+year+animalNumber)
  const animalNumberIdx = header.findIndex(col => col === 'ANIMAL_NUMBER')
  const sexIdx = header.findIndex(col => col === 'SEX')
  const birthDateIdx = header.findIndex(col => col === 'BIRTH_DTM')
  
  // For parents, use *_ANIMAL_NUMBER columns (same numeric format)
  const damNumberIdx = header.findIndex(col => col === 'DAM_ANIMAL_NUMBER')
  const sireNumberIdx = header.findIndex(col => col === 'SIRE_ANIMAL_NUMBER')
  
  if (animalNumberIdx === -1 || sexIdx === -1) return rows
  
  // Parse data rows
  for (let i = headerIndex + 1; i < records.length; i++) {
    const record = records[i]
    if (record.length <= Math.max(animalNumberIdx, sexIdx, birthDateIdx || 0, damNumberIdx || 0, sireNumberIdx || 0)) continue
    
    const animalNumber = record[animalNumberIdx]?.trim()
    if (!animalNumber || animalNumber === '0') continue
    
    rows.push({
      animalNumber,
      sex: record[sexIdx]?.trim() || '',
      birthDate: birthDateIdx >= 0 ? record[birthDateIdx]?.trim() || '' : '',
      damAnimalNumber: damNumberIdx >= 0 && record[damNumberIdx]?.trim() ? record[damNumberIdx].trim() : null,
      sireAnimalNumber: sireNumberIdx >= 0 && record[sireNumberIdx]?.trim() ? record[sireNumberIdx].trim() : null,
    })
  }
  
  return rows
}

function prepareAnimal(row: StambookImportRow): ParsedAnimal | null {
  const parsed = parseAnimalNumber(row.animalNumber)
  if (!parsed) return null
  
  const damParsed = row.damAnimalNumber ? parseAnimalNumber(row.damAnimalNumber) : null
  const sireParsed = row.sireAnimalNumber ? parseAnimalNumber(row.sireAnimalNumber) : null
  
  return {
    studNumber: parsed.studNumber,
    year: parsed.year,
    animalNumber: parsed.animalNumber,
    fullTag: parsed.fullTag,
    sex: parseSex(row.sex),
    birthDate: parseBirthDate(row.birthDate),
    damStudNumber: damParsed?.studNumber || null,
    damYear: damParsed?.year || null,
    damAnimalNumber: damParsed?.animalNumber || null,
    sireStudNumber: sireParsed?.studNumber || null,
    sireYear: sireParsed?.year || null,
    sireAnimalNumber: sireParsed?.animalNumber || null,
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
    .select('id, stud_number, id_year, id_number, tag_number')
    .eq('company_id', companyId)
  
  if (fetchError) {
    result.errors.push(`Failed to fetch existing animals: ${fetchError.message}`)
    return result
  }
  
  const existingKeys = new Set<string>()
  
  for (const animal of existingAnimals || []) {
    if (animal.stud_number && animal.id_year && animal.id_number) {
      const key = `${animal.stud_number}-${animal.id_year}-${animal.id_number}`.toUpperCase()
      existingKeys.add(key)
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
    
    // Build unique key for checking existence
    const uniqueKey = `${parsed.studNumber}-${parsed.year}-${parsed.animalNumber}`.toUpperCase()
    
    // Check if already exists
    if (existingKeys.has(uniqueKey)) {
      result.skipped++
      continue
    }
    
    // Check for duplicates within this import
    if (animalsByTag.has(uniqueKey)) {
      result.warnings.push(`Row ${i + 2}: Duplicate animal ${parsed.fullTag} in CSV, skipping`)
      result.skipped++
      continue
    }
    
    const entry = { ...parsed, originalRow: i + 2 }
    toCreate.push(entry)
    animalsByTag.set(uniqueKey, entry)
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
      stud_number: animal.studNumber,
      id_year: animal.year,
      id_number: animal.animalNumber,
      tag_number: animal.fullTag,
      species: 'goat',
      sex: animal.sex,
      birth_date: animal.birthDate,
      status: 'stamboek' as const,
    }))
    
    const { data: inserted, error: insertError } = await supabase
      .from('animals')
      .insert(animalsToInsert)
      .select('id, stud_number, id_year, id_number, tag_number')
    
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
  // Build a map of all animals by their unique identifiers
  // Re-fetch created animals with all fields we need
  const { data: allAnimalsList } = await supabase
    .from('animals')
    .select('id, stud_number, id_year, id_number, tag_number')
    .eq('company_id', companyId)
  
  const allAnimals = new Map<string, string>() // unique key -> id
  
  for (const animal of allAnimalsList || []) {
    if (animal.stud_number && animal.id_year && animal.id_number) {
      const key = `${animal.stud_number}-${animal.id_year}-${animal.id_number}`.toUpperCase()
      allAnimals.set(key, animal.id)
    }
  }
  
  // Link parents
  for (const original of toCreate) {
    const animalKey = `${original.studNumber}-${original.year}-${original.animalNumber}`.toUpperCase()
    const animalId = allAnimals.get(animalKey)
    if (!animalId) continue
    
    let damId: string | null = null
    let sireId: string | null = null
    
    if (original.damStudNumber && original.damYear && original.damAnimalNumber) {
      const damKey = `${original.damStudNumber}-${original.damYear}-${original.damAnimalNumber}`.toUpperCase()
      damId = allAnimals.get(damKey) || null
    }
    
    if (original.sireStudNumber && original.sireYear && original.sireAnimalNumber) {
      const sireKey = `${original.sireStudNumber}-${original.sireYear}-${original.sireAnimalNumber}`.toUpperCase()
      sireId = allAnimals.get(sireKey) || null
    }
    
    if (!damId && !sireId) continue
    
    const updates: Partial<Animal> = {}
    if (damId) {
      updates.dam_id = damId
      updates.dam_tag_number = `${original.damYear}-${original.damAnimalNumber}`
    }
    if (sireId) {
      updates.sire_id = sireId
    }
    
    const { error: updateError } = await supabase
      .from('animals')
      .update(updates)
      .eq('id', animalId)
    
    if (updateError) {
      result.warnings.push(`Row ${original.originalRow}: Created ${original.fullTag} but could not link parents: ${updateError.message}`)
    }
  }
  
  return result
}
