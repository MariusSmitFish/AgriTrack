import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { deleteAnimal } from '../../lib/animals'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/layout/AppShell'
import { StamboekImportPanel } from './ImportStambookPage'

export function StamboekPage() {
  const { profile } = useAuth()
  const [count, setCount] = useState(0)
  const [loadingCount, setLoadingCount] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isAdmin = profile?.role === 'company_admin'

  const loadCount = useCallback(async () => {
    if (!profile?.company_id) {
      setLoadingCount(false)
      return
    }
    setLoadingCount(true)
    const { count: total, error: countError } = await supabase
      .from('animals')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', profile.company_id)
      .eq('status', 'stamboek')

    if (countError) setError(countError.message)
    else setCount(total ?? 0)
    setLoadingCount(false)
  }, [profile?.company_id])

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

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Stamboek"
        description="Kraalkaart import and Stamboek cleanup live here. More Stamboek tools can be added on this page."
      />

      <StamboekImportPanel onImported={() => void loadCount()} />

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
