import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { AnimalWeight, AnimalWeightFormData } from '../../lib/types'
import {
  createAnimalWeight,
  deleteAnimalWeight,
  emptyWeightForm,
  fetchAnimalWeights,
  formatWeightChange,
  formatWeightDate,
  formatWeightKg,
  updateAnimalWeight,
  weightChangeKg,
} from '../../lib/weights'
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

interface AnimalWeightsPanelProps {
  animalId: string
  companyId: string
  userId: string
}

export function AnimalWeightsPanel({ animalId, companyId, userId }: AnimalWeightsPanelProps) {
  const [records, setRecords] = useState<AnimalWeight[]>([])
  const [form, setForm] = useState<AnimalWeightFormData>(emptyWeightForm)
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
        formatWeightKg(record.weight_kg),
        formatWeightDate(record.weighed_at),
        record.notes,
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

  const changeFor = (record: AnimalWeight) => {
    const index = records.findIndex((r) => r.id === record.id)
    const older = index >= 0 ? records[index + 1] : undefined
    return weightChangeKg(record.weight_kg, older?.weight_kg)
  }

  const set = <K extends keyof AnimalWeightFormData>(key: K, value: AnimalWeightFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const loadRecords = async () => {
    setLoading(true)
    setError('')
    try {
      setRecords(await fetchAnimalWeights(animalId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load weights')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecords()
  }, [animalId])

  const resetForm = () => {
    setForm(emptyWeightForm())
    setEditingId(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      if (editingId) {
        const updated = await updateAnimalWeight(editingId, form)
        setRecords((prev) =>
          [...prev.map((r) => (r.id === editingId ? updated : r))].sort((a, b) => {
            if (a.weighed_at !== b.weighed_at) return b.weighed_at.localeCompare(a.weighed_at)
            return b.created_at.localeCompare(a.created_at)
          }),
        )
        setSuccess('Weight updated.')
      } else {
        const created = await createAnimalWeight({
          companyId,
          animalId,
          userId,
          form,
        })
        setRecords((prev) =>
          [created, ...prev].sort((a, b) => {
            if (a.weighed_at !== b.weighed_at) return b.weighed_at.localeCompare(a.weighed_at)
            return b.created_at.localeCompare(a.created_at)
          }),
        )
        setSuccess('Weight recorded.')
      }
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save weight')
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (record: AnimalWeight) => {
    setEditingId(record.id)
    setForm({
      weighed_at: record.weighed_at,
      weight_kg: String(record.weight_kg),
      notes: record.notes ?? '',
    })
    setSuccess('')
    setError('')
  }

  const handleDelete = async (record: AnimalWeight) => {
    if (
      !window.confirm(
        `Delete weight ${formatWeightKg(record.weight_kg)} from ${formatWeightDate(record.weighed_at)}?`,
      )
    ) {
      return
    }
    try {
      await deleteAnimalWeight(record.id)
      setRecords((prev) => prev.filter((r) => r.id !== record.id))
      if (editingId === record.id) resetForm()
      setSuccess('Weight deleted.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete weight')
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-semibold text-pasture-900">Weight</h3>
          <p className="mt-1 text-sm text-soil-500">
            Capture weigh-ins and track change over time.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-soil-600">{records.length}</p>
          {latest && (
            <p className="mt-0.5 text-xs text-pasture-800">
              Latest {formatWeightKg(latest.weight_kg)}
            </p>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="section-inset mt-4 grid grid-cols-1 gap-4 rounded-2xl p-4 md:grid-cols-2"
      >
        <Input
          label="Date weighed"
          type="date"
          value={form.weighed_at}
          onChange={(e) => set('weighed_at', e.target.value)}
          required
        />
        <Input
          label="Weight (kg)"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.1"
          value={form.weight_kg}
          onChange={(e) => set('weight_kg', e.target.value)}
          placeholder="e.g. 420"
          required
        />
        <div className="md:col-span-2">
          <Input
            label="Notes (optional)"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Scale, condition, weaning…"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
            {submitting ? 'Saving...' : editingId ? 'Update weight' : 'Record weight'}
          </Button>
          {editingId && (
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={resetForm}
            >
              Cancel edit
            </Button>
          )}
        </div>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-3 text-sm text-pasture-800">{success}</p>}

      {loading ? (
        <EmptyState>Loading weight history...</EmptyState>
      ) : records.length === 0 ? (
        <EmptyState>No weights recorded yet for this animal.</EmptyState>
      ) : (
        <>
          <div className="mt-4">
            <SearchField
              id="weights-search"
              value={query}
              onChange={setQuery}
              placeholder="Search weight, date, notes…"
              resultCount={filteredRecords.length}
              totalCount={records.length}
            />
          </div>
          {filteredRecords.length === 0 ? (
            <EmptyState>No weights match your search.</EmptyState>
          ) : (
            <>
              <MobileCardList>
                {pagedRecords.map((record) => {
                  const change = changeFor(record)
                  return (
                    <MobileCard
                      key={record.id}
                      title={formatWeightKg(record.weight_kg)}
                      subtitle={formatWeightDate(record.weighed_at)}
                      fields={[
                        {
                          label: 'Change',
                          value: formatWeightChange(change),
                        },
                        { label: 'Notes', value: record.notes ?? '—' },
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
                  )
                })}
              </MobileCardList>

              <DesktopTable>
                <thead>
                  <tr className="border-b border-field-dark text-soil-500">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Weight</th>
                    <th className="pb-2 font-medium">Change</th>
                    <th className="pb-2 font-medium">Notes</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRecords.map((record) => {
                    const change = changeFor(record)
                    return (
                      <tr key={record.id} className="border-b border-field-dark/60">
                        <td className="py-3 text-soil-600">
                          {formatWeightDate(record.weighed_at)}
                        </td>
                        <td className="py-3 font-medium text-soil-800">
                          {formatWeightKg(record.weight_kg)}
                        </td>
                        <td
                          className={`py-3 ${
                            change != null && change > 0
                              ? 'font-semibold text-pasture-800'
                              : change != null && change < 0
                                ? 'font-semibold text-barn-600'
                                : 'text-soil-600'
                          }`}
                        >
                          {formatWeightChange(change)}
                        </td>
                        <td className="py-3 text-soil-600">{record.notes ?? '—'}</td>
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
                    )
                  })}
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
