import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Animal } from '../../lib/types'
import { animalLabel, buildPedigreeTree } from '../../lib/animals'
import { ParentPicker } from '../../components/animals/ParentPicker'
import { PedigreeTreeView } from '../../components/animals/PedigreeTreeView'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/layout/AppShell'

export function FamilyTreePage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [animals, setAnimals] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(searchParams.get('animal') ?? '')

  useEffect(() => {
    if (!profile?.company_id) return

    setLoading(true)
    supabase
      .from('animals')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (fetchError) setError(fetchError.message)
        else setAnimals(data ?? [])
        setLoading(false)
      })
  }, [profile?.company_id])

  useEffect(() => {
    const fromUrl = searchParams.get('animal')
    if (fromUrl) setSelectedId(fromUrl)
  }, [searchParams])

  const tree = useMemo(
    () => (selectedId ? buildPedigreeTree(animals, selectedId) : null),
    [animals, selectedId],
  )

  const selectAnimal = (id: string) => {
    setSelectedId(id)
    setSearchParams(id ? { animal: id } : {})
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Family tree"
        description="Search for an animal to see parents, grandparents, and offspring."
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        {loading ? (
          <p className="text-sm text-soil-500">Loading animals...</p>
        ) : animals.length === 0 ? (
          <div>
            <p className="font-display text-lg font-semibold text-pasture-900">No animals yet</p>
            <p className="mt-2 text-sm text-soil-500">Capture an animal to start a family tree.</p>
            <Link to="/app/animals/new" className="mt-4 inline-block">
              <Button>Capture your first animal</Button>
            </Link>
          </div>
        ) : (
          <ParentPicker
            id="family-tree-animal"
            label="Animal"
            animals={animals}
            selectedId={selectedId}
            onSelect={selectAnimal}
            enableTagScan
          />
        )}
      </Card>

      {tree && (
        <Card className="border-pasture-200 bg-gradient-to-b from-pasture-50 via-panel to-panel-muted p-0">
          <div className="border-b border-field-dark px-4 py-4 sm:px-6">
            <h3 className="font-display font-semibold text-pasture-900">
              {animalLabel(tree.focus)}
            </h3>
            <p className="mt-1 text-sm text-soil-500">
              Select any animal in the tree to open their family.
            </p>
          </div>
          <div className="px-2 py-2 sm:px-4">
            <PedigreeTreeView tree={tree} onSelectAnimal={selectAnimal} />
          </div>
        </Card>
      )}
    </div>
  )
}
