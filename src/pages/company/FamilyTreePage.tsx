import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Animal } from '../../lib/types'
import { animalLabel, buildPedigreeTree } from '../../lib/animals'
import { fetchOtherFarmRelatives, type OtherFarmRelative } from '../../lib/otherFarmFamily'
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
  const [otherFarm, setOtherFarm] = useState<OtherFarmRelative[]>([])

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

  useEffect(() => {
    if (!selectedId) {
      setOtherFarm([])
      return
    }
    let cancelled = false
    fetchOtherFarmRelatives(selectedId)
      .then((relatives) => {
        if (!cancelled) setOtherFarm(relatives)
      })
      .catch(() => {
        if (!cancelled) setOtherFarm([])
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

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
        description="Search for an animal to see parents, grandparents, and offspring. Relatives recorded by another farm appear view only."
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
          />
        )}
      </Card>

      {tree && (
        <Card className="border-pasture-200 bg-gradient-to-b from-pasture-50 via-panel to-panel-muted p-0">
          <div className="flex flex-col gap-3 border-b border-field-dark px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
            <div>
              <h3 className="font-display font-semibold text-pasture-900">
                {animalLabel(tree.focus)}
              </h3>
              <p className="mt-1 text-sm text-soil-500">
                Select an animal on your farm to show their family. Cards from another farm are view only.
              </p>
            </div>
            <Link to={`/app/animals/${tree.focus.id}`} className="shrink-0">
              <Button variant="secondary" className="w-full sm:w-auto">
                Open animal
              </Button>
            </Link>
          </div>
          <div className="px-2 py-2 sm:px-4">
            <PedigreeTreeView tree={tree} onSelectAnimal={selectAnimal} otherFarm={otherFarm} />
          </div>
        </Card>
      )}
    </div>
  )
}
