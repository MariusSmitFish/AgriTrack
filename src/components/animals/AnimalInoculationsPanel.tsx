import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { AnimalInoculation, AnimalInoculationFormData } from '../../lib/types'
import {
  commonInoculationNames,
  createAnimalInoculation,
  deleteAnimalInoculation,
  emptyInoculationForm,
  fetchAnimalInoculations,
  formatInoculationDate,
  isInoculationOverdue,
  updateAnimalInoculation,
} from '../../lib/inoculations'
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

interface AnimalInoculationsPanelProps {
  animalId: string
  companyId: string
  userId: string
}

export function AnimalInoculationsPanel({
  animalId,
  companyId,
  userId,
}: AnimalInoculationsPanelProps) {
  const [records, setRecords] = useState<AnimalInoculation[]>([])
  const [form, setForm] = useState<AnimalInoculationFormData>(emptyInoculationForm)
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
        record.name,
        record.batch_number,
        record.dosage,
        record.administered_by,
        record.notes,
        formatInoculationDate(record.administered_at),
        formatInoculationDate(record.next_due_at),
        isInoculationOverdue(record.next_due_at) ? 'overdue' : '',
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

  const set = <K extends keyof AnimalInoculationFormData>(
    key: K,
    value: AnimalInoculationFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const loadRecords = async () => {
    setLoading(true)
    setError('')
    try {
      setRecords(await fetchAnimalInoculations(animalId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inoculations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecords()
  }, [animalId])

  const resetForm = () => {
    setForm(emptyInoculationForm())
    setEditingId(null)
  }

  const startEdit = (record: AnimalInoculation) => {
    setEditingId(record.id)
    setForm({
      name: record.name,
      administered_at: record.administered_at,
      next_due_at: record.next_due_at ?? '',
      batch_number: record.batch_number ?? '',
      dosage: record.dosage ?? '',
      administered_by: record.administered_by ?? '',
      notes: record.notes ?? '',
    })
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Inoculation name is required.')
      return
    }
    if (!form.administered_at) {
      setError('Administered date is required.')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      if (editingId) {
        const updated = await updateAnimalInoculation(editingId, form)
        setRecords((prev) =>
          prev
            .map((r) => (r.id === editingId ? updated : r))
            .sort((a, b) => b.administered_at.localeCompare(a.administered_at)),
        )
        setSuccess('Inoculation updated.')
      } else {
        const created = await createAnimalInoculation({
          companyId,
          animalId,
          userId,
          form,
        })
        setRecords((prev) =>
          [created, ...prev].sort((a, b) => b.administered_at.localeCompare(a.administered_at)),
        )
        setSuccess('Inoculation recorded.')
      }
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save inoculation')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (record: AnimalInoculation) => {
    if (!window.confirm(`Delete inoculation "${record.name}"?`)) return

    setError('')
    setSuccess('')
    try {
      await deleteAnimalInoculation(record.id)
      setRecords((prev) => prev.filter((r) => r.id !== record.id))
      if (editingId === record.id) resetForm()
      setSuccess('Inoculation deleted.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete inoculation')
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <Card>
        <h3 className="font-display font-semibold text-pasture-900">
          {editingId ? 'Edit inoculation' : 'Record inoculation'}
        </h3>
        <p className="mt-1 text-sm text-soil-500">
          Track vaccines and treatments. Date defaults to today and can be changed.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <label htmlFor="inoculation-name" className="block text-sm font-semibold text-soil-700">
              Inoculation / vaccine
            </label>
            <input
              id="inoculation-name"
              list="common-inoculations"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              placeholder="e.g. Clostridial 5-in-1"
              className="w-full rounded-xl border border-field-dark bg-white px-3 py-2.5 text-base outline-none focus:border-pasture-600 focus:ring-2 focus:ring-pasture-100 sm:text-sm"
            />
            <datalist id="common-inoculations">
              {commonInoculationNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <Input
            label="Administered date"
            type="date"
            value={form.administered_at}
            onChange={(e) => set('administered_at', e.target.value)}
            required
          />
          <Input
            label="Next due date (optional)"
            type="date"
            value={form.next_due_at}
            onChange={(e) => set('next_due_at', e.target.value)}
          />
          <Input
            label="Batch / lot number"
            value={form.batch_number}
            onChange={(e) => set('batch_number', e.target.value)}
            placeholder="Optional"
          />
          <Input
            label="Dosage"
            value={form.dosage}
            onChange={(e) => set('dosage', e.target.value)}
            placeholder="e.g. 2 ml"
          />
          <Input
            label="Administered by"
            value={form.administered_by}
            onChange={(e) => set('administered_by', e.target.value)}
            placeholder="Vet or staff name"
          />
          <div className="md:col-span-2">
            <label htmlFor="inoculation-notes" className="block text-sm font-semibold text-soil-700">
              Notes
            </label>
            <textarea
              id="inoculation-notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-field-dark bg-white px-3 py-2.5 text-base outline-none focus:border-pasture-600 focus:ring-2 focus:ring-pasture-100 sm:text-sm"
              placeholder="Site, reaction, booster schedule..."
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? 'Saving...' : editingId ? 'Update inoculation' : 'Save inoculation'}
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
            <h3 className="font-display font-semibold text-pasture-900">Inoculation history</h3>
            <p className="mt-1 text-sm text-soil-500">Newest first.</p>
          </div>
          <p className="text-sm font-semibold text-soil-600">{records.length}</p>
        </div>

        {loading ? (
          <EmptyState>Loading inoculations...</EmptyState>
        ) : records.length === 0 ? (
          <EmptyState>No inoculations recorded yet for this animal.</EmptyState>
        ) : (
          <>
            <div className="mt-4">
              <SearchField
                id="inoculations-search"
                value={query}
                onChange={setQuery}
                placeholder="Search vaccine, batch, date, notes…"
                resultCount={filteredRecords.length}
                totalCount={records.length}
              />
            </div>
            {filteredRecords.length === 0 ? (
              <EmptyState>No inoculations match your search.</EmptyState>
            ) : (
          <>
            <MobileCardList>
              {pagedRecords.map((record) => (
                <MobileCard
                  key={record.id}
                  title={record.name}
                  subtitle={formatInoculationDate(record.administered_at)}
                  fields={[
                    {
                      label: 'Next due',
                      value: record.next_due_at
                        ? `${formatInoculationDate(record.next_due_at)}${
                            isInoculationOverdue(record.next_due_at) ? ' (overdue)' : ''
                          }`
                        : '—',
                    },
                    { label: 'Batch', value: record.batch_number ?? '—' },
                    { label: 'By', value: record.administered_by ?? '—' },
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
                  <th className="pb-2 font-medium">Inoculation</th>
                  <th className="pb-2 font-medium">Administered</th>
                  <th className="pb-2 font-medium">Next due</th>
                  <th className="pb-2 font-medium">Batch</th>
                  <th className="pb-2 font-medium">By</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {pagedRecords.map((record) => (
                  <tr key={record.id} className="border-b border-field-dark/60">
                    <td className="py-3 font-medium text-soil-800">
                      {record.name}
                      {record.dosage && (
                        <span className="mt-0.5 block text-xs font-normal text-soil-500">
                          {record.dosage}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-soil-600">
                      {formatInoculationDate(record.administered_at)}
                    </td>
                    <td className="py-3 text-soil-600">
                      {record.next_due_at ? (
                        <span
                          className={
                            isInoculationOverdue(record.next_due_at)
                              ? 'font-semibold text-barn-600'
                              : undefined
                          }
                        >
                          {formatInoculationDate(record.next_due_at)}
                          {isInoculationOverdue(record.next_due_at) ? ' · overdue' : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 text-soil-600">{record.batch_number ?? '—'}</td>
                    <td className="py-3 text-soil-600">{record.administered_by ?? '—'}</td>
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
