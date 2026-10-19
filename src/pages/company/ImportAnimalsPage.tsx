import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Encampment, FarmLocation } from '../../lib/types'
import {
  downloadAnimalTemplate,
  parentLinksForImport,
  readAnimalWorkbook,
  type AnimalImportContext,
  type AnimalImportPreview,
} from '../../lib/animalImport'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/layout/AppShell'

const previewLimit = 8

export function ImportAnimalsPage() {
  const { profile } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [locations, setLocations] = useState<FarmLocation[]>([])
  const [encampments, setEncampments] = useState<Encampment[]>([])
  const [existing, setExisting] = useState<AnimalImportContext['existing']>([])
  const [loading, setLoading] = useState(true)
  const [reading, setReading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<AnimalImportPreview | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!profile?.company_id) {
      setLoading(false)
      setError('Your account is not linked to a farm.')
      return
    }

    Promise.all([
      supabase.from('locations').select('*').eq('company_id', profile.company_id).order('name'),
      supabase.from('encampments').select('*').eq('company_id', profile.company_id).order('name'),
      supabase
        .from('animals')
        .select('id, stud_number, id_year, id_number, tag_number, name, sex')
        .eq('company_id', profile.company_id),
    ]).then(([locationsRes, encampmentsRes, animalsRes]) => {
      if (locationsRes.error) setError(locationsRes.error.message)
      else setLocations(locationsRes.data ?? [])
      if (encampmentsRes.error) setError(encampmentsRes.error.message)
      else setEncampments(encampmentsRes.data ?? [])
      if (animalsRes.error) setError(animalsRes.error.message)
      else setExisting(animalsRes.data ?? [])
      setLoading(false)
    })
  }, [profile?.company_id])

  const downloadTemplate = async () => {
    setDownloading(true)
    setError('')
    try {
      await downloadAnimalTemplate()
    } catch {
      setError('Could not create the Excel file. Try again.')
    } finally {
      setDownloading(false)
    }
  }

  const onFile = async (file: File | undefined) => {
    setSuccess('')
    setPreview(null)
    setFileName(file?.name ?? '')
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('Upload an Excel .xlsx file. Download the blank file if you need the format.')
      return
    }
    if (!profile?.company_id) {
      setError('Your account is not linked to a farm.')
      return
    }

    setReading(true)
    setError('')
    try {
      const data = await file.arrayBuffer()
      const next = await readAnimalWorkbook(data, { locations, encampments, existing })
      setPreview(next)
      if (next.ready.length === 0 && next.errors.length === 0) {
        setError('The Animals sheet has no rows to import.')
      }
    } catch {
      setError('Could not read that Excel file. Download the blank file and keep the Animals sheet.')
    } finally {
      setReading(false)
    }
  }

  const importAnimals = async () => {
    if (!profile?.company_id || !preview || preview.ready.length === 0) return
    setImporting(true)
    setError('')
    setSuccess('')

    const rows = preview.ready.map((row) => ({
      ...row.payload,
      company_id: profile.company_id,
      created_by: profile.id,
    }))

    const inserted: AnimalImportContext['existing'] = []
    try {
      for (let index = 0; index < rows.length; index += 100) {
        const { data, error: insertError } = await supabase
          .from('animals')
          .insert(rows.slice(index, index + 100))
          .select('id, stud_number, id_year, id_number, tag_number, name, sex')
        if (insertError) throw new Error(insertError.message)
        inserted.push(...(data ?? []))
      }
    } catch (err) {
      const saved = inserted.length
      setError(
        saved > 0
          ? `${saved} animals were saved, then the upload stopped. ${err instanceof Error ? err.message : 'Try the remaining rows again.'}`
          : err instanceof Error
            ? err.message
            : 'Could not save the animals.',
      )
      setImporting(false)
      return
    }

    const links = parentLinksForImport(preview.ready, inserted, existing)
    const linkWarnings: string[] = []
    for (const link of links) {
      if (link.warning) linkWarnings.push(`Row ${link.rowNumber}: ${link.warning}`)
      if (!link.dam_id && !link.sire_id) continue
      const { error: updateError } = await supabase
        .from('animals')
        .update({
          ...(link.dam_id ? { dam_id: link.dam_id, dam_tag_number: link.dam_tag_number } : {}),
          ...(link.sire_id ? { sire_id: link.sire_id, sire_name: link.sire_name } : {}),
        })
        .eq('id', link.id)
      if (updateError) linkWarnings.push(`Row ${link.rowNumber}: the animal was saved, but the parent link failed.`)
    }

    const skipped = preview.errors.length
    setSuccess(
      `Imported ${inserted.length} ${inserted.length === 1 ? 'animal' : 'animals'}.${
        skipped > 0 ? ` ${skipped} ${skipped === 1 ? 'row was' : 'rows were'} skipped.` : ''
      }`,
    )
    if (linkWarnings.length > 0) {
      setPreview({
        ready: [],
        errors: [],
        warnings: linkWarnings.map((message) => ({ rowNumber: 0, message })),
      })
    } else {
      setPreview(null)
      setFileName('')
    }
    setExisting((current) => [...inserted, ...current])
    setImporting(false)
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Upload animals"
        description="Add many animals from one Excel file. Download the blank workbook, fill one animal per row, then upload it."
      />

      <Card>
        <h3 className="font-display font-semibold text-pasture-900">1. Download the blank Excel file</h3>
        <p className="mt-2 text-sm text-soil-600">
          The Animals sheet has the column headings. Lists are set for species, sex, studbook schedule, selection, and status. The Instructions sheet explains each column.
        </p>
        <Button type="button" className="mt-4 w-full sm:w-auto" onClick={downloadTemplate} disabled={downloading}>
          {downloading ? 'Preparing template...' : 'Download template'}
        </Button>
      </Card>

      <Card>
        <h3 className="font-display font-semibold text-pasture-900">2. Upload the filled file</h3>
        <p className="mt-2 text-sm text-soil-600">
          Location and camp names must already exist on the farm. Year and number, or a tag like 01-1000, are required on each row.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
            disabled={loading || reading || importing}
          >
            {reading ? 'Reading file...' : 'Choose Excel file'}
          </Button>
          {fileName && <p className="text-sm text-soil-600">{fileName}</p>}
        </div>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && (
        <div className="rounded-xl bg-pasture-50 px-3 py-3 text-sm text-pasture-900">
          <p>{success}</p>
          <Link to="/app/animals" className="mt-2 inline-block font-semibold text-pasture-800">
            Back to animals
          </Link>
        </div>
      )}

      {preview && (preview.ready.length > 0 || preview.errors.length > 0 || preview.warnings.length > 0) && (
        <Card>
          <h3 className="font-display font-semibold text-pasture-900">3. Check, then import</h3>
          <p className="mt-2 text-sm text-soil-600">
            {preview.ready.length > 0
              ? `${preview.ready.length} ${preview.ready.length === 1 ? 'animal is' : 'animals are'} ready.`
              : 'No animals are ready to import.'}
            {preview.errors.length > 0
              ? ` ${preview.errors.length} ${preview.errors.length === 1 ? 'row needs' : 'rows need'} a fix.`
              : ''}
          </p>

          {preview.errors.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm text-red-700">
              {preview.errors.slice(0, 40).map((issue) => (
                <li key={`${issue.rowNumber}-${issue.message}`}>
                  {issue.rowNumber > 0 ? `Row ${issue.rowNumber}: ` : ''}
                  {issue.message}
                </li>
              ))}
              {preview.errors.length > 40 && <li>And {preview.errors.length - 40} more rows.</li>}
            </ul>
          )}

          {preview.warnings.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm text-soil-700">
              {preview.warnings.slice(0, 20).map((issue) => (
                <li key={`${issue.rowNumber}-${issue.message}`}>
                  {issue.rowNumber > 0 ? `Row ${issue.rowNumber}: ` : ''}
                  {issue.message}
                </li>
              ))}
            </ul>
          )}

          {preview.ready.length > 0 && (
            <ul className="mt-4 divide-y divide-field-dark overflow-hidden rounded-xl border border-field-dark">
              {preview.ready.slice(0, previewLimit).map((row) => (
                <li key={row.rowNumber} className="px-3 py-2.5 text-sm text-soil-800">
                  <span className="font-semibold">{row.label}</span>
                  <span className="text-soil-500"> · row {row.rowNumber}</span>
                </li>
              ))}
              {preview.ready.length > previewLimit && (
                <li className="px-3 py-2.5 text-sm text-soil-500">
                  And {preview.ready.length - previewLimit} more.
                </li>
              )}
            </ul>
          )}

          {preview.ready.length > 0 && (
            <Button type="button" className="mt-4 w-full sm:w-auto" onClick={importAnimals} disabled={importing}>
              {importing ? 'Importing...' : `Import ${preview.ready.length} ${preview.ready.length === 1 ? 'animal' : 'animals'}`}
            </Button>
          )}
        </Card>
      )}

      <Link to="/app/animals" className="inline-block text-sm font-semibold text-pasture-800">
        Cancel
      </Link>
    </div>
  )
}
