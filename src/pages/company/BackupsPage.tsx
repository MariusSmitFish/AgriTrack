import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  createAnimalBackup,
  deleteFarmBackup,
  downloadFarmBackup,
  fetchFarmBackups,
} from '../../lib/backups'
import type { FarmBackup } from '../../lib/types'
import { formatFileSize } from '../../lib/animalDocuments'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import {
  DesktopTable,
  EmptyState,
  MobileCard,
  MobileCardList,
  PageHeader,
} from '../../components/layout/AppShell'

function formatBackupWhen(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function BackupsPage() {
  const { profile } = useAuth()
  const [backups, setBackups] = useState<FarmBackup[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadBackups = useCallback(async () => {
    if (!profile?.company_id) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setBackups(await fetchFarmBackups(profile.company_id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load backups')
    } finally {
      setLoading(false)
    }
  }, [profile?.company_id])

  useEffect(() => {
    void loadBackups()
  }, [loadBackups])

  const handleCreate = async () => {
    if (!profile?.company_id) return
    setCreating(true)
    setError('')
    setSuccess('')
    try {
      const backup = await createAnimalBackup(profile.company_id, profile.id)
      setBackups((current) => [backup, ...current.filter((item) => item.id !== backup.id)])
      setSuccess(
        `Saved ${backup.file_name} with ${backup.animal_count} ${backup.animal_count === 1 ? 'animal' : 'animals'}.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create backup')
    } finally {
      setCreating(false)
    }
  }

  const handleDownload = async (backup: FarmBackup) => {
    setBusyId(backup.id)
    setError('')
    try {
      await downloadFarmBackup(backup)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download backup')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (backup: FarmBackup) => {
    if (!window.confirm(`Delete ${backup.file_name}? The saved file will be removed.`)) return
    setBusyId(backup.id)
    setError('')
    setSuccess('')
    try {
      await deleteFarmBackup(backup)
      setBackups((current) => current.filter((item) => item.id !== backup.id))
      setSuccess(`${backup.file_name} deleted.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete backup')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Backups"
        description="Save a CSV copy of every animal on this farm. Each backup stays here until you delete it."
      />

      <Card>
        <h3 className="font-display text-lg font-semibold text-pasture-900">Create backup</h3>
        <p className="mt-1 text-sm text-soil-600">
          The file includes animal IDs, parents, birth dates, status, sale price, and the other animal details.
        </p>
        <Button type="button" className="mt-4 w-full sm:w-auto" disabled={creating} onClick={() => void handleCreate()}>
          {creating ? 'Saving backup...' : 'Create animal backup'}
        </Button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-3 text-sm text-pasture-800">{success}</p>}
      </Card>

      <Card>
        <h3 className="font-display text-lg font-semibold text-pasture-900">Saved backups</h3>
        {loading ? (
          <EmptyState>Loading backups...</EmptyState>
        ) : backups.length === 0 ? (
          <EmptyState>No backups yet. Create one to keep a copy of your animals.</EmptyState>
        ) : (
          <>
            <MobileCardList>
              {backups.map((backup) => (
                <MobileCard
                  key={backup.id}
                  title={backup.file_name}
                  subtitle={formatBackupWhen(backup.created_at)}
                  fields={[
                    {
                      label: 'Animals',
                      value: String(backup.animal_count),
                    },
                    {
                      label: 'Size',
                      value: formatFileSize(backup.file_size) || '—',
                    },
                  ]}
                  action={
                    <div className="flex flex-col items-end gap-1">
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-3 py-1.5 text-xs"
                        disabled={busyId === backup.id}
                        onClick={() => void handleDownload(backup)}
                      >
                        Download
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        className="px-3 py-1.5 text-xs"
                        disabled={busyId === backup.id}
                        onClick={() => void handleDelete(backup)}
                      >
                        Delete
                      </Button>
                    </div>
                  }
                />
              ))}
            </MobileCardList>

            <DesktopTable>
              <thead>
                <tr className="border-b border-field-dark text-soil-500">
                  <th className="pb-2 font-medium">File</th>
                  <th className="pb-2 font-medium">Created</th>
                  <th className="pb-2 font-medium">Animals</th>
                  <th className="pb-2 font-medium">Size</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.id} className="border-b border-field-dark/60">
                    <td className="py-3 font-medium text-soil-800">{backup.file_name}</td>
                    <td className="py-3 text-soil-600">{formatBackupWhen(backup.created_at)}</td>
                    <td className="py-3 text-soil-600">{backup.animal_count}</td>
                    <td className="py-3 text-soil-600">{formatFileSize(backup.file_size) || '—'}</td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <Button
                        type="button"
                        variant="secondary"
                        className="mr-2 px-3 py-1.5 text-xs"
                        disabled={busyId === backup.id}
                        onClick={() => void handleDownload(backup)}
                      >
                        Download
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        className="px-3 py-1.5 text-xs"
                        disabled={busyId === backup.id}
                        onClick={() => void handleDelete(backup)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DesktopTable>
          </>
        )}
      </Card>
    </div>
  )
}
