import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Animal } from '../../lib/types'
import {
  animalLabel,
  animalOptionLabel,
  buildPedigreeTree,
  formatAnimalSex,
  formatAnimalStatus,
  wouldCreatePedigreeCycle,
} from '../../lib/animals'
import { filterBySearch } from '../../lib/search'
import { PedigreeTreeView } from '../../components/animals/PedigreeTreeView'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Card } from '../../components/ui/Card'
import { SearchField } from '../../components/ui/SearchField'
import { PageHeader } from '../../components/layout/AppShell'

export function FamilyTreePage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [animals, setAnimals] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState(searchParams.get('animal') ?? '')
  const [damId, setDamId] = useState('')
  const [sireId, setSireId] = useState('')
  const [animalQuery, setAnimalQuery] = useState('')
  const [parentQuery, setParentQuery] = useState('')
  const deferredAnimalQuery = useDeferredValue(animalQuery)
  const deferredParentQuery = useDeferredValue(parentQuery)

  const loadAnimals = async () => {
    if (!profile?.company_id) return

    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('animals')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })

    if (fetchError) setError(fetchError.message)
    else setAnimals(data ?? [])

    setLoading(false)
  }

  useEffect(() => {
    loadAnimals()
  }, [profile?.company_id])

  useEffect(() => {
    const fromUrl = searchParams.get('animal')
    if (fromUrl) setSelectedId(fromUrl)
  }, [searchParams])

  useEffect(() => {
    if (!selectedId && animals.length > 0) {
      setSelectedId(animals[0].id)
    }
  }, [animals, selectedId])

  const selectableAnimals = useMemo(() => {
    const filtered = filterBySearch(animals, deferredAnimalQuery, (animal) => [
      animal.tag_number,
      animal.stud_tag_number,
      animal.name,
      animal.breed,
      formatAnimalSex(animal.sex),
      formatAnimalStatus(animal.status),
    ])

    // Keep the currently selected animal visible even if it doesn't match the filter
    if (selectedId && !filtered.some((a) => a.id === selectedId)) {
      const selected = animals.find((a) => a.id === selectedId)
      if (selected) return [selected, ...filtered]
    }
    return filtered
  }, [animals, deferredAnimalQuery, selectedId])

  const tree = useMemo(
    () => (selectedId ? buildPedigreeTree(animals, selectedId) : null),
    [animals, selectedId],
  )

  const focusId = tree?.focus.id
  const focusDamId = tree?.focus.dam_id
  const focusSireId = tree?.focus.sire_id

  useEffect(() => {
    if (!focusId) return
    setDamId(focusDamId ?? '')
    setSireId(focusSireId ?? '')
    setSuccess('')
    setError('')
  }, [focusId, focusDamId, focusSireId])

  const parentOptions = useMemo(() => {
    if (!selectedId) return { dams: [] as Animal[], sires: [] as Animal[] }

    const eligible = animals.filter(
      (a) => a.id !== selectedId && !wouldCreatePedigreeCycle(animals, selectedId, a.id),
    )
    const fields = (animal: Animal) => [
      animal.tag_number,
      animal.stud_tag_number,
      animal.name,
      animal.breed,
    ]

    const keepSelected = (list: Animal[], currentId: string) => {
      if (!currentId || list.some((a) => a.id === currentId)) return list
      const selected = animals.find((a) => a.id === currentId)
      return selected ? [selected, ...list] : list
    }

    return {
      dams: keepSelected(
        filterBySearch(
          eligible.filter((a) => a.sex !== 'male'),
          deferredParentQuery,
          fields,
        ),
        damId,
      ),
      sires: keepSelected(
        filterBySearch(
          eligible.filter((a) => a.sex !== 'female'),
          deferredParentQuery,
          fields,
        ),
        sireId,
      ),
    }
  }, [animals, selectedId, deferredParentQuery, damId, sireId])

  const selectAnimal = (id: string) => {
    setSelectedId(id)
    setSearchParams(id ? { animal: id } : {})
  }

  const handleSaveParents = async (e: FormEvent) => {
    e.preventDefault()
    if (!tree) return

    setError('')
    setSuccess('')
    setSaving(true)

    const nextDam = damId || null
    const nextSire = sireId || null

    if (nextDam && wouldCreatePedigreeCycle(animals, tree.focus.id, nextDam)) {
      setError('That dam would create a circular family tree.')
      setSaving(false)
      return
    }
    if (nextSire && wouldCreatePedigreeCycle(animals, tree.focus.id, nextSire)) {
      setError('That sire would create a circular family tree.')
      setSaving(false)
      return
    }

    const dam = animals.find((a) => a.id === nextDam)
    const sire = animals.find((a) => a.id === nextSire)

    const { error: updateError } = await supabase
      .from('animals')
      .update({
        dam_id: nextDam,
        sire_id: nextSire,
        dam_tag_number: dam?.tag_number ?? tree.focus.dam_tag_number,
        sire_name: sire ? animalLabel(sire) : tree.focus.sire_name,
      })
      .eq('id', tree.focus.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    setSuccess('Family links updated.')
    await loadAnimals()
    setSaving(false)
  }

  const linkedCount = animals.filter((a) => a.dam_id || a.sire_id).length

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <PageHeader
          title="Family trees"
          description="Explore dams, sires, and offspring across your herd."
        />
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {selectedId && (
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => window.print()}
            >
              Print pedigree
            </Button>
          )}
          <Link to="/app/animals/new" className="shrink-0">
            <Button className="w-full sm:w-auto">+ Capture animal</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 print:hidden">
        <Card className="border-l-4 border-pasture-600" tone="accent">
          <p className="text-sm font-medium text-soil-500">Animals</p>
          <p className="mt-1 font-display text-2xl font-bold text-pasture-900">{animals.length}</p>
        </Card>
        <Card className="border-l-4 border-barn-500" tone="muted">
          <p className="text-sm font-medium text-soil-500">With parents linked</p>
          <p className="mt-1 font-display text-2xl font-bold text-pasture-900">{linkedCount}</p>
        </Card>
        <Card className="col-span-2 border-l-4 border-pasture-600 sm:col-span-1">
          <p className="text-sm font-medium text-soil-500">Tip</p>
          <p className="mt-1 text-sm text-soil-700">
            Click any animal in the tree to recenter on their lineage.
          </p>
        </Card>
      </div>

      <Card className="border-pasture-200 bg-gradient-to-b from-pasture-50 via-panel to-panel-muted p-0 pedigree-print-root">
        <div className="border-b border-field-dark bg-panel/80 px-4 py-4 sm:px-6 print:hidden">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex w-full flex-col gap-3 md:max-w-md">
              <SearchField
                id="pedigree-search"
                value={animalQuery}
                onChange={setAnimalQuery}
                placeholder="Search animals to view…"
                resultCount={selectableAnimals.length}
                totalCount={animals.length}
                disabled={loading || animals.length === 0}
              />
              <Select
                label="View family tree for"
                id="pedigree-animal"
                value={selectedId}
                onChange={(e) => selectAnimal(e.target.value)}
                disabled={loading || animals.length === 0}
              >
                {animals.length === 0 ? (
                  <option value="">No animals yet</option>
                ) : selectableAnimals.length === 0 ? (
                  <option value="">No matches</option>
                ) : (
                  selectableAnimals.map((animal) => (
                    <option key={animal.id} value={animal.id}>
                      {animalOptionLabel(animal)}
                    </option>
                  ))
                )}
              </Select>
            </div>
            {tree && (
              <div className="flex flex-col items-start gap-2 text-sm text-soil-500 md:items-end">
                <p>
                  <span className="font-semibold text-soil-700">{animalLabel(tree.focus)}</span>
                  {' · '}
                  {formatAnimalSex(tree.focus.sex)}
                  {' · '}
                  {formatAnimalStatus(tree.focus.status)}
                </p>
                <Link
                  to={`/app/animals/${tree.focus.id}`}
                  className="font-semibold text-pasture-800 hover:text-pasture-700"
                >
                  Photos & details
                </Link>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <p className="px-4 py-16 text-center text-sm text-soil-500 sm:px-6">Loading pedigree...</p>
        ) : animals.length === 0 ? (
          <div className="px-4 py-16 text-center sm:px-6">
            <p className="font-display text-lg font-semibold text-pasture-900">No animals yet</p>
            <p className="mt-2 text-sm text-soil-500">
              Capture animals and link dams/sires to grow your family trees.
            </p>
            <Link to="/app/animals/new" className="mt-4 inline-block">
              <Button>Capture your first animal</Button>
            </Link>
          </div>
        ) : tree ? (
          <div className="px-2 py-2 sm:px-4">
            <div className="mb-2 hidden print:block">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-soil-500">
                AgriTrack pedigree
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold text-pasture-900">
                {animalLabel(tree.focus)}
              </h2>
            </div>
            <PedigreeTreeView tree={tree} onSelectAnimal={selectAnimal} />
          </div>
        ) : (
          <p className="px-4 py-16 text-center text-sm text-soil-500 sm:px-6">
            Select an animal to view its family tree.
          </p>
        )}
      </Card>

      {tree && (
        <Card className="print:hidden">
          <h3 className="font-display font-semibold text-pasture-900">Link parents</h3>
          <p className="mt-1 text-sm text-soil-500">
            Connect {animalLabel(tree.focus)} to a dam and sire already on this farm.
          </p>
          <form onSubmit={handleSaveParents} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <SearchField
                id="parent-link-search"
                value={parentQuery}
                onChange={setParentQuery}
                placeholder="Filter dam/sire options…"
              />
            </div>
            <Select
              label="Dam (mother)"
              id="link-dam"
              value={damId}
              onChange={(e) => setDamId(e.target.value)}
            >
              <option value="">Not linked</option>
              {parentOptions.dams.map((animal) => (
                <option key={animal.id} value={animal.id}>
                  {animalOptionLabel(animal)}
                </option>
              ))}
            </Select>
            <Select
              label="Sire (father)"
              id="link-sire"
              value={sireId}
              onChange={(e) => setSireId(e.target.value)}
            >
              <option value="">Not linked</option>
              {parentOptions.sires.map((animal) => (
                <option key={animal.id} value={animal.id}>
                  {animalOptionLabel(animal)}
                </option>
              ))}
            </Select>
            <div className="md:col-span-2">
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? 'Saving...' : 'Save parent links'}
              </Button>
            </div>
          </form>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {success && <p className="mt-3 text-sm text-pasture-800">{success}</p>}
        </Card>
      )}
    </div>
  )
}
