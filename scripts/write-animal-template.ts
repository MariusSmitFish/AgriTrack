import { writeFile } from 'node:fs/promises'
import { Workbook } from 'exceljs'
import { buildAnimalTemplateBuffer, parseAnimalMatrix, readAnimalWorkbook } from '../src/lib/animalImport.ts'
import type { AnimalImportContext } from '../src/lib/animalImport.ts'

const context: AnimalImportContext = {
  locations: [
    {
      id: 'loc1',
      company_id: 'c',
      name: 'North',
      description: null,
      created_at: '',
      updated_at: '',
    },
  ],
  encampments: [
    {
      id: 'camp1',
      company_id: 'c',
      location_id: 'loc1',
      name: 'Kraal',
      description: null,
      created_at: '',
      updated_at: '',
    },
  ],
  existing: [],
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

const preview = parseAnimalMatrix(
  [
    ['Stud number', 'Year', 'Number', 'Name', 'Sex', 'Species', 'Location', 'Camp', 'Birth date'],
    ['1', '1', '1000', 'Daisy', 'Female', 'Goat', 'North', 'Kraal', '15/03/2024'],
    ['2', '24', '3081', 'Billy', 'Buck', 'Cattle', 'Missing', '', ''],
  ],
  context,
)

assert(preview.ready.length === 1, `expected 1 ready row, got ${preview.ready.length} ${JSON.stringify(preview.errors)}`)
assert(preview.ready[0]?.label === '0001-01-1000', `label ${preview.ready[0]?.label}`)
assert(preview.ready[0]?.payload.sex === 'female', 'sex')
assert(preview.ready[0]?.payload.birth_date === '2024-03-15', `date ${preview.ready[0]?.payload.birth_date}`)
assert(preview.ready[0]?.payload.encampment_id === 'camp1', 'camp')
assert(preview.ready[0]?.payload.location === 'North · Kraal', `place ${preview.ready[0]?.payload.location}`)
assert(preview.errors.some((issue) => issue.rowNumber === 3), 'missing location should error')

const tagOnly = parseAnimalMatrix(
  [
    ['Tag number', 'Name', 'Sex'],
    ['01-1000', 'Star', 'Female'],
    ['01-1000', 'Twin', 'Male'],
  ],
  context,
)
assert(tagOnly.ready.length === 0, 'duplicate bare tags should not import')
assert(tagOnly.errors.length >= 2, 'both duplicate rows should be reported')

const buffer = await buildAnimalTemplateBuffer()
const blank = await readAnimalWorkbook(buffer as ArrayBuffer, context)
assert(blank.ready.length === 0 && blank.errors.length === 0, `blank template should have no rows: ${JSON.stringify(blank.errors)}`)

const workbook = new Workbook()
await workbook.xlsx.load(buffer as ArrayBuffer)
const sheet = workbook.getWorksheet('Animals')
if (!sheet) throw new Error('Animals sheet missing')
sheet.addRow(['0007', '02', '0042', '', 'Nala', 'Sheep', 'Dorper', 'Female'])
const filled = await workbook.xlsx.writeBuffer()
const readBack = await readAnimalWorkbook(filled as ArrayBuffer, context)
assert(readBack.ready.length === 1, `roundtrip ready ${readBack.ready.length} ${JSON.stringify(readBack.errors)}`)
assert(readBack.ready[0]?.label === '0007-02-0042', `roundtrip label ${readBack.ready[0]?.label}`)
assert(readBack.ready[0]?.payload.species === 'sheep', 'species')
assert(readBack.ready[0]?.payload.breed === 'Dorper', 'breed')

await writeFile('public/agriscale-animals-upload.xlsx', Buffer.from(buffer))
console.log('Wrote public/agriscale-animals-upload.xlsx')
