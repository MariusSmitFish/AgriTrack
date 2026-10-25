import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  parseStambookCsv,
  importStambookAnimals,
  type StambookImportResult,
  type StambookImportRow,
} from '../../lib/stambookImport'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'

function formatAnimalNumber(raw: string): string {
  if (!raw) return '—'
  
  // Remove BBG, BBGF, BBGM prefixes and whitespace
  let cleaned = raw.trim()
    .replace(/^BBG[MF]?\s*/i, '')
    .replace(/\s+/g, '')
  
  if (!cleaned || cleaned === '0') return raw
  
  if (cleaned.length >= 6) {
    const animalNumber = cleaned.slice(-4)
    const year = cleaned.slice(-6, -4)
    let studNumber = cleaned.slice(0, -6)
    
    if (studNumber.length < 4) {
      studNumber = studNumber.padStart(4, '0')
    } else if (studNumber.length > 4) {
      studNumber = studNumber.slice(0, 4)
    }
    
    return `${studNumber}-${year}-${animalNumber}`
  }
  
  return raw
}

export function StamboekImportPanel({ onImported }: { onImported?: () => void }) {
  const { profile } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<StambookImportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [result, setResult] = useState<StambookImportResult | null>(null)

  const onFile = async (file: File | undefined) => {
    setSuccess('')
    setError('')
    setRows([])
    setResult(null)
    setFileName(file?.name ?? '')
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Upload a CSV file from stambook.')
      return
    }
    if (!profile?.company_id) {
      setError('Your account is not linked to a farm.')
      return
    }

    setLoading(true)
    try {
      const text = await file.text()
      const parsed = parseStambookCsv(text)
      if (parsed.length === 0) {
        setError('No valid animal records found in the CSV file.')
      } else {
        setRows(parsed)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that CSV file.')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!profile?.company_id || rows.length === 0) return

    setImporting(true)
    setError('')
    setSuccess('')
    setResult(null)

    try {
      const importResult = await importStambookAnimals(profile.company_id, profile.id, rows)
      setResult(importResult)
      onImported?.()
      
      const created = importResult.created
      const updated = importResult.updated
      if (importResult.errors.length > 0) {
        setError('Some animals could not be imported. See details below.')
      } else if (created === 0 && updated === 0) {
        setSuccess('No empty details to fill in. Saved birth dates, pedigree, studbook numbers, and schedules were left as they are.')
      } else {
        const parts: string[] = []
        if (created > 0) parts.push(`created ${created}`)
        if (updated > 0) parts.push(`updated ${updated}`)
        setSuccess(
          `Successfully ${parts.join(' and ')}. New animals have status "Stamboek". Existing animals only gained details that were empty.`,
        )
      }
      
      if (created > 0 || updated > 0) {
        setRows([])
        setFileName('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-semibold text-pasture-900">Import</h3>
        <p className="mt-1 text-sm text-soil-600">
          Upload a kraalkaart CSV. New animals are created with status Stamboek. Animals already on the farm keep their saved details, and empty birth dates, pedigree, studbook number, and schedule are filled in.
        </p>
      </div>

      <Card>
        <h3 className="font-display font-semibold text-pasture-900">What gets imported</h3>
        <ul className="mt-2 space-y-1 text-sm text-soil-600">
          <li>• Animal ID from the NID column (for example BBG 1637260016 becomes 1637-26-0016)</li>
          <li>• Sex, birth date, studbook number, and schedule (A, B, or SP)</li>
          <li>• Mother and father from DAM_NID and SIRE_NID</li>
        </ul>
        <p className="mt-3 text-sm text-soil-600">
          New animals receive status <span className="font-semibold text-pasture-800">Stamboek</span> and species <span className="font-semibold text-pasture-800">Goat</span>.
          If an animal is already on the farm, only empty birth dates, sex, pedigree, studbook number, and schedule are filled in. A saved value is left as it is.
          Parents that are not on the farm yet are added as their own Stamboek animals, with birth date left blank, and then linked.
          Section BS is left blank, because the saved schedules are A, B, and SP.
        </p>
      </Card>

      <Card>
        <h3 className="font-display font-semibold text-pasture-900">Upload CSV file</h3>
        <p className="mt-2 text-sm text-soil-600">
          Select the kraalkaart CSV. It uses NID, SEX, BIRTH_DTM, DAM_NID, and SIRE_NID. The farm address can span more than one line.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            void onFile(file)
            event.target.value = ''
          }}
        />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || importing}
          >
            {loading ? 'Reading file...' : 'Choose CSV file'}
          </Button>
          {fileName && <p className="text-sm text-soil-600">{fileName}</p>}
        </div>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && (
        <div className="rounded-xl bg-pasture-50 px-3 py-3 text-sm text-pasture-900">
          <p>{success}</p>
          <Link to="/app/animals" className="mt-2 inline-block font-semibold text-pasture-800">
            View animals
          </Link>
        </div>
      )}

      {rows.length > 0 && !result && (
        <Card>
          <h3 className="font-display font-semibold text-pasture-900">Preview</h3>
          <p className="mt-2 text-sm text-soil-600">
            Found {rows.length} animal{rows.length === 1 ? '' : 's'} in the CSV file. Animals already on the farm are updated only where a detail is still empty.
          </p>
          
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-field-dark">
                <tr className="text-left text-soil-500">
                  <th className="pb-2 pr-4 font-medium">Animal Number</th>
                  <th className="pb-2 pr-4 font-medium">Sex</th>
                  <th className="pb-2 pr-4 font-medium">Birth Date</th>
                  <th className="pb-2 pr-4 font-medium">Dam</th>
                  <th className="pb-2 font-medium">Sire</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="border-b border-field-dark/60">
                    <td className="py-2 pr-4 text-soil-800">{formatAnimalNumber(row.animalNumber)}</td>
                    <td className="py-2 pr-4 text-soil-600">{row.sex || '—'}</td>
                    <td className="py-2 pr-4 text-soil-600">{row.birthDate || '—'}</td>
                    <td className="py-2 pr-4 text-soil-600">{formatAnimalNumber(row.damAnimalNumber || '')}</td>
                    <td className="py-2 text-soil-600">{formatAnimalNumber(row.sireAnimalNumber || '')}</td>
                  </tr>
                ))}
                {rows.length > 10 && (
                  <tr>
                    <td colSpan={5} className="py-2 text-soil-500">
                      And {rows.length - 10} more...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Button type="button" className="mt-4 w-full sm:w-auto" onClick={handleImport} disabled={importing}>
            {importing ? 'Importing...' : `Import ${rows.length} animal${rows.length === 1 ? '' : 's'}`}
          </Button>
        </Card>
      )}

      {result && (
        <Card>
          <h3 className="font-display font-semibold text-pasture-900">Import Results</h3>
          
          <div className="mt-3 space-y-2 text-sm">
            {result.created > 0 && (
              <p className="text-pasture-800">
                ✓ Created {result.created} animal{result.created === 1 ? '' : 's'}
              </p>
            )}
            {result.updated > 0 && (
              <p className="text-pasture-800">
                ✓ Updated {result.updated} existing animal{result.updated === 1 ? '' : 's'} (empty birth date, sex, or pedigree only)
              </p>
            )}
            {result.unchanged > 0 && (
              <p className="text-soil-600">
                • {result.unchanged} animal{result.unchanged === 1 ? '' : 's'} already had these details
              </p>
            )}
            {result.skipped > 0 && (
              <p className="text-soil-600">
                ⊘ Skipped {result.skipped} row{result.skipped === 1 ? '' : 's'} (could not read the animal number, or it was repeated in the file)
              </p>
            )}
          </div>

          {result.warnings.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-soil-700">Warnings:</p>
              <ul className="mt-2 space-y-1 text-sm text-soil-600">
                {result.warnings.slice(0, 20).map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
                {result.warnings.length > 20 && (
                  <li>And {result.warnings.length - 20} more warnings...</li>
                )}
              </ul>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-red-700">Errors:</p>
              <ul className="mt-2 space-y-1 text-sm text-red-600">
                {result.errors.slice(0, 20).map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
                {result.errors.length > 20 && (
                  <li>And {result.errors.length - 20} more errors...</li>
                )}
              </ul>
            </div>
          )}
        </Card>
      )}

    </div>
  )
}
