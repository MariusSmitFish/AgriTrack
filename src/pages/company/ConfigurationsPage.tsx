import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import type { HealthOption, HealthRecordKind } from '../../lib/types'
import { createHealthOption, deleteHealthOption, fetchHealthOptions } from '../../lib/healthOptions'
import { fetchCompanyStudNumber, updateCompanyStudNumber } from '../../lib/companySettings'
import { digitsOnly, padDigits } from '../../lib/animals'
import { healthKindLabel } from '../../lib/inoculations'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { EmptyState, PageHeader } from '../../components/layout/AppShell'

export function ConfigurationsPage() {
  const { profile } = useAuth()
  const [options, setOptions] = useState<HealthOption[]>([])
  const [studNumber, setStudNumber] = useState('')
  const [savingStud, setSavingStud] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadOptions = async (showLoading = false) => {
    if (!profile?.company_id) return
    if (showLoading) setLoading(true)
    try {
      setOptions(await fetchHealthOptions(profile.company_id))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configurations')
    }

    try {
      setStudNumber(await fetchCompanyStudNumber(profile.company_id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the stud number')
    } finally {
      setLoading(false)
    }
  }

  const saveStudNumber = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile?.company_id) return
    setSavingStud(true)
    setError('')
    setSuccess('')
    try {
      const saved = await updateCompanyStudNumber(profile.company_id, studNumber)
      setStudNumber(saved)
      setSuccess(saved ? 'Stud number saved.' : 'Stud number cleared.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save stud number')
    } finally {
      setSavingStud(false)
    }
  }

  useEffect(() => {
    loadOptions(true)
  }, [profile?.company_id])

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Configurations"
        description="Set the farm stud number used on new kids, and manage vaccine and treatment names."
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-pasture-800">{success}</p>}

      {loading ? (
        <Card>
          <EmptyState>Loading configurations...</EmptyState>
        </Card>
      ) : (
        <>
        <Card>
          <h3 className="font-display font-semibold text-pasture-900">Stud number</h3>
          <p className="mt-1 text-sm text-soil-500">
            This is the stud part of the animal ID when you capture a birth. It is four digits, for example 4521.
          </p>
          <form onSubmit={saveStudNumber} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:max-w-xs">
              <Input
                label="Farm stud number"
                inputMode="numeric"
                value={studNumber}
                onChange={(e) => setStudNumber(digitsOnly(e.target.value, 4))}
                onBlur={(e) => setStudNumber(padDigits(e.target.value, 4))}
                placeholder="4521"
                maxLength={4}
              />
            </div>
            <Button type="submit" disabled={savingStud} className="w-full sm:w-auto">
              {savingStud ? 'Saving...' : 'Save stud number'}
            </Button>
          </form>
        </Card>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <OptionList
            kind="vaccination"
            title="Vaccinations"
            description="These names appear when you record a vaccination."
            options={options.filter((option) => option.kind === 'vaccination')}
            companyId={profile?.company_id ?? ''}
            onChanged={loadOptions}
            onMessage={setSuccess}
            onError={setError}
          />
          <OptionList
            kind="treatment"
            title="Treatments"
            description="These names appear when you record a treatment."
            options={options.filter((option) => option.kind === 'treatment')}
            companyId={profile?.company_id ?? ''}
            onChanged={loadOptions}
            onMessage={setSuccess}
            onError={setError}
          />
        </div>
        </>
      )}
    </div>
  )
}

function OptionList({
  kind,
  title,
  description,
  options,
  companyId,
  onChanged,
  onMessage,
  onError,
}: {
  kind: HealthRecordKind
  title: string
  description: string
  options: HealthOption[]
  companyId: string
  onChanged: () => Promise<void>
  onMessage: (message: string) => void
  onError: (message: string) => void
}) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const label = healthKindLabel(kind).toLowerCase()

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!companyId || !name.trim()) return

    setSaving(true)
    onError('')
    onMessage('')
    try {
      await createHealthOption({ companyId, kind, name })
      setName('')
      onMessage(`${healthKindLabel(kind)} added.`)
      await onChanged()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add option'
      onError(
        message.toLowerCase().includes('duplicate') || message.toLowerCase().includes('unique')
          ? `That ${label} is already in the list.`
          : message,
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (option: HealthOption) => {
    if (!window.confirm(`Remove "${option.name}" from ${title.toLowerCase()}? Past records keep this name.`)) {
      return
    }
    onError('')
    onMessage('')
    try {
      await deleteHealthOption(option.id)
      onMessage(`${option.name} removed.`)
      await onChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to remove option')
    }
  }

  return (
    <Card>
      <h3 className="font-display font-semibold text-pasture-900">{title}</h3>
      <p className="mt-1 text-sm text-soil-500">{description}</p>
      <form onSubmit={handleAdd} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Input
            label={`New ${label}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === 'vaccination' ? 'e.g. Pulpy kidney' : 'e.g. Dewormer'}
          />
        </div>
        <Button type="submit" disabled={saving || !name.trim()} className="w-full sm:w-auto">
          {saving ? 'Adding...' : 'Add'}
        </Button>
      </form>

      {options.length === 0 ? (
        <EmptyState>No {title.toLowerCase()} yet.</EmptyState>
      ) : (
        <ul className="mt-4 divide-y divide-field-dark overflow-hidden rounded-xl border border-field-dark">
          {options.map((option) => (
            <li key={option.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="text-sm font-medium text-soil-800">{option.name}</span>
              <button
                type="button"
                className="text-sm font-semibold text-red-700 hover:text-red-800"
                onClick={() => handleDelete(option)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
