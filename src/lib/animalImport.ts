import {
  animalLabel,
  formatAnimalId,
  formatTagNumber,
  normalizeTagNumber,
} from './animals'
import {
  animalFormToPayload,
  emptyAnimalForm,
  type Animal,
  type AnimalFormData,
  type AnimalSelection,
  type AnimalSex,
  type AnimalStatus,
  type Encampment,
  type FarmLocation,
  type StudbookSchedule,
} from './types'

const TEMPLATE_ROWS = 400

export const animalImportColumns = [
  { header: 'Stud number', field: 'stud_number', width: 16, hint: 'Optional. Up to 4 digits, for example 0001. The column is text so leading zeros stay.' },
  { header: 'Year', field: 'id_year', width: 12, hint: '2 digits, for example 01. Required when Tag number is blank.' },
  { header: 'Number', field: 'id_number', width: 14, hint: 'Up to 4 digits, for example 1000. Required when Tag number is blank.' },
  { header: 'Tag number', field: 'tag_number', width: 16, hint: 'Year-number, for example 01-1000. Fill this or Year and Number.' },
  { header: 'Name', field: 'name', width: 22, hint: 'Optional nickname.' },
  { header: 'Species', field: 'species', width: 14, hint: 'Goat, Cattle, Sheep, or Other. Blank becomes Goat.' },
  { header: 'Breed', field: 'breed', width: 18, hint: 'Optional, for example Boer goat.' },
  { header: 'Sex', field: 'sex', width: 14, hint: 'Female, Male, or Unknown.' },
  { header: 'Birth date', field: 'birth_date', width: 16, hint: 'YYYY-MM-DD or DD/MM/YYYY.' },
  { header: 'Color / markings', field: 'color_markings', width: 24, hint: 'Optional, for example Black white face.' },
  { header: 'Studbook number', field: 'studbook_number', width: 18, hint: 'Optional digits.' },
  { header: 'Studbook schedule', field: 'studbook_schedule', width: 20, hint: 'Base, A, B, or SP.' },
  { header: 'Selection', field: 'selection', width: 14, hint: 'F, FC, FR, FT, or Stud.' },
  { header: 'Electronic ID', field: 'electronic_id', width: 18, hint: 'Optional ear-tag chip number.' },
  { header: 'Status', field: 'status', width: 14, hint: 'Active, Sold, Deceased, Transferred, or Stamboek. Blank becomes Active.' },
  { header: 'Location', field: 'location', width: 20, hint: 'Must match a location already on the farm.' },
  { header: 'Camp', field: 'camp', width: 18, hint: 'Must match a camp at that location.' },
  { header: 'Dam tag', field: 'dam_tag', width: 16, hint: 'Mother tag, for example 01-1000. She can be in this file.' },
  { header: 'Sire tag', field: 'sire_tag', width: 16, hint: 'Father tag. He can be in this file.' },
  { header: 'Sire name', field: 'sire_name', width: 20, hint: 'Optional when the father is not on the farm.' },
  { header: 'Sire stud code', field: 'sire_stud_code', width: 18, hint: 'Optional stud code for an outside father.' },
  { header: 'Notes', field: 'notes', width: 28, hint: 'Optional.' },
] as const

type ImportField = (typeof animalImportColumns)[number]['field']

const HEADER_FIELDS: Record<string, ImportField> = {
  tag: 'tag_number',
  eid: 'electronic_id',
  'electronic id': 'electronic_id',
  colour: 'color_markings',
  color: 'color_markings',
  'colour markings': 'color_markings',
  'color markings': 'color_markings',
  encampment: 'camp',
  'mother tag': 'dam_tag',
  dam: 'dam_tag',
  mother: 'dam_tag',
  sire: 'sire_tag',
  father: 'sire_tag',
  'father tag': 'sire_tag',
  dob: 'birth_date',
  'date of birth': 'birth_date',
  'birthdate': 'birth_date',
}

for (const column of animalImportColumns) {
  HEADER_FIELDS[normalizeHeader(column.header)] = column.field
}

const SEX_VALUES: Record<string, AnimalSex> = {
  female: 'female',
  f: 'female',
  doe: 'female',
  ewe: 'female',
  cow: 'female',
  heifer: 'female',
  male: 'male',
  m: 'male',
  buck: 'male',
  ram: 'male',
  bull: 'male',
  unknown: 'unknown',
  u: 'unknown',
}

const SPECIES_VALUES: Record<string, string> = {
  goat: 'goat',
  goats: 'goat',
  cattle: 'cattle',
  cow: 'cattle',
  cows: 'cattle',
  sheep: 'sheep',
  other: 'other',
}

const STATUS_VALUES: Record<string, AnimalStatus> = {
  active: 'active',
  sold: 'sold',
  deceased: 'deceased',
  dead: 'deceased',
  transferred: 'transferred',
  stamboek: 'stamboek',
}

const SCHEDULE_VALUES: Record<string, StudbookSchedule> = {
  base: 'Base',
  a: 'A',
  b: 'B',
  sp: 'SP',
}

const SELECTION_VALUES: Record<string, AnimalSelection> = {
  f: 'F',
  fc: 'FC',
  fr: 'FR',
  ft: 'FT',
  stud: 'Stud',
}

const LIST_COLUMNS: { field: ImportField; formula: string }[] = [
  { field: 'species', formula: '"Goat,Cattle,Sheep,Other"' },
  { field: 'sex', formula: '"Female,Male,Unknown"' },
  { field: 'studbook_schedule', formula: '"Base,A,B,SP"' },
  { field: 'selection', formula: '"F,FC,FR,FT,Stud"' },
  { field: 'status', formula: '"Active,Sold,Deceased,Transferred,Stamboek"' },
]

export interface AnimalImportContext {
  locations: FarmLocation[]
  encampments: Encampment[]
  existing: Pick<Animal, 'id' | 'stud_number' | 'id_year' | 'id_number' | 'tag_number' | 'name' | 'sex'>[]
}

export interface AnimalImportIssue {
  rowNumber: number
  message: string
}

export interface ReadyAnimalImport {
  rowNumber: number
  label: string
  payload: ReturnType<typeof animalFormToPayload>
  warnings: string[]
  damTag: string | null
  sireTag: string | null
}

export interface AnimalImportPreview {
  ready: ReadyAnimalImport[]
  errors: AnimalImportIssue[]
  warnings: AnimalImportIssue[]
}

interface DraftRow {
  rowNumber: number
  errors: string[]
  warnings: string[]
  identity: string | null
  tag: string | null
  hasStud: boolean
  form: AnimalFormData
  place: string | null
  damTag: string | null
  sireTag: string | null
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function cellText(value: unknown) {
  if (value == null) return ''
  if (value instanceof Date) return ''
  if (typeof value === 'number') return String(value)
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part: { text?: string }) => part.text ?? '').join('').trim()
    }
    if ('text' in value && typeof value.text === 'string') return value.text.trim()
    if ('result' in value) return cellText(value.result)
  }
  return String(value).trim()
}

function isValidIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const date = new Date(`${value}T00:00:00Z`)
  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3])
  )
}

function isoFromDate(value: Date) {
  const useUtc = value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0
  const year = useUtc ? value.getUTCFullYear() : value.getFullYear()
  const month = (useUtc ? value.getUTCMonth() : value.getMonth()) + 1
  const day = useUtc ? value.getUTCDate() : value.getDate()
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return isValidIsoDate(iso) ? iso : null
}

function parseBirthDate(value: unknown): { date: string } | { empty: true } | { error: string } {
  if (value == null || value === '') return { empty: true }
  if (value instanceof Date) {
    const iso = isoFromDate(value)
    return iso ? { date: iso } : { error: 'Birth date is not a real date. Use YYYY-MM-DD.' }
  }
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const utc = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000)
    const iso = isoFromDate(utc)
    return iso ? { date: iso } : { error: 'Birth date is not a real date. Use YYYY-MM-DD.' }
  }
  const text = cellText(value)
  if (!text) return { empty: true }
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const iso = text.slice(0, 10)
    return isValidIsoDate(iso) ? { date: iso } : { error: 'Birth date is not a real date. Use YYYY-MM-DD.' }
  }
  const parts = text.match(/^(\d{1,2})[/.\\-](\d{1,2})[/.\\-](\d{4})$/)
  if (parts) {
    const iso = `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
    return isValidIsoDate(iso) ? { date: iso } : { error: 'Birth date is not a real date. Use YYYY-MM-DD.' }
  }
  return { error: 'Birth date must look like 2024-03-15 or 15/03/2024.' }
}

function digitsPart(raw: string, length: number, label: string): { value: string; error?: string; warning?: string } {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return { value: '' }
  if (label === 'Year' && digits.length === 4) {
    return { value: digits.slice(-2), warning: 'Year kept the last two digits of the full year.' }
  }
  if (digits.length > length) {
    return { value: '', error: `${label} can be at most ${length} digits.` }
  }
  return { value: digits.padStart(length, '0') }
}

function lookupChoice<T extends string>(raw: string, choices: Record<string, T>, label: string, allowed: string) {
  if (!raw) return { value: '' as const }
  const match = choices[raw.trim().toLowerCase()]
  if (!match) return { value: '' as const, error: `${label} must be ${allowed}.` }
  return { value: match }
}

function tagOrEmpty(raw: string): { tag: string | null; year?: string; number?: string; error?: string } {
  if (!raw) return { tag: null }
  const parsed = normalizeTagNumber(raw)
  if (!parsed) return { tag: null, error: 'Use a tag like 01-1000.' }
  return { tag: parsed.tag, year: parsed.year, number: parsed.number }
}

function identityKey(stud: string, year: string, number: string) {
  if (!year || !number) return null
  if (stud) return `id:${stud}-${year}-${number}`
  return `tag:${year}-${number}`
}

function rowLabel(form: AnimalFormData) {
  return (
    formatAnimalId({
      stud_number: form.stud_number,
      id_year: form.id_year,
      id_number: form.id_number,
    }) ||
    formatTagNumber({
      id_year: form.id_year,
      id_number: form.id_number,
      tag_number: form.tag_number,
    }) ||
    form.name ||
    'Animal'
  )
}

function findHeader(matrix: unknown[][]) {
  const limit = Math.min(matrix.length, 5)
  for (let index = 0; index < limit; index++) {
    const fields = (matrix[index] ?? []).map((cell) => HEADER_FIELDS[normalizeHeader(cellText(cell))] ?? null)
    const hasTag = fields.includes('tag_number')
    const hasYearAndNumber = fields.includes('id_year') && fields.includes('id_number')
    if (hasTag || hasYearAndNumber) return { index, fields }
  }
  return null
}

function draftFromCells(
  rowNumber: number,
  cells: unknown[],
  fields: Array<ImportField | null>,
  context: AnimalImportContext,
): DraftRow | null {
  const values = new Map<ImportField, unknown>()
  fields.forEach((field, index) => {
    if (!field) return
    const current = values.get(field)
    const next = cells[index]
    if (current == null || current === '' || (typeof current === 'string' && current.trim() === '')) {
      values.set(field, next)
    }
  })

  const text = (field: ImportField) => cellText(values.get(field))
  if ([...values.values()].every((value) => cellText(value) === '' && !(value instanceof Date) && typeof value !== 'number')) {
    return null
  }

  const errors: string[] = []
  const warnings: string[] = []
  const stud = digitsPart(text('stud_number'), 4, 'Stud number')
  const year = digitsPart(text('id_year'), 2, 'Year')
  const number = digitsPart(text('id_number'), 4, 'Number')
  if (stud.error) errors.push(stud.error)
  if (year.error) errors.push(year.error)
  if (number.error) errors.push(number.error)
  if (year.warning) warnings.push(year.warning)

  let idYear = year.value
  let idNumber = number.value
  const tagCell = text('tag_number')
  const parsedTag = tagCell ? tagOrEmpty(tagCell) : { tag: null }
  if (parsedTag.error) {
    if (!idYear || !idNumber) errors.push(parsedTag.error)
    else warnings.push('Tag number was ignored because it is not a year-number. Year and Number were used.')
  }

  if ((!idYear || !idNumber) && parsedTag.tag && parsedTag.year && parsedTag.number) {
    idYear = idYear || parsedTag.year
    idNumber = idNumber || parsedTag.number
  }
  if (idYear && idNumber && parsedTag.tag && parsedTag.tag !== `${idYear}-${idNumber}`) {
    warnings.push(`Tag number ${parsedTag.tag} was replaced by ${idYear}-${idNumber} from Year and Number.`)
  }
  if (!idYear || !idNumber) {
    errors.push('Enter Year and Number, or a tag number like 01-1000.')
  }

  const sex = lookupChoice(text('sex'), SEX_VALUES, 'Sex', 'Female, Male, or Unknown')
  const species = lookupChoice(text('species'), SPECIES_VALUES, 'Species', 'Goat, Cattle, Sheep, or Other')
  const status = lookupChoice(text('status'), STATUS_VALUES, 'Status', 'Active, Sold, Deceased, Transferred, or Stamboek')
  const schedule = lookupChoice(text('studbook_schedule'), SCHEDULE_VALUES, 'Studbook schedule', 'Base, A, B, or SP')
  const selection = lookupChoice(text('selection'), SELECTION_VALUES, 'Selection', 'F, FC, FR, FT, or Stud')
  for (const choice of [sex, species, status, schedule, selection]) {
    if ('error' in choice && choice.error) errors.push(choice.error)
  }

  const birth = parseBirthDate(values.get('birth_date'))
  if ('error' in birth) errors.push(birth.error)

  const studbookRaw = text('studbook_number')
  if (studbookRaw && /\D/.test(studbookRaw)) errors.push('Studbook number can only contain digits.')

  const dam = text('dam_tag') ? tagOrEmpty(text('dam_tag')) : { tag: null as string | null }
  const sire = text('sire_tag') ? tagOrEmpty(text('sire_tag')) : { tag: null as string | null }
  if ('error' in dam && dam.error) errors.push(`Dam tag: ${dam.error}`)
  if ('error' in sire && sire.error) errors.push(`Sire tag: ${sire.error}`)

  const locationName = text('location')
  const campName = text('camp')
  let encampmentId = ''
  let place: string | null = null
  const locations = context.locations.filter((location) => normalizeName(location.name) === normalizeName(locationName))
  if (locationName && locations.length === 0) {
    errors.push(`Location "${locationName}" is not on this farm. Add it under Locations first.`)
  }
  if (locationName && locations.length > 1) {
    errors.push(`Location "${locationName}" matches more than one location.`)
  }
  const location = locations.length === 1 ? locations[0] : null
  if (campName) {
    const camps = context.encampments.filter((camp) => normalizeName(camp.name) === normalizeName(campName))
    const atLocation = location ? camps.filter((camp) => camp.location_id === location.id) : camps
    if (!location && camps.length > 1) {
      errors.push(`Camp "${campName}" is used in more than one location. Fill in Location.`)
    } else if (atLocation.length === 0) {
      errors.push(
        location
          ? `Camp "${campName}" is not at ${location.name}.`
          : `Camp "${campName}" is not on this farm. Add it under Locations first.`,
      )
    } else if (atLocation.length > 1) {
      errors.push(`Camp "${campName}" matches more than one camp.`)
    } else {
      encampmentId = atLocation[0].id
      const campLocation = context.locations.find((item) => item.id === atLocation[0].location_id) ?? location
      place = campLocation ? `${campLocation.name} · ${atLocation[0].name}` : atLocation[0].name
    }
  } else if (location) {
    place = location.name
  }

  const form = emptyAnimalForm()
  form.stud_number = stud.value
  form.id_year = idYear
  form.id_number = idNumber
  form.tag_number = idYear && idNumber ? `${idYear}-${idNumber}` : ''
  form.name = text('name')
  form.species = species.value || 'goat'
  form.breed = text('breed')
  form.sex = sex.value
  form.birth_date = 'date' in birth ? birth.date : ''
  form.color_markings = text('color_markings')
  form.studbook_number = studbookRaw.replace(/\D/g, '')
  form.studbook_schedule = schedule.value
  form.selection = selection.value
  form.electronic_id = text('electronic_id')
  form.status = status.value || 'active'
  form.encampment_id = encampmentId
  form.dam_tag_number = dam.tag ?? ''
  form.sire_name = text('sire_name')
  form.sire_stud_code = text('sire_stud_code')
  form.notes = text('notes')

  return {
    rowNumber,
    errors,
    warnings,
    identity: identityKey(stud.value, idYear, idNumber),
    tag: idYear && idNumber ? `${idYear}-${idNumber}` : null,
    hasStud: Boolean(stud.value),
    form,
    place,
    damTag: dam.tag,
    sireTag: sire.tag,
  }
}

export function parseAnimalMatrix(matrix: unknown[][], context: AnimalImportContext): AnimalImportPreview {
  const header = findHeader(matrix)
  if (!header) {
    return {
      ready: [],
      errors: [
        {
          rowNumber: 1,
          message: 'Could not find the column headings. Use the blank Excel file and keep the Animals sheet headings.',
        },
      ],
      warnings: [],
    }
  }

  const drafts: DraftRow[] = []
  for (let index = header.index + 1; index < matrix.length; index++) {
    const draft = draftFromCells(index + 1, matrix[index] ?? [], header.fields, context)
    if (draft) drafts.push(draft)
  }

  const existingIds = new Set<string>()
  const existingTags = new Set<string>()
  for (const animal of context.existing) {
    const stud = animal.stud_number?.trim() ?? ''
    const year = animal.id_year?.trim() ?? ''
    const number = animal.id_number?.trim() ?? ''
    const key = identityKey(stud, year, number)
    if (key) existingIds.add(key)
    const tag = formatTagNumber(animal)
    if (tag) existingTags.add(tag)
  }

  const firstIdentity = new Map<string, number>()
  const firstBareTag = new Map<string, number>()
  for (const draft of drafts) {
    if (!draft.identity || draft.errors.length > 0) continue
    if (existingIds.has(draft.identity)) {
      draft.errors.push(
        draft.hasStud
          ? `${rowLabel(draft.form)} is already on this farm.`
          : `Tag ${draft.tag} is already on this farm. Add a stud number if this is a different animal.`,
      )
    }
    const earlier = firstIdentity.get(draft.identity)
    if (earlier) {
      draft.errors.push(`Same animal as row ${earlier}.`)
      const first = drafts.find((item) => item.rowNumber === earlier)
      if (first && !first.errors.some((error) => error.startsWith('Same animal as row'))) {
        first.errors.push(`Same animal as row ${draft.rowNumber}.`)
      }
    } else {
      firstIdentity.set(draft.identity, draft.rowNumber)
    }
    if (draft.tag && !draft.hasStud) {
      const earlierTag = firstBareTag.get(draft.tag)
      if (earlierTag) {
        draft.errors.push(`Tag ${draft.tag} is also on row ${earlierTag}. Add stud numbers to tell them apart.`)
        const first = drafts.find((item) => item.rowNumber === earlierTag)
        if (first && !first.errors.some((error) => error.includes('Add stud numbers'))) {
          first.errors.push(`Tag ${draft.tag} is also on row ${draft.rowNumber}. Add stud numbers to tell them apart.`)
        }
      } else firstBareTag.set(draft.tag, draft.rowNumber)
      if (existingTags.has(draft.tag) && !draft.errors.some((error) => error.includes('already on this farm'))) {
        draft.errors.push(`Tag ${draft.tag} is already on this farm. Add a stud number if this is a different animal.`)
      }
    }
  }

  const ready: ReadyAnimalImport[] = []
  const errors: AnimalImportIssue[] = []
  const warnings: AnimalImportIssue[] = []
  for (const draft of drafts) {
    for (const message of draft.errors) errors.push({ rowNumber: draft.rowNumber, message })
    if (draft.errors.length > 0) continue
    for (const message of draft.warnings) warnings.push({ rowNumber: draft.rowNumber, message })
    ready.push({
      rowNumber: draft.rowNumber,
      label: rowLabel(draft.form),
      payload: animalFormToPayload(draft.form, draft.place),
      warnings: draft.warnings,
      damTag: draft.damTag,
      sireTag: draft.sireTag,
    })
  }

  return { ready, errors, warnings }
}

export async function readAnimalWorkbook(data: ArrayBuffer, context: AnimalImportContext) {
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  await workbook.xlsx.load(data)
  const sheet =
    workbook.getWorksheet('Animals') ??
    workbook.worksheets.find((item) => item.name !== 'Instructions') ??
    workbook.worksheets[0]
  if (!sheet) return parseAnimalMatrix([], context)

  const matrix: unknown[][] = []
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: unknown[] = []
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cells[column - 1] = cell.value
    })
    matrix.push(cells)
  })
  return parseAnimalMatrix(matrix, context)
}

export async function buildAnimalTemplateBuffer() {
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  workbook.creator = 'AgriScale Farm'
  workbook.title = 'Animal upload'

  const animals = workbook.addWorksheet('Animals', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  animals.columns = animalImportColumns.map((column) => ({
    header: column.header,
    key: column.field,
    width: column.width,
  }))
  const header = animals.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 12 }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C3623' } }
  header.alignment = { vertical: 'middle', wrapText: true }
  header.height = 24
  animals.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: animalImportColumns.length },
  }

  const textFields = new Set<ImportField>([
    'stud_number',
    'id_year',
    'id_number',
    'tag_number',
    'studbook_number',
    'electronic_id',
    'dam_tag',
    'sire_tag',
    'sire_stud_code',
  ])
  animalImportColumns.forEach((column, index) => {
    const excelColumn = animals.getColumn(index + 1)
    if (textFields.has(column.field)) excelColumn.numFmt = '@'
    if (column.field === 'birth_date') excelColumn.numFmt = 'yyyy-mm-dd'
  })

  for (const list of LIST_COLUMNS) {
    const columnIndex = animalImportColumns.findIndex((column) => column.field === list.field) + 1
    for (let row = 2; row <= TEMPLATE_ROWS; row++) {
      animals.getCell(row, columnIndex).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [list.formula],
        showErrorMessage: true,
        errorTitle: 'Choose from the list',
        error: 'Use one of the values from the list.',
      }
    }
  }

  const instructions = workbook.addWorksheet('Instructions')
  instructions.columns = [
    { header: 'Column', width: 24 },
    { header: 'How to fill it', width: 88 },
  ]
  const instructionHeader = instructions.getRow(1)
  instructionHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 12 }
  instructionHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C3623' } }
  instructionHeader.height = 22
  instructions.addRow([
    'Start here',
    'Leave this sheet as a guide. Enter animals on the Animals sheet, one animal per row. Do not rename the headings.',
  ])
  for (const column of animalImportColumns) {
    instructions.addRow([column.header, column.hint])
  }
  instructions.addRow([
    'Parents',
    'Dam tag and Sire tag can point at animals already on the farm or at other rows in this file. If several animals share a tag, the parent is left unlinked.',
  ])
  instructions.getColumn(1).alignment = { vertical: 'top', wrapText: true }
  instructions.getColumn(2).alignment = { vertical: 'top', wrapText: true }

  return workbook.xlsx.writeBuffer()
}

export async function downloadAnimalTemplate() {
  const buffer = await buildAnimalTemplateBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'agriscale-animals-upload.xlsx'
  link.click()
  URL.revokeObjectURL(url)
}

export function parentLinksForImport(
  ready: ReadyAnimalImport[],
  inserted: Pick<Animal, 'id' | 'stud_number' | 'id_year' | 'id_number' | 'tag_number' | 'name' | 'sex'>[],
  existing: AnimalImportContext['existing'],
) {
  const byTag = new Map<string, AnimalImportContext['existing']>()
  for (const animal of [...existing, ...inserted]) {
    const tag = formatTagNumber(animal)
    if (!tag) continue
    const list = byTag.get(tag) ?? []
    list.push(animal)
    byTag.set(tag, list)
  }

  const insertedByLabel = new Map(inserted.map((animal) => [animalIdentity(animal), animal]))
  const updates: {
    id: string
    rowNumber: number
    dam_id?: string
    dam_tag_number?: string
    sire_id?: string
    sire_name?: string
    warning?: string
  }[] = []

  for (const row of ready) {
    if (!row.damTag && !row.sireTag) continue
    const insertedAnimal = insertedByLabel.get(payloadIdentity(row.payload))
    if (!insertedAnimal) continue
    const update: (typeof updates)[number] = { id: insertedAnimal.id, rowNumber: row.rowNumber }
    const warnings: string[] = []
    if (row.damTag) {
      const matches = (byTag.get(row.damTag) ?? []).filter((animal) => animal.id !== insertedAnimal.id)
      if (matches.length === 1) {
        update.dam_id = matches[0].id
        update.dam_tag_number = row.damTag
      } else if (matches.length === 0) {
        warnings.push(`Dam tag ${row.damTag} was not found, so the mother was not linked.`)
      } else {
        warnings.push(`Dam tag ${row.damTag} matches more than one animal, so the mother was not linked.`)
      }
    }
    if (row.sireTag) {
      const matches = (byTag.get(row.sireTag) ?? []).filter((animal) => animal.id !== insertedAnimal.id)
      if (matches.length === 1) {
        update.sire_id = matches[0].id
        update.sire_name = animalLabel({ ...matches[0], stud_tag_number: null })
      } else if (matches.length === 0) {
        warnings.push(`Sire tag ${row.sireTag} was not found, so the father was not linked.`)
      } else {
        warnings.push(`Sire tag ${row.sireTag} matches more than one animal, so the father was not linked.`)
      }
    }
    if (warnings.length > 0) update.warning = warnings.join(' ')
    if (update.dam_id || update.sire_id || update.warning) updates.push(update)
  }
  return updates
}

function animalIdentity(animal: Pick<Animal, 'stud_number' | 'id_year' | 'id_number' | 'tag_number'>) {
  return identityKey(animal.stud_number?.trim() ?? '', animal.id_year?.trim() ?? '', animal.id_number?.trim() ?? '')
}

function payloadIdentity(payload: ReturnType<typeof animalFormToPayload>) {
  return identityKey(payload.stud_number ?? '', payload.id_year ?? '', payload.id_number ?? '')
}
