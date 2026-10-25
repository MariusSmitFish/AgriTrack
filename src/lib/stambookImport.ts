import { supabase } from './supabase'
import type { Animal } from './types'

export interface StambookImportRow {
  animalNumber: string
  sex: string
  birthDate: string
  damAnimalNumber: string | null
  sireAnimalNumber: string | null
  studbookNumber: string | null
  studbookSchedule: 'A' | 'B' | 'SP' | null
  breed: string | null
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
  studbook_number: string | null
  studbook_schedule: Animal['studbook_schedule']
  breed: string | null
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
  studbookNumber: string | null
  studbookSchedule: 'A' | 'B' | 'SP' | null
  breed: string | null
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

/** Quoted kraalkaart rows keep the farm address on several lines. */
function parseCsvRecords(csvContent: string): string[][] {
  const input = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    const next = input[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      record.push(field.trim())
      field = ''
    } else if (char === '\n') {
      record.push(field.trim())
      if (record.some((cell) => cell !== '')) records.push(record)
      record = []
      field = ''
    } else {
      field += char
    }
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field.trim())
    if (record.some((cell) => cell !== '')) records.push(record)
  }

  return records
}

function csvCell(record: string[], index: number) {
  if (index < 0) return ''
  return record[index]?.trim() ?? ''
}

function missingId(value: string) {
  const trimmed = value.trim()
  return !trimmed || trimmed === '-' || trimmed === '0'
}

function preferStudId(primary: string, fallback: string) {
  if (!missingId(primary) && /^BBG/i.test(primary)) return primary
  if (!missingId(fallback) && /^BBG/i.test(fallback)) return fallback
  if (!missingId(primary)) return primary
  if (!missingId(fallback)) return fallback
  return ''
}

function parseSchedule(value: string): 'A' | 'B' | 'SP' | null {
  const schedule = value.trim().toUpperCase()
  if (schedule === 'A' || schedule === 'B' || schedule === 'SP') return schedule
  return null
}

export function parseStambookCsv(csvContent: string): StambookImportRow[] {
  const records = parseCsvRecords(csvContent)
  const headerIndex = records.findIndex(
    (record) => record.some((field) => field.toUpperCase() === 'SEX') &&
      (record.some((field) => field.toUpperCase() === 'NID') ||
        record.some((field) => field.toUpperCase() === 'ANIMAL_NUMBER')),
  )
  if (headerIndex === -1) return []

  const header = records[headerIndex]
  const findColumn = (name: string) =>
    header.findIndex((column) => column.replace(/['"]/g, '').trim().toUpperCase() === name)

  const nidIdx = findColumn('NID')
  const animalNumberIdx = findColumn('ANIMAL_NUMBER')
  const sexIdx = findColumn('SEX')
  const birthIdx = findColumn('BIRTH_DTM')
  const birthSortIdx = findColumn('BD_SORT')
  const damNidIdx = findColumn('DAM_NID')
  const damNumberIdx = findColumn('DAM_ANIMAL_NUMBER')
  const sireNidIdx = findColumn('SIRE_NID')
  const sireNumberIdx = findColumn('SIRE_ANIMAL_NUMBER')
  const studbookIdx = findColumn('ANI_ID')
  const scheduleIdx = findColumn('SEC')
  const breedIdx = findColumn('BREED_CODE')

  if (sexIdx === -1 || (nidIdx === -1 && animalNumberIdx === -1)) return []

  const rows: StambookImportRow[] = []
  for (const record of records.slice(headerIndex + 1)) {
    const animalNumber = preferStudId(csvCell(record, nidIdx), csvCell(record, animalNumberIdx))
    if (!animalNumber) continue

    const birthDate = csvCell(record, birthIdx) || csvCell(record, birthSortIdx)
    const dam = preferStudId(csvCell(record, damNidIdx), csvCell(record, damNumberIdx))
    const sire = preferStudId(csvCell(record, sireNidIdx), csvCell(record, sireNumberIdx))
    const studbookNumber = csvCell(record, studbookIdx).replace(/\s+/g, '')

    rows.push({
      animalNumber,
      sex: csvCell(record, sexIdx),
      birthDate,
      damAnimalNumber: dam || null,
      sireAnimalNumber: sire || null,
      studbookNumber: studbookNumber && studbookNumber !== '0' ? studbookNumber : null,
      studbookSchedule: parseSchedule(csvCell(record, scheduleIdx)),
      breed: csvCell(record, breedIdx) || null,
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
    studbookNumber: row.studbookNumber,
    studbookSchedule: row.studbookSchedule,
    breed: row.breed,
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
    .select('id, stud_number, id_year, id_number, sex, birth_date, dam_id, sire_id, dam_tag_number, sire_name, studbook_number, studbook_schedule, breed')
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
      breed: animal.breed,
      studbook_number: animal.studbookNumber,
      studbook_schedule: animal.studbookSchedule,
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
    if (existing && isBlank(existing.studbook_number) && original.studbookNumber) {
      updates.studbook_number = original.studbookNumber
    }
    if (existing && isBlank(existing.studbook_schedule) && original.studbookSchedule) {
      updates.studbook_schedule = original.studbookSchedule
    }
    if (existing && isBlank(existing.breed) && original.breed) {
      updates.breed = original.breed
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
