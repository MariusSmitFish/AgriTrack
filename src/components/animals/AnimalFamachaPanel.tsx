import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { AnimalFamacha, AnimalFamachaFormData } from '../../lib/types'
import {
  createAnimalFamacha,
  deleteAnimalFamacha,
  emptyFamachaForm,
  famachaScoreClass,
  famachaScoreOptions,
  fetchAnimalFamacha,
  formatFamachaDate,
  normalizeAnimalFamacha,
  updateAnimalFamacha,
} from '../../lib/famacha'
import { filterBySearch } from '../../lib/search'
import { useClientPagination } from '../../lib/pagination'
import { useOfflineRead } from '../../contexts/OfflineContext'
import { friendlyError } from '../../lib/userError'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Card } from '../ui/Card'
import { SearchField } from '../ui/SearchField'
import { Pagination } from '../ui/Pagination'
import {
  DesktopTable,
  EmptyState,
  MobileCard,
  MobileCardList,
} from '../layout/AppShell'

interface AnimalFamachaPanelProps {
  animalId: string
  companyId: string
  userId: string
}

function sortRecords(records: AnimalFamacha[]) {
  return [...records].sort((a, b) => {
    if (a.checked_at !== b.checked_at) return b.checked_at.localeCompare(a.checked_at)
    return b.created_at.localeCompare(a.created_at)
  })
}

export function AnimalFamachaPanel({ animalId, companyId, userId }: AnimalFamachaPanelProps) {
  const { ready, read, cacheKey, readOnly } = useOfflineRead()
  const [records, setRecords] = useState<AnimalFamacha[]>([])
  const [form, setForm] = useState<AnimalFamachaFormData>(emptyFamachaForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const filteredRecords = useMemo(
    () =>
      filterBySearch(records, deferredQuery, (record) => [
        String(record.score),
        formatFamachaDate(record.checked_at),
      ]),
    [records, deferredQuery],
  )

  const {
    pageItems: pagedRecords,
    page,
    setPage,
    totalPages,
    totalItems,
    start,
    end,
  } = useClientPagination(filteredRecords, { resetKey: deferredQuery })

  const latest = records[0] ?? null

  const set = <K extends keyof AnimalFamachaFormData>(key: K, value: AnimalFamachaFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const loadRecords = async () => {
    if (!ready) return
    setLoading(true)
    setError('')
    try {
      setRecords(
        await read(
          (saved) =>
            (saved.famacha ?? [])
              .filter((row) => row.animal_id === animalId)
              .map((row) => normalizeAnimalFamacha(row)),
          () => fetchAnimalFamacha(animalId),
        ),
      )
    } catch (err) {
      setError(friendlyError(err, 'Failed to load FAMACHA scores'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!ready) return
    void loadRecords()
  }, [animalId, ready, cacheKey])

  const resetForm = () => {
    setForm(emptyFamachaForm())
    setEditingId(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (readOnly) {
      setError('You are offline. FAMACHA scores are view only until the connection returns.')
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      if (editingId) {
        const updated = await updateAnimalFamacha(editingId, form)
        setRecords((prev) => sortRecords(prev.map((row) => (row.id === editingId ? updated : row))))
        setSuccess('FAMACHA score updated.')
      } else {
        const created = await createAnimalFamacha({
          companyId,
          animalId,
          userId,
          form,
        })
        setRecords((prev) => sortRecords([created, ...prev]))
        setSuccess('FAMACHA score recorded.')
      }
      resetForm()
    } catch (err) {
      setError(friendlyError(err, 'Failed to save FAMACHA score'))
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (record: AnimalFamacha) => {
    setEditingId(record.id)
    setForm({
      checked_at: record.checked_at,
      score: String(record.score),
    })
    setSuccess('')
    setError('')
  }

  const handleDelete = async (record: AnimalFamacha) => {
    if (readOnly) {
      setError('You are offline. FAMACHA scores are view only until the connection returns.')
      return
    }
    if (
      !window.confirm(
        `Delete FAMACHA ${record.score} from ${formatFamachaDate(record.checked_at)}?`,
      )
    ) {
      return
    }
    try {
      await deleteAnimalFamacha(record.id)
      setRecords((prev) => prev.filter((row) => row.id !== record.id))
      if (editingId === record.id) resetForm()
      setSuccess('FAMACHA score deleted.')
    } catch (err) {
      setError(friendlyError(err, 'Failed to delete FAMACHA score'))
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-semibold text-pasture-900">FAMACHA</h3>
          <p className="mt-1 text-sm text-soil-500">
            Score from 5 (good) to 1 (bad). Each check is kept in the history.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-soil-600">{records.length}</p>
          {latest && (
            <p className={`mt-0.5 text-xs ${famachaScoreClass(latest.score)}`}>Latest {latest.score}</p>
          )}
        </div>
      </div>

      {!readOnly && (
        <form
          onSubmit={handleSubmit}
          className="section-inset mt-4 grid grid-cols-1 gap-4 rounded-2xl p-4 md:grid-cols-2"
        >
          <Input
            label="Date"
            type="date"
            value={form.checked_at}
            onChange={(e) => set('checked_at', e.target.value)}
            required
          />
          <Select
            label="FAMACHA"
            value={form.score}
            onChange={(e) => set('score', e.target.value)}
            required
          >
            <option value="">Select</option>
            {famachaScoreOptions.map((score) => (
              <option key={score} value={score}>
                {score}
              </option>
            ))}
          </Select>
          <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? 'Saving...' : editingId ? 'Update score' : 'Record score'}
            </Button>
            {editingId && (
              <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={resetForm}>
                Cancel edit
              </Button>
            )}
          </div>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-3 text-sm text-pasture-800">{success}</p>}

      {loading ? (
        <EmptyState>Loading FAMACHA history...</EmptyState>
      ) : records.length === 0 ? (
        <EmptyState>No FAMACHA scores recorded yet for this animal.</EmptyState>
      ) : (
        <>
          <div className="mt-4">
            <SearchField
              id="famacha-search"
              value={query}
              onChange={setQuery}
              placeholder="Search date or score…"
              resultCount={filteredRecords.length}
              totalCount={records.length}
            />
          </div>
          {filteredRecords.length === 0 ? (
            <EmptyState>No FAMACHA scores match your search.</EmptyState>
          ) : (
            <>
              <MobileCardList>
                {pagedRecords.map((record) => (
                  <MobileCard
                    key={record.id}
                    title={formatFamachaDate(record.checked_at)}
                    fields={[{ label: 'FAMACHA', value: String(record.score) }]}
                    action={
                      readOnly ? undefined : (
                        <div className="flex flex-col items-end gap-1">
                          <button
                            type="button"
                            className="text-xs font-semibold text-pasture-800"
                            onClick={() => startEdit(record)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-xs font-semibold text-red-700"
                            onClick={() => handleDelete(record)}
                          >
                            Delete
                          </button>
                        </div>
                      )
                    }
                  />
                ))}
              </MobileCardList>

              <DesktopTable>
                <thead>
                  <tr className="border-b border-field-dark text-soil-500">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">FAMACHA</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRecords.map((record) => (
                    <tr key={record.id} className="border-b border-field-dark/60">
                      <td className="py-3 text-soil-600">{formatFamachaDate(record.checked_at)}</td>
                      <td className={`py-3 ${famachaScoreClass(record.score)}`}>{record.score}</td>
                      <td className="py-3 text-right">
                        {!readOnly && (
                          <>
                            <button
                              type="button"
                              className="mr-3 font-semibold text-pasture-800 hover:text-pasture-700"
                              onClick={() => startEdit(record)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="font-semibold text-red-700 hover:text-red-800"
                              onClick={() => handleDelete(record)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DesktopTable>

              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                start={start}
                end={end}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}
    </Card>
  )
}
