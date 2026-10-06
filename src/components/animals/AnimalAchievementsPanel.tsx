import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { AnimalAchievement, AnimalAchievementFormData } from '../../lib/types'
import {
  createAnimalAchievement,
  deleteAnimalAchievement,
  emptyAchievementForm,
  fetchAnimalAchievements,
  showResultSuggestions,
  updateAnimalAchievement,
} from '../../lib/achievements'
import { formatInoculationDate } from '../../lib/inoculations'
import { filterBySearch } from '../../lib/search'
import { useClientPagination } from '../../lib/pagination'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Card } from '../ui/Card'
import { SearchField } from '../ui/SearchField'
import { Pagination } from '../ui/Pagination'
import {
  DesktopTable,
  EmptyState,
  MobileCard,
  MobileCardList,
} from '../layout/AppShell'

interface AnimalAchievementsPanelProps {
  animalId: string
  companyId: string
  userId: string
}

export function AnimalAchievementsPanel({
  animalId,
  companyId,
  userId,
}: AnimalAchievementsPanelProps) {
  const [records, setRecords] = useState<AnimalAchievement[]>([])
  const [form, setForm] = useState<AnimalAchievementFormData>(emptyAchievementForm)
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
        record.show_name,
        record.class_name,
        record.result,
        record.notes,
        formatInoculationDate(record.shown_at),
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

  const loadRecords = async (showLoading = false) => {
    if (showLoading) setLoading(true)
    setError('')
    try {
      setRecords(await fetchAnimalAchievements(animalId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load show results')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecords(true)
  }, [animalId])

  const set = <K extends keyof AnimalAchievementFormData>(
    key: K,
    value: AnimalAchievementFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const resetForm = () => {
    setForm(emptyAchievementForm())
    setEditingId(null)
  }

  const startEdit = (record: AnimalAchievement) => {
    setEditingId(record.id)
    setForm({
      show_name: record.show_name,
      shown_at: record.shown_at,
      class_name: record.class_name ?? '',
      result: record.result,
      notes: record.notes ?? '',
    })
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      if (editingId) {
        const updated = await updateAnimalAchievement(editingId, form)
        setRecords((prev) =>
          prev
            .map((record) => (record.id === editingId ? updated : record))
            .sort((a, b) => b.shown_at.localeCompare(a.shown_at) || b.created_at.localeCompare(a.created_at)),
        )
        setSuccess('Show result updated.')
      } else {
        const created = await createAnimalAchievement({ companyId, animalId, userId, form })
        setRecords((prev) =>
          [created, ...prev].sort(
            (a, b) => b.shown_at.localeCompare(a.shown_at) || b.created_at.localeCompare(a.created_at),
          ),
        )
        setSuccess('Show result recorded.')
      }
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save show result')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (record: AnimalAchievement) => {
    if (!window.confirm(`Delete the ${record.result} result from ${record.show_name}?`)) return
    setError('')
    setSuccess('')
    try {
      await deleteAnimalAchievement(record.id)
      setRecords((prev) => prev.filter((item) => item.id !== record.id))
      if (editingId === record.id) resetForm()
      setSuccess('Show result deleted.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete show result')
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="font-display font-semibold text-pasture-900">
          {editingId ? 'Edit show result' : 'Achievements'}
        </h3>
        <p className="mt-1 text-sm text-soil-500">
          Record a show name, class, and result. Pick a common placing or type your own.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Show"
            value={form.show_name}
            onChange={(e) => set('show_name', e.target.value)}
            placeholder="e.g. National Boer Goat Show"
            required
          />
          <Input
            label="Show date"
            type="date"
            value={form.shown_at}
            onChange={(e) => set('shown_at', e.target.value)}
            required
          />
          <Input
            label="Class"
            value={form.class_name}
            onChange={(e) => set('class_name', e.target.value)}
            placeholder="e.g. Junior doe"
          />
          <div>
            <Input
              label="Result"
              value={form.result}
              onChange={(e) => set('result', e.target.value)}
              placeholder="e.g. Champion"
              list="show-result-suggestions"
              required
            />
            <datalist id="show-result-suggestions">
              {showResultSuggestions.map((result) => (
                <option key={result} value={result} />
              ))}
            </datalist>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="achievement-notes" className="block text-sm font-semibold text-soil-700">
              Notes
            </label>
            <textarea
              id="achievement-notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-field-dark bg-white px-3 py-2.5 text-base outline-none focus:border-pasture-600 focus:ring-2 focus:ring-pasture-100 sm:text-sm"
              placeholder="Judge, ring, or other detail"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? 'Saving...' : editingId ? 'Update result' : 'Save result'}
            </Button>
            {editingId && (
              <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={resetForm}>
                Cancel edit
              </Button>
            )}
          </div>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-3 text-sm text-pasture-800">{success}</p>}
      </Card>

      <Card>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold text-pasture-900">Show results</h3>
            <p className="mt-1 text-sm text-soil-500">Newest show date first.</p>
          </div>
          <p className="text-sm font-semibold text-soil-600">{records.length}</p>
        </div>
        {loading ? (
          <EmptyState>Loading show results...</EmptyState>
        ) : records.length === 0 ? (
          <EmptyState>No show results yet for this animal.</EmptyState>
        ) : (
          <>
            <div className="mt-4">
              <SearchField
                id="achievements-search"
                value={query}
                onChange={setQuery}
                placeholder="Search show, class, result…"
                resultCount={filteredRecords.length}
                totalCount={records.length}
              />
            </div>
            {filteredRecords.length === 0 ? (
              <EmptyState>No show results match your search.</EmptyState>
            ) : (
              <>
                <MobileCardList>
                  {pagedRecords.map((record) => (
                    <MobileCard
                      key={record.id}
                      title={record.result}
                      subtitle={record.show_name}
                      fields={[
                        { label: 'Date', value: formatInoculationDate(record.shown_at) },
                        { label: 'Class', value: record.class_name ?? '—' },
                      ]}
                      action={
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
                      }
                    />
                  ))}
                </MobileCardList>
                <DesktopTable>
                  <thead>
                    <tr className="border-b border-field-dark text-soil-500">
                      <th className="pb-2 font-medium">Result</th>
                      <th className="pb-2 font-medium">Show</th>
                      <th className="pb-2 font-medium">Class</th>
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRecords.map((record) => (
                      <tr key={record.id} className="border-b border-field-dark/60">
                        <td className="py-3 font-medium text-soil-800">{record.result}</td>
                        <td className="py-3 text-soil-600">
                          {record.show_name}
                          {record.notes && (
                            <span className="mt-0.5 block text-xs text-soil-500">{record.notes}</span>
                          )}
                        </td>
                        <td className="py-3 text-soil-600">{record.class_name ?? '—'}</td>
                        <td className="py-3 text-soil-600">{formatInoculationDate(record.shown_at)}</td>
                        <td className="py-3 text-right">
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
    </div>
  )
}
