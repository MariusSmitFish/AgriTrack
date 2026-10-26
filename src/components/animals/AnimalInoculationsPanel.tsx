import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { AnimalInoculation, AnimalInoculationFormData, HealthRecordKind } from '../../lib/types'
import {
  createAnimalInoculation,
  deleteAnimalInoculation,
  emptyInoculationForm,
  fetchAnimalInoculations,
  formatInoculationDate,
  inoculationDisplayName,
  isInoculationOverdue,
  treatmentMedication,
  updateAnimalInoculation,
} from '../../lib/inoculations'
import { fetchHealthOptions } from '../../lib/healthOptions'
import { filterBySearch } from '../../lib/search'
import { useClientPagination } from '../../lib/pagination'
import { useOfflineRead } from '../../contexts/OfflineContext'
import { errorText } from '../../lib/offlineHerd'
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
  const { ready, read, cacheKey, readOnly } = useOfflineRead()
  const [records, setRecords] = useState<AnimalInoculation[]>([])
  const [optionNames, setOptionNames] = useState({
    vaccination: [] as string[],
    condition: [] as string[],
    medication: [] as string[],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadRecords = async (showLoading = false) => {
    if (!ready) return
    if (showLoading) setLoading(true)
    setError('')
    try {
      const data = await read(
        (saved) => ({
          records: saved.inoculations.filter((row) => row.animal_id === animalId),
          options: saved.healthOptions,
        }),
        async () => {
          const [nextRecords, options] = await Promise.all([
            fetchAnimalInoculations(animalId),
            fetchHealthOptions(companyId),
          ])
          return { records: nextRecords, options }
        },
      )
      setRecords(data.records)
      setOptionNames({
        vaccination: data.options.filter((option) => option.kind === 'vaccination').map((option) => option.name),
        condition: data.options.filter((option) => option.kind === 'condition').map((option) => option.name),
        medication: data.options.filter((option) => option.kind === 'medication').map((option) => option.name),
      })
    } catch (err) {
      setError(errorText(err, 'Failed to load health records'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!ready) return
    void loadRecords(true)
  }, [animalId, companyId, ready, cacheKey])

  return (
    <div className="space-y-6 sm:space-y-8">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <HealthSection
        kind="vaccination"
        title="Vaccinations"
        itemLabel="Vaccine"
        records={records.filter((record) => record.kind !== 'treatment')}
        optionNames={optionNames.vaccination}
        animalId={animalId}
        companyId={companyId}
        userId={userId}
        loading={loading}
        readOnly={readOnly}
        onReload={loadRecords}
      />
      <HealthSection
        kind="treatment"
        title="Treatments"
        itemLabel="Treatment"
        records={records.filter((record) => record.kind === 'treatment')}
        optionNames={[]}
        conditionNames={optionNames.condition}
        medicationNames={optionNames.medication}
        animalId={animalId}
        companyId={companyId}
        userId={userId}
        loading={loading}
        readOnly={readOnly}
        onReload={loadRecords}
      />
    </div>
  )
}

function withCurrentChoice(current: string, options: string[]) {
  if (current && !options.includes(current)) return [current, ...options]
  return options
}

function HealthSection({
  kind,
  title,
  itemLabel,
  records,
  optionNames,
  conditionNames = [],
  medicationNames = [],
  animalId,
  companyId,
  userId,
  loading,
  readOnly,
  onReload,
}: {
  kind: HealthRecordKind
  title: string
  itemLabel: string
  records: AnimalInoculation[]
  optionNames: string[]
  conditionNames?: string[]
  medicationNames?: string[]
  animalId: string
  companyId: string
  userId: string
  loading: boolean
  readOnly: boolean
  onReload: () => Promise<void>
}) {
  const [form, setForm] = useState<AnimalInoculationFormData>(emptyInoculationForm(kind))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const noun = itemLabel.toLowerCase()
  const isTreatment = kind === 'treatment'

  const choices = useMemo(
    () => withCurrentChoice(form.name, optionNames),
    [form.name, optionNames],
  )
  const conditionChoices = useMemo(
    () => withCurrentChoice(form.condition, conditionNames),
    [form.condition, conditionNames],
  )
  const medicationChoices = useMemo(
    () => withCurrentChoice(form.medication, medicationNames),
    [form.medication, medicationNames],
  )

  const filteredRecords = useMemo(
    () =>
      filterBySearch(records, deferredQuery, (record) => [
        record.name,
        record.condition,
        record.medication,
        inoculationDisplayName(record),
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
  } = useClientPagination(filteredRecords, { resetKey: `${kind}:${deferredQuery}` })

  const set = <K extends keyof AnimalInoculationFormData>(
    key: K,
    value: AnimalInoculationFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const resetForm = () => {
    setForm(emptyInoculationForm(kind))
    setEditingId(null)
  }

  const startEdit = (record: AnimalInoculation) => {
    setEditingId(record.id)
    setForm({
      kind,
      name: record.name,
      condition: record.condition ?? '',
      medication: isTreatment ? treatmentMedication(record) : '',
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
    if (readOnly) {
      setError('You are offline. Health records are view only until the connection returns.')
      return
    }
    if (isTreatment) {
      if (!form.condition.trim()) {
        setError('Choose a condition or symptom.')
        return
      }
      if (!form.medication.trim()) {
        setError('Choose a medication.')
        return
      }
    } else if (!form.name.trim()) {
      setError(`Choose a ${noun}.`)
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
        await updateAnimalInoculation(editingId, form)
        setSuccess(`${itemLabel} updated.`)
      } else {
        await createAnimalInoculation({ companyId, animalId, userId, form })
        setSuccess(`${itemLabel} recorded.`)
      }
      resetForm()
      await onReload()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to save ${noun}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (record: AnimalInoculation) => {
    if (readOnly) {
      setError('You are offline. Health records are view only until the connection returns.')
      return
    }
    const recordLabel = isTreatment ? inoculationDisplayName(record) : record.name
    if (!window.confirm(`Delete ${noun} "${recordLabel}"?`)) return
    setError('')
    setSuccess('')
    try {
      await deleteAnimalInoculation(record.id)
      if (editingId === record.id) resetForm()
      setSuccess(`${itemLabel} deleted.`)
      await onReload()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to delete ${noun}`)
    }
  }

  return (
    <div className="space-y-5">
      {!readOnly && (
      <Card>
        <h3 className="font-display font-semibold text-pasture-900">
          {editingId ? `Edit ${noun}` : `Record ${noun}`}
        </h3>
        <p className="mt-1 text-sm text-soil-500">
          {isTreatment
            ? 'Choose the condition or symptoms and the medication from Configurations. The date defaults to today.'
            : `Choose a ${noun} from Configurations. The date defaults to today.`}
        </p>
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {isTreatment ? (
            <>
              <Select
                label="Condition / symptoms"
                id={`${kind}-condition`}
                value={form.condition}
                onChange={(e) => set('condition', e.target.value)}
                required
                disabled={conditionNames.length === 0 && !form.condition}
              >
                <option value="">
                  {conditionNames.length === 0 ? 'No conditions configured' : 'Select condition or symptom'}
                </option>
                {conditionChoices.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
              <Select
                label="Medication"
                id={`${kind}-medication`}
                value={form.medication}
                onChange={(e) => set('medication', e.target.value)}
                required
                disabled={medicationNames.length === 0 && !form.medication}
              >
                <option value="">
                  {medicationNames.length === 0 ? 'No medications configured' : 'Select medication'}
                </option>
                {medicationChoices.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
              {(conditionNames.length === 0 || medicationNames.length === 0) && (
                <p className="text-sm text-soil-500 md:col-span-2">
                  <Link to="/app/configurations" className="font-semibold text-pasture-800 hover:text-pasture-700">
                    Add conditions and medications in Configurations
                  </Link>
                  .
                </p>
              )}
            </>
          ) : (
          <div className="md:col-span-2">
            <Select
              label={itemLabel}
              id={`${kind}-name`}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              disabled={choices.length === 0}
            >
              <option value="">{choices.length === 0 ? `No ${title.toLowerCase()} configured` : `Select ${noun}`}</option>
              {choices.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
            {choices.length === 0 && (
              <p className="mt-2 text-sm text-soil-500">
                <Link to="/app/configurations" className="font-semibold text-pasture-800 hover:text-pasture-700">
                  Add {title.toLowerCase()} in Configurations
                </Link>
                .
              </p>
            )}
          </div>
          )}
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
            <label htmlFor={`${kind}-notes`} className="block text-sm font-semibold text-soil-700">
              Notes
            </label>
            <textarea
              id={`${kind}-notes`}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-field-dark bg-white px-3 py-2.5 text-base outline-none focus:border-pasture-600 focus:ring-2 focus:ring-pasture-100 sm:text-sm"
              placeholder={isTreatment ? 'Response, withdrawal, follow-up...' : 'Site, reaction, booster schedule...'}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
            <Button
              type="submit"
              disabled={
                submitting ||
                (isTreatment
                  ? (conditionNames.length === 0 && !form.condition.trim()) ||
                    (medicationNames.length === 0 && !form.medication.trim())
                  : choices.length === 0)
              }
              className="w-full sm:w-auto"
            >
              {submitting ? 'Saving...' : editingId ? `Update ${noun}` : `Save ${noun}`}
            </Button>
            {editingId && (
              <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={resetForm}>
                Cancel edit
              </Button>
            )}
          </div>
        </form>
      </Card>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-pasture-800">{success}</p>}

      <Card>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold text-pasture-900">{title} history</h3>
            <p className="mt-1 text-sm text-soil-500">Newest first.</p>
          </div>
          <p className="text-sm font-semibold text-soil-600">{records.length}</p>
        </div>
        {loading ? (
          <EmptyState>Loading {title.toLowerCase()}...</EmptyState>
        ) : records.length === 0 ? (
          <EmptyState>No {title.toLowerCase()} recorded yet for this animal.</EmptyState>
        ) : (
          <>
            <div className="mt-4">
              <SearchField
                id={`${kind}-search`}
                value={query}
                onChange={setQuery}
                placeholder={
                  isTreatment
                    ? 'Search condition, medication, batch, date, notes…'
                    : `Search ${noun}, batch, date, notes…`
                }
                resultCount={filteredRecords.length}
                totalCount={records.length}
              />
            </div>
            {filteredRecords.length === 0 ? (
              <EmptyState>No {title.toLowerCase()} match your search.</EmptyState>
            ) : (
              <>
                <MobileCardList>
                  {pagedRecords.map((record) => (
                    <MobileCard
                      key={record.id}
                      title={
                        isTreatment
                          ? record.condition?.trim() || treatmentMedication(record) || record.name
                          : record.name
                      }
                      subtitle={formatInoculationDate(record.administered_at)}
                      fields={[
                        ...(isTreatment
                          ? [{ label: 'Medication', value: treatmentMedication(record) || '—' }]
                          : []),
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
                      <th className="pb-2 font-medium">{isTreatment ? 'Condition' : itemLabel}</th>
                      {isTreatment && <th className="pb-2 font-medium">Medication</th>}
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
                          {isTreatment ? record.condition?.trim() || '—' : record.name}
                          {!isTreatment && record.dosage && (
                            <span className="mt-0.5 block text-xs font-normal text-soil-500">
                              {record.dosage}
                            </span>
                          )}
                        </td>
                        {isTreatment && (
                          <td className="py-3 font-medium text-soil-800">
                            {treatmentMedication(record) || '—'}
                            {record.dosage && (
                              <span className="mt-0.5 block text-xs font-normal text-soil-500">
                                {record.dosage}
                              </span>
                            )}
                          </td>
                        )}
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
    </div>
  )
}
