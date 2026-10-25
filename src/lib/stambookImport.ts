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
  updated: number
  unchanged: number
  skipped: number
  errors: string[]
  warnings: string[]
}

interface ExistingStambookAnimal {
  id: string
  stud_number: string | null
  id_year: string | null
  id_number: string | null
  sex: Animal['sex']
  birth_date: string | null
  dam_id: string | null
  sire_id: string | null
  dam_tag_number: string | null
  sire_name: string | null
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
  
  // Remove BBG, BBGF, BBGM prefixes and whitespace
  let cleaned = raw.trim()
    .replace(/^BBG[MF]?\s*/i, '')  // Remove BBG, BBGF, or BBGM prefix
    .replace(/\s+/g, '')  // Remove any spaces
  
  if (!cleaned || cleaned === '0') return null
  
  // Format after prefix removal: studNumber + year(2) + animalNumber(4)
  // Examples:
  //   1610170092 (10 digits) -> stud:1610, year:17, animal:0092
  //   93260001 (8 digits) -> stud:93, year:26, animal:0001 -> pad stud to 0093
  //   1637260016 (10 digits) -> stud:1637, year:26, animal:0016
  
  if (cleaned.length >= 6) {
    // Parse from the end: last 4 = animal, previous 2 = year, rest = stud
    const animalNumber = cleaned.slice(-4)
    const year = cleaned.slice(-6, -4)
    let studNumber = cleaned.slice(0, -6)
    
    // Pad stud number to 4 digits
    if (studNumber.length < 4) {
      studNumber = studNumber.padStart(4, '0')
    } else if (studNumber.length > 4) {
      // Take first 4 digits if longer
      studNumber = studNumber.slice(0, 4)
    }
    
    return {
      studNumber,
      year,
      animalNumber,
      fullTag: `${studNumber}-${year}-${animalNumber}`,
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

function isBlank(value: string | null | undefined) {
  return value == null || value.trim() === ''
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
        
        // Clean fields: remove surrounding quotes (handle multiple layers)
        const cleanFields = fields.map(f => {
          let cleaned = f.trim()
          // Remove surrounding quotes if present (may need to do this multiple times)
          while (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length > 1) {
            cleaned = cleaned.slice(1, -1)
          }
          return cleaned
        })
        
        // Set expected field count from first record (header)
        if (records.length === 0 && cleanFields.length > 10) {
          expectedFieldCount = cleanFields.length
          console.log('Expected field count set to:', expectedFieldCount)
        }
        
        // Only accept record if it has the exact field count as header
        if (records.length === 0 && cleanFields.length > 10) {
          // Always accept header
          records.push(cleanFields)
          currentRecordLines = []
        } else if (cleanFields.length === expectedFieldCount) {
          // Only accept data rows with exact match
          records.push(cleanFields)
          currentRecordLines = []
        } else {
          // Not the right field count yet
          if (records.length <= 2) {
            console.log(`Record ${records.length}: Got ${cleanFields.length} fields, expected ${expectedFieldCount}. Lines accumulated: ${currentRecordLines.length}`)
          }
          // Keep accumulating lines unless we've accumulated too many
          if (currentRecordLines.length > 10) {
            // Safety limit: give up and reset after 10 lines
            console.warn(`Gave up on record after 10 lines. Field count: ${cleanFields.length}, expected: ${expectedFieldCount}`)
            currentRecordLines = []
          }
          // else: keep accumulating, multi-line records need more lines
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
  // Helper to find column index (exact match, ignoring quotes/spaces/case)
  const findColumn = (name: string): number => {
    return header.findIndex(col => {
      const normalized = col.replace(/['"]/g, '').trim().toUpperCase()
      return normalized === name.toUpperCase()
    })
  }
  
  // Try both NID and ANIMAL_NUMBER columns to see which has the BBG prefix
  const nidIdx = findColumn('NID')
  const animalNumberIdx = findColumn('ANIMAL_NUMBER')
  const sexIdx = findColumn('SEX')
  const birthDateIdx = findColumn('BIRTH_DTM')
  
  // For parents, try both *_NID and *_ANIMAL_NUMBER columns
  const damNidIdx = findColumn('DAM_NID')
  const damAnimalNumberIdx = findColumn('DAM_ANIMAL_NUMBER')
  const sireNidIdx = findColumn('SIRE_NID')
  const sireAnimalNumberIdx = findColumn('SIRE_ANIMAL_NUMBER')
  
  // Debug: log column indices and first few header values
  console.log('Column indices found:', {
    nidIdx,
    animalNumberIdx,
    sexIdx,
    birthDateIdx,
    damNidIdx,
    damAnimalNumberIdx,
    sireNidIdx,
    sireAnimalNumberIdx,
    headerSample: header.slice(0, 15).map((h, i) => `${i}:${h}`)
  })
  
  // Need at least one animal ID column and sex
  if ((nidIdx === -1 && animalNumberIdx === -1) || sexIdx === -1) return rows
  
  // Determine which columns to use by checking first data row
  let animalIdIdx = -1
  let damIdIdx = -1
  let sireIdIdx = -1
  
  if (records.length > headerIndex + 1) {
    const firstDataRow = records[headerIndex + 1]
    
    // Auto-detect animal ID column
    const nidValue = nidIdx >= 0 ? firstDataRow[nidIdx] : ''
    const animalNumberValue = animalNumberIdx >= 0 ? firstDataRow[animalNumberIdx] : ''
    const nidHasPrefix = /^BBG[MF]?/i.test(nidValue)
    const animalNumberHasPrefix = /^BBG[MF]?/i.test(animalNumberValue)
    
    if (nidHasPrefix && !animalNumberHasPrefix) {
      animalIdIdx = nidIdx
    } else if (!nidHasPrefix && animalNumberHasPrefix) {
      animalIdIdx = animalNumberIdx
    } else if (nidIdx >= 0) {
      animalIdIdx = nidIdx
    } else {
      animalIdIdx = animalNumberIdx
    }
    
    // Auto-detect dam (mother) column
    const damNidValue = damNidIdx >= 0 ? firstDataRow[damNidIdx] : ''
    const damAnimalNumberValue = damAnimalNumberIdx >= 0 ? firstDataRow[damAnimalNumberIdx] : ''
    const damNidHasPrefix = /^BBG[MF]?/i.test(damNidValue)
    const damAnimalNumberHasPrefix = /^BBG[MF]?/i.test(damAnimalNumberValue)
    
    if (damNidHasPrefix && !damAnimalNumberHasPrefix) {
      damIdIdx = damNidIdx
    } else if (!damNidHasPrefix && damAnimalNumberHasPrefix) {
      damIdIdx = damAnimalNumberIdx
    } else if (damNidIdx >= 0) {
      damIdIdx = damNidIdx
    } else {
      damIdIdx = damAnimalNumberIdx
    }
    
    // Auto-detect sire (father) column
    const sireNidValue = sireNidIdx >= 0 ? firstDataRow[sireNidIdx] : ''
    const sireAnimalNumberValue = sireAnimalNumberIdx >= 0 ? firstDataRow[sireAnimalNumberIdx] : ''
    const sireNidHasPrefix = /^BBG[MF]?/i.test(sireNidValue)
    const sireAnimalNumberHasPrefix = /^BBG[MF]?/i.test(sireAnimalNumberValue)
    
    if (sireNidHasPrefix && !sireAnimalNumberHasPrefix) {
      sireIdIdx = sireNidIdx
    } else if (!sireNidHasPrefix && sireAnimalNumberHasPrefix) {
      sireIdIdx = sireAnimalNumberIdx
    } else if (sireNidIdx >= 0) {
      sireIdIdx = sireNidIdx
    } else {
      sireIdIdx = sireAnimalNumberIdx
    }
    
    console.log('Column detection results:', {
      animalId: { idx: animalIdIdx, value: firstDataRow[animalIdIdx]?.substring(0, 20) },
      dam: { idx: damIdIdx, value: firstDataRow[damIdIdx]?.substring(0, 20) },
      sire: { idx: sireIdIdx, value: firstDataRow[sireIdIdx]?.substring(0, 20) }
    })
  }
  
  // Parse data rows
  for (let i = headerIndex + 1; i < records.length; i++) {
    const record = records[i]
    if (record.length <= Math.max(animalIdIdx, sexIdx, birthDateIdx || 0, damIdIdx || 0, sireIdIdx || 0)) continue
    
    const animalNumber = record[animalIdIdx]?.trim()
    if (!animalNumber || animalNumber === '0') continue
    
    // Debug: log first record's fields
    if (rows.length === 0) {
      console.log('First record sample (indices 6-13):', {
        6: record[6],
        7: record[7],
        8: record[8],
        9: record[9],
        10: record[10],
        11: record[11],
        12: record[12],
        13: record[13],
      })
      console.log('Extracted values:', {
        animal: animalNumber,
        dam: damIdIdx >= 0 ? record[damIdIdx] : 'N/A',
        sire: sireIdIdx >= 0 ? record[sireIdIdx] : 'N/A'
      })
    }
    
    rows.push({
      animalNumber,
      sex: record[sexIdx]?.trim() || '',
      birthDate: birthDateIdx >= 0 ? record[birthDateIdx]?.trim() || '' : '',
      damAnimalNumber: damIdIdx >= 0 && record[damIdIdx]?.trim() ? record[damIdIdx].trim() : null,
      sireAnimalNumber: sireIdIdx >= 0 && record[sireIdIdx]?.trim() ? record[sireIdIdx].trim() : null,
    })
  }
  
  return rows
}

function prepareAnimal(row: StambookImportRow): ParsedAnimal | null {
  const parsed = parseAnimalNumber(row.animalNumber)
  if (!parsed) return null
  
  const damParsed = row.damAnimalNumber ? parseAnimalNumber(row.damAnimalNumber) : null
  const sireParsed = row.sireAnimalNumber ? parseAnimalNumber(row.sireAnimalNumber) : null
  
  // Debug specific animal
  if (parsed.fullTag === '1637-26-0009') {
    console.log('DEBUG: Parsing animal 1637-26-0009:', {
      rawAnimalNumber: row.animalNumber,
      parsed,
      rawDam: row.damAnimalNumber,
      damParsed,
      rawSire: row.sireAnimalNumber,
      sireParsed
    })
  }
  
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
    updated: 0,
    unchanged: 0,
    skipped: 0,
    errors: [],
    warnings: [],
  }
  
  // Get existing animals so empty pedigree and birth dates can be filled in.
  const { data: existingAnimals, error: fetchError } = await supabase
    .from('animals')
    .select('id, stud_number, id_year, id_number, sex, birth_date, dam_id, sire_id, dam_tag_number, sire_name')
    .eq('company_id', companyId)
  
  if (fetchError) {
    result.errors.push(`Failed to fetch existing animals: ${fetchError.message}`)
    return result
  }
  
  const existingByKey = new Map<string, ExistingStambookAnimal>()
  
  for (const animal of (existingAnimals || []) as ExistingStambookAnimal[]) {
    if (animal.stud_number && animal.id_year && animal.id_number) {
      const key = `${animal.stud_number}-${animal.id_year}-${animal.id_number}`.toUpperCase()
      existingByKey.set(key, animal)
    }
  }
  
  // Parse and prepare animals
  type ImportEntry = ParsedAnimal & { originalRow: number }
  const toCreate: ImportEntry[] = []
  const toFill: Array<ImportEntry & { existing: ExistingStambookAnimal }> = []
  const animalsByTag = new Map<string, ImportEntry>()
  
  for (let i = 0; i < rows.length; i++) {
    const parsed = prepareAnimal(rows[i])
    if (!parsed) {
      result.warnings.push(`Row ${i + 2}: Could not parse animal number "${rows[i].animalNumber}"`)
      result.skipped++
      continue
    }
    
    // Build unique key for checking existence
    const uniqueKey = `${parsed.studNumber}-${parsed.year}-${parsed.animalNumber}`.toUpperCase()
    
    // Check for duplicates within this import
    if (animalsByTag.has(uniqueKey)) {
      result.warnings.push(`Row ${i + 2}: Duplicate animal ${parsed.fullTag} in CSV, skipping`)
      result.skipped++
      continue
    }
    
    const entry = { ...parsed, originalRow: i + 2 }
    animalsByTag.set(uniqueKey, entry)
    const existing = existingByKey.get(uniqueKey)
    if (existing) toFill.push({ ...entry, existing })
    else toCreate.push(entry)
  }
  
  if (toCreate.length === 0 && toFill.length === 0) {
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

  // Parents that are not already on the farm become their own Stamboek animals.
  // Their birth date is unknown, so it stays blank.
  const parentsToCreate = new Map<string, {
    studNumber: string
    year: string
    animalNumber: string
    fullTag: string
    sex: 'male' | 'female'
    conflict: boolean
  }>()

  const queueParent = (
    stud: string | null,
    year: string | null,
    number: string | null,
    sex: 'male' | 'female',
    childKey: string,
  ) => {
    if (!stud || !year || !number) return
    const key = `${stud}-${year}-${number}`.toUpperCase()
    if (key === childKey || existingByKey.has(key) || animalsByTag.has(key)) return
    const current = parentsToCreate.get(key)
    if (!current) {
      parentsToCreate.set(key, {
        studNumber: stud,
        year,
        animalNumber: number,
        fullTag: `${stud}-${year}-${number}`,
        sex,
        conflict: false,
      })
      return
    }
    if (current.sex !== sex && !current.conflict) {
      current.conflict = true
      result.warnings.push(
        `Parent ${current.fullTag} is listed as both a mother and a father. Kept as ${current.sex}.`,
      )
    }
  }

  for (const entry of animalsByTag.values()) {
    const childKey = `${entry.studNumber}-${entry.year}-${entry.animalNumber}`.toUpperCase()
    queueParent(entry.damStudNumber, entry.damYear, entry.damAnimalNumber, 'female', childKey)
    queueParent(entry.sireStudNumber, entry.sireYear, entry.sireAnimalNumber, 'male', childKey)
  }

  const parentList = [...parentsToCreate.values()]
  let parentsCreated = 0
  for (let i = 0; i < parentList.length; i += batchSize) {
    const batch = parentList.slice(i, i + batchSize)
    const animalsToInsert = batch.map((parent) => ({
      company_id: companyId,
      created_by: createdBy,
      stud_number: parent.studNumber,
      id_year: parent.year,
      id_number: parent.animalNumber,
      tag_number: parent.fullTag,
      species: 'goat',
      sex: parent.sex,
      birth_date: null,
      status: 'stamboek' as const,
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('animals')
      .insert(animalsToInsert)
      .select('id')

    if (insertError) {
      result.errors.push(`Parents batch ${Math.floor(i / batchSize) + 1}: ${insertError.message}`)
      continue
    }

    parentsCreated += inserted?.length ?? 0
  }

  if (parentsCreated > 0) {
    result.created += parentsCreated
    result.warnings.push(
      `Created ${parentsCreated} parent animal${parentsCreated === 1 ? '' : 's'} as Stamboek records. Birth date left blank.`,
    )
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
  
  // Link parents, and fill empty birth dates on animals already in the system.
  let parentsLinked = 0
  let damIdsLinked = 0
  let sireIdsLinked = 0
  let damTagsSet = 0
  let sireNamesSet = 0
  let animalsWithParentInfo = 0

  const linkTargets: Array<{ original: ImportEntry; existing: ExistingStambookAnimal | null }> = [
    ...toCreate.map((original) => ({ original, existing: null })),
    ...toFill.map((item) => ({ original: item, existing: item.existing })),
  ]
  
  for (const { original, existing } of linkTargets) {
    const animalKey = `${original.studNumber}-${original.year}-${original.animalNumber}`.toUpperCase()
    const animalId = existing?.id ?? allAnimals.get(animalKey)
    if (!animalId) {
      result.warnings.push(`Row ${original.originalRow}: Could not find animal ${original.fullTag} to update`)
      continue
    }
    
    const updates: Partial<Animal> = {}
    const hasDamInfo = original.damStudNumber && original.damYear && original.damAnimalNumber
    const hasSireInfo = original.sireStudNumber && original.sireYear && original.sireAnimalNumber
    
    if (hasDamInfo || hasSireInfo) {
      animalsWithParentInfo++
    }

    if (existing && isBlank(existing.birth_date) && original.birthDate) {
      updates.birth_date = original.birthDate
    }
    if (existing && existing.sex == null && original.sex !== 'unknown') {
      updates.sex = original.sex
    }
    
    // Link dam when that pedigree field is still empty.
    if (hasDamInfo && (!existing || existing.dam_id == null || isBlank(existing.dam_tag_number))) {
      const damKey = `${original.damStudNumber}-${original.damYear}-${original.damAnimalNumber}`.toUpperCase()
      const damId = allAnimals.get(damKey) || null
      if (damId && (!existing || existing.dam_id == null)) {
        updates.dam_id = damId
        damIdsLinked++
      }
      if (!existing || isBlank(existing.dam_tag_number)) {
        updates.dam_tag_number = `${original.damYear}-${original.damAnimalNumber}`
        damTagsSet++
      }
    }
    
    // Link sire when that pedigree field is still empty.
    if (hasSireInfo && (!existing || existing.sire_id == null || isBlank(existing.sire_name))) {
      const sireKey = `${original.sireStudNumber}-${original.sireYear}-${original.sireAnimalNumber}`.toUpperCase()
      const sireId = allAnimals.get(sireKey) || null
      if (sireId && (!existing || existing.sire_id == null)) {
        updates.sire_id = sireId
        sireIdsLinked++
      }
      if (!existing || isBlank(existing.sire_name)) {
        updates.sire_name = `${original.sireStudNumber}-${original.sireYear}-${original.sireAnimalNumber}`
        sireNamesSet++
      }
    }
    
    // Debug specific animal
    if (original.fullTag === '1637-26-0009') {
      console.log('DEBUG: Linking parents for 1637-26-0009:', {
        animalId,
        hasDamInfo,
        hasSireInfo,
        damData: hasDamInfo ? {
          studNumber: original.damStudNumber,
          year: original.damYear,
          animalNumber: original.damAnimalNumber,
          damKey: `${original.damStudNumber}-${original.damYear}-${original.damAnimalNumber}`.toUpperCase(),
        } : null,
        sireData: hasSireInfo ? {
          studNumber: original.sireStudNumber,
          year: original.sireYear,
          animalNumber: original.sireAnimalNumber,
          sireKey: `${original.sireStudNumber}-${original.sireYear}-${original.sireAnimalNumber}`.toUpperCase(),
        } : null,
        updates
      })
    }
    
    // Nothing empty to fill in.
    if (Object.keys(updates).length === 0) {
      if (existing) result.unchanged++
      continue
    }
    
    const { error: updateError } = await supabase
      .from('animals')
      .update(updates)
      .eq('id', animalId)
    
    if (updateError) {
      const action = existing ? 'update' : 'link parents for'
      result.warnings.push(`Row ${original.originalRow}: Could not ${action} ${original.fullTag}: ${updateError.message}`)
    } else if (existing) {
      result.updated++
      if (updates.dam_id || updates.dam_tag_number || updates.sire_id || updates.sire_name) parentsLinked++
    } else {
      parentsLinked++
    }
  }
  
  // Add summary of parent linking
  if (animalsWithParentInfo === 0) {
    result.warnings.push(`⚠ No parent information found in CSV - check that DAM_NID and SIRE_NID columns exist and contain values`)
  } else {
    result.warnings.push(`Found parent info for ${animalsWithParentInfo} animal(s)`)
    if (parentsLinked > 0) {
      result.warnings.push(`✓ Updated parent links for ${parentsLinked} animal(s)`)
      if (damIdsLinked > 0 || sireIdsLinked > 0) {
        result.warnings.push(`  - Linked ${damIdsLinked} mother(s) and ${sireIdsLinked} father(s) to animals in database`)
      }
      if (damTagsSet > 0 || sireNamesSet > 0) {
        result.warnings.push(`  - Recorded ${damTagsSet} mother tag(s) and ${sireNamesSet} father name(s)`)
      }
    }
  }
  
  return result
}
