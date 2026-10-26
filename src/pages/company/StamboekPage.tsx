import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useOfflineRead } from '../../contexts/OfflineContext'
import { errorText } from '../../lib/offlineHerd'
import { deleteAnimal } from '../../lib/animals'
import { birthExportRows } from '../../lib/births'
import { exportCsv } from '../../lib/exportCsv'
import { todayDateValue } from '../../lib/inoculations'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/layout/AppShell'
import { StamboekImportPanel } from './ImportStambookPage'

function yearStartDate() {
  return `${todayDateValue().slice(0, 4)}-01-01`
}

export function StamboekPage() {
  const { profile } = useAuth()
  const { ready, read, cacheKey } = useOfflineRead()
  const [count, setCount] = useState(0)
  const [loadingCount, setLoadingCount] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [fromDate, setFromDate] = useState(yearStartDate)
  const [toDate, setToDate] = useState(todayDateValue)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [exportSuccess, setExportSuccess] = useState('')

  const isAdmin = profile?.role === 'company_admin'

  const loadCount = useCallback(async () => {
    if (!profile?.company_id || !ready) {
      if (!profile?.company_id) setLoadingCount(false)
      return
    }
    const companyId = profile.company_id
    setLoadingCount(true)
    try {
      const total = await read(
        (saved) => saved.animals.filter((animal) => animal.status === 'stamboek').length,
        async () => {
          const { count: nextCount, error: countError } = await supabase
            .from('animals')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .eq('status', 'stamboek')
          if (countError) throw new Error(countError.message)
          return nextCount ?? 0
        },
      )
      setCount(total)
      setError('')
    } catch (err) {
      setError(errorText(err, 'Failed to load stamboek animals'))
    } finally {
      setLoadingCount(false)
    }
  }, [profile?.company_id, ready, cacheKey, read])

  useEffect(() => {
    void loadCount()
  }, [loadCount])

  const handleDelete = async () => {
    if (!profile?.company_id || count === 0) return

    if (
      !window.confirm(
        `Delete all ${count} stamboek ${count === 1 ? 'animal' : 'animals'}? This action cannot be undone. Photos, documents, health records, and show results will also be removed.`,
      )
    ) {
      return
    }

    setDeleting(true)
    setError('')
    setSuccess('')

    const { data, error: fetchError } = await supabase
      .from('animals')
      .select('id, company_id')
      .eq('company_id', profile.company_id)
      .eq('status', 'stamboek')

    if (fetchError) {
      setError(fetchError.message)
      setDeleting(false)
      return
    }

    try {
      await Promise.all(
        (data ?? []).map((animal) => deleteAnimal({ id: animal.id, company_id: animal.company_id })),
      )
      const removed = data?.length ?? 0
      setSuccess(`Deleted ${removed} stamboek ${removed === 1 ? 'animal' : 'animals'}.`)
      setCount(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete stamboek animals')
      await loadCount()
    } finally {
      setDeleting(false)
    }
  }

  const handleExportBirths = async () => {
    if (!profile?.company_id) return
    setExportError('')
    setExportSuccess('')

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      setExportError('Choose a from date and a to date.')
      return
    }
    if (fromDate > toDate) {
      setExportError('The from date needs to be on or before the to date.')
      return
    }

    setExporting(true)
    try {
      const rows = await birthExportRows(profile.company_id, fromDate, toDate)
      if (rows.length === 0) {
        setExportError('No births in that date range.')
        return
      }
      exportCsv(`births-${fromDate}-to-${toDate}.csv`, ['Animal ID', 'Mother ID', 'Father ID', 'DoB'], rows)
      setExportSuccess(`Exported ${rows.length} ${rows.length === 1 ? 'birth' : 'births'}.`)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to export births')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Stamboek"
        description="Import a kraalkaart, export births for a date range, and remove Stamboek animals."
      />

      <StamboekImportPanel onImported={() => void loadCount()} />

      <Card>
        <h3 className="font-display text-lg font-semibold text-pasture-900">Export births</h3>
        <p className="mt-1 text-sm text-soil-600">
          Downloads animals born between the two dates. The file has Animal ID, Mother ID, Father ID, and DoB.
        </p>
        <form
          className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            void handleExportBirths()
          }}
        >
          <Input
            label="From"
            id="birth-export-from"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            required
          />
          <Input
            label="To"
            id="birth-export-to"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            required
          />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={exporting} className="w-full sm:w-auto">
              {exporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
        </form>
        {exportError && <p className="mt-3 text-sm text-red-600">{exportError}</p>}
        {exportSuccess && <p className="mt-3 text-sm text-pasture-800">{exportSuccess}</p>}
      </Card>

      <Card>
        <h3 className="font-display text-lg font-semibold text-pasture-900">Delete stamboek animals</h3>
        <p className="mt-1 text-sm text-soil-600">
          Removes every animal whose status is Stamboek. Animals marked active, sold, deceased, or transferred stay on the farm.
        </p>
        <p className="mt-3 text-sm font-semibold text-soil-800">
          {loadingCount
            ? 'Counting stamboek animals...'
            : `${count} stamboek ${count === 1 ? 'animal' : 'animals'}`}
        </p>
        {isAdmin ? (
          <Button
            type="button"
            variant="danger"
            className="mt-4 w-full sm:w-auto"
            disabled={loadingCount || deleting || count === 0}
            onClick={handleDelete}
          >
            {deleting ? 'Deleting...' : 'Delete stamboek animals'}
          </Button>
        ) : (
          <p className="mt-3 text-sm text-soil-500">A farm admin can delete these animals.</p>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-3 text-sm text-pasture-800">{success}</p>}
      </Card>
    </div>
  )
}
