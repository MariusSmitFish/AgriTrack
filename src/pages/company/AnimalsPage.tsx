import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Animal, AnimalStatus } from '../../lib/types'
import {
  animalLabel,
  animalsWithExactTag,
  compareAnimalsForList,
  deleteAnimal,
  exactTagQuery,
  formatAnimalId,
  formatAnimalSex,
  formatAnimalStatus,
  formatSpecies,
  formatTagNumber,
  animalStatusOptions,
  studTagChoiceLabel,
} from '../../lib/animals'
import { animalPlaceLabel } from '../../lib/locations'
import { filterBySearch } from '../../lib/search'
import { useClientPagination } from '../../lib/pagination'
import { exportCsv } from '../../lib/exportCsv'
import { downloadAnimalTemplate } from '../../lib/animalImport'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { SearchField } from '../../components/ui/SearchField'
import { Pagination } from '../../components/ui/Pagination'
import {
  DesktopTable,
  EmptyState,
  MobileCard,
  MobileCardList,
  PageHeader,
} from '../../components/layout/AppShell'

const menuItemClass =
  'flex min-h-11 w-full items-center px-3 py-2 text-left text-sm font-semibold text-soil-800 hover:bg-pasture-50 disabled:opacity-50 sm:min-h-0'

function AnimalListActions({
  canExport,
  downloadingTemplate,
  onExport,
  onDownloadTemplate,
  canDeleteStamboek,
  stamboekCount,
  deletingStamboek,
  onDeleteStamboek,
}: {
  canExport: boolean
  downloadingTemplate: boolean
  onExport: () => void
  onDownloadTemplate: () => void
  canDeleteStamboek: boolean
  stamboekCount: number
  deletingStamboek: boolean
  onDeleteStamboek: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <div ref={rootRef} className="relative flex shrink-0 items-center gap-2">
      <Link to="/app/animals/new">
        <Button className="whitespace-nowrap">Capture animal</Button>
      </Link>
      <Button
        type="button"
        variant="secondary"
        className="whitespace-nowrap"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        Actions
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-xl border border-field-dark bg-panel py-1 shadow-lg"
        >
          {canExport && (
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={() => {
                close()
                onExport()
              }}
            >
              Export CSV
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            disabled={downloadingTemplate}
            onClick={() => {
              close()
              onDownloadTemplate()
            }}
          >
            {downloadingTemplate ? 'Preparing template...' : 'Download template'}
          </button>
          <Link role="menuitem" to="/app/animals/import" className={menuItemClass} onClick={close}>
            Upload Excel
          </Link>
          <Link
            role="menuitem"
            to="/app/animals/import-stambook"
            className={menuItemClass}
            onClick={close}
          >
            Import Stambook
          </Link>
          <Link role="menuitem" to="/app/family-trees" className={menuItemClass} onClick={close}>
            Family tree
          </Link>
          {canDeleteStamboek && (
            <button
              type="button"
              role="menuitem"
              className={`${menuItemClass} border-t border-field-dark text-red-700 hover:bg-red-50`}
              disabled={deletingStamboek}
              onClick={() => {
                close()
                onDeleteStamboek()
              }}
            >
              {deletingStamboek ? 'Deleting...' : `Delete ${stamboekCount} stamboek`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

type StatusFilter = 'all' | AnimalStatus
type SexFilter = 'all' | 'female' | 'male' | 'unknown'
type ParentsFilter = 'all' | 'both' | 'missing'

function recordedStatus(animal: Animal): AnimalStatus {
  return animal.status ?? 'active'
}

function recordedSex(animal: Animal): 'female' | 'male' | 'unknown' {
  if (animal.sex === 'female' || animal.sex === 'male') return animal.sex
  return 'unknown'
}

function parentCoverage(animal: Animal): 'both' | 'missing' {
  const dam = Boolean(animal.dam_id) || Boolean(animal.dam_tag_number?.trim())
  const sire = Boolean(animal.sire_id) || Boolean(animal.sire_name?.trim())
  return dam && sire ? 'both' : 'missing'
}

function FilterChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${
        active
          ? 'bg-pasture-800 text-white shadow-sm shadow-pasture-900/15'
          : 'bg-panel text-soil-700 ring-1 ring-field-dark ring-inset hover:bg-pasture-50'
      }`}
    >
      {label}
      {typeof count === 'number' && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[0.65rem] tabular-nums ${
            active ? 'bg-white/15 text-white' : 'bg-panel-muted text-soil-500'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  const active = value !== 'all'
  return (
    <label className="inline-flex items-center gap-2">
      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-soil-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-9 rounded-full bg-panel px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-pasture-100 ${
          active
            ? 'border border-pasture-700 text-pasture-900 ring-2 ring-pasture-100'
            : 'border border-field-dark text-soil-700'
        }`}
      >
        {children}
      </select>
    </label>
  )
}

export function AnimalsPage() {
  const { profile } = useAuth()
  const [animals, setAnimals] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sexFilter, setSexFilter] = useState<SexFilter>('all')
  const [placeFilter, setPlaceFilter] = useState('all')
  const [breedFilter, setBreedFilter] = useState('all')
  const [parentsFilter, setParentsFilter] = useState<ParentsFilter>('all')
  const [speciesFilter, setSpeciesFilter] = useState('all')
  const [deletingStamboek, setDeletingStamboek] = useState(false)
  const deferredQuery = useDeferredValue(query)

  const downloadTemplate = async () => {
    setDownloadingTemplate(true)
    setError('')
    try {
      await downloadAnimalTemplate()
    } catch {
      setError('Could not create the Excel template. Try again.')
    } finally {
      setDownloadingTemplate(false)
    }
  }

  const loadAnimals = async () => {
    if (!profile?.company_id) return

    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('animals')
      .select('*, encampments(id, name, location_id, locations(id, name))')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })

    if (fetchError) setError(fetchError.message)
    else setAnimals(data ?? [])

    setLoading(false)
  }

  useEffect(() => {
    loadAnimals()
  }, [profile?.company_id])

  const parentLabel = (id: string | null) => {
    if (!id) return '—'
    const parent = animals.find((a) => a.id === id)
    return parent ? animalLabel(parent) : '—'
  }

  const placeFor = (animal: Animal) =>
    animalPlaceLabel({
      encampment: animal.encampments,
      location: animal.encampments?.locations,
      legacyLocation: animal.location,
    })

  const placeOptions = useMemo(() => {
    const names = new Set<string>()
    let missing = false
    for (const animal of animals) {
      const place = placeFor(animal)
      if (!place || place === '—') missing = true
      else names.add(place)
    }
    return { names: [...names].sort((a, b) => a.localeCompare(b)), missing }
  }, [animals])

  const breedOptions = useMemo(() => {
    const names = new Set<string>()
    let missing = false
    for (const animal of animals) {
      const breed = animal.breed?.trim()
      if (breed) names.add(breed)
      else missing = true
    }
    return { names: [...names].sort((a, b) => a.localeCompare(b)), missing }
  }, [animals])

  const speciesOptions = useMemo(() => {
    const names = new Set<string>()
    for (const animal of animals) {
      if (animal.species?.trim()) names.add(animal.species.trim())
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [animals])

  const filtersActive =
    statusFilter !== 'all' ||
    sexFilter !== 'all' ||
    placeFilter !== 'all' ||
    breedFilter !== 'all' ||
    parentsFilter !== 'all' ||
    speciesFilter !== 'all'

  const matchesFilters = (animal: Animal, ignore?: 'status' | 'sex' | 'place' | 'breed' | 'parents' | 'species') => {
    if (ignore !== 'status' && statusFilter !== 'all' && recordedStatus(animal) !== statusFilter) return false
    if (ignore !== 'sex' && sexFilter !== 'all' && recordedSex(animal) !== sexFilter) return false
    if (ignore !== 'place' && placeFilter !== 'all' && placeFor(animal) !== placeFilter) return false
    if (ignore !== 'breed' && breedFilter !== 'all' && (animal.breed?.trim() || '—') !== breedFilter) return false
    if (ignore !== 'parents' && parentsFilter !== 'all' && parentCoverage(animal) !== parentsFilter) return false
    if (ignore !== 'species' && speciesFilter !== 'all' && (animal.species?.trim() || '—') !== speciesFilter) {
      return false
    }
    return true
  }

  const countMatching = (
    ignore: 'status' | 'sex' | 'place' | 'breed' | 'parents' | 'species',
    predicate: (animal: Animal) => boolean,
  ) => animals.filter((animal) => matchesFilters(animal, ignore) && predicate(animal)).length

  const baseAnimals = useMemo(() => {
    return animals.filter((animal) => matchesFilters(animal))
  }, [animals, statusFilter, sexFilter, placeFilter, breedFilter, parentsFilter, speciesFilter])

  const stamboekCount = useMemo(() => {
    return animals.filter(a => a.status === 'stamboek').length
  }, [animals])

  const exactTag = exactTagQuery(deferredQuery)
  const tagMatches = useMemo(() => {
    if (!exactTag) return []
    return animalsWithExactTag(baseAnimals, exactTag).sort((a, b) =>
      (a.stud_number ?? '').localeCompare(b.stud_number ?? ''),
    )
  }, [baseAnimals, exactTag])

  const filteredAnimals = useMemo(
    () => {
      const matched = exactTag
        ? animalsWithExactTag(baseAnimals, exactTag)
        : filterBySearch(baseAnimals, deferredQuery, (animal) => [
        formatAnimalId(animal),
        formatTagNumber(animal),
        animal.stud_number,
        animal.id_year,
        animal.id_number,
        animal.studbook_number,
        animal.studbook_schedule,
        animal.selection,
        animal.tag_number,
        animal.electronic_id,
        animal.name,
        animal.breed,
        animal.species,
        formatAnimalSex(animal.sex),
        formatAnimalStatus(animal.status),
        placeFor(animal),
        parentLabel(animal.dam_id),
        parentLabel(animal.sire_id),
        animal.notes,
      ])
      return [...matched].sort(compareAnimalsForList)
    },
    [baseAnimals, deferredQuery, exactTag],
  )

  const {
    pageItems: pagedAnimals,
    page,
    setPage,
    totalPages,
    totalItems,
    start,
    end,
  } = useClientPagination(filteredAnimals, {
    resetKey: `${deferredQuery}:${statusFilter}:${sexFilter}:${placeFilter}:${breedFilter}:${parentsFilter}:${speciesFilter}`,
    pageSize: 20,
  })

  const handleExportCsv = () => {
    exportCsv(
      'animals.csv',
      [
        'Animal ID',
        'Tag number',
        'Studbook number',
        'Studbook schedule',
        'Selection',
        'Name',
        'Sex',
        'Breed',
        'Species',
        'Status',
        'Birth date',
        'Lives at',
        'Dam',
        'Sire',
        'Notes',
      ],
      filteredAnimals.map((animal) => [
        formatAnimalId(animal),
        formatTagNumber(animal),
        animal.studbook_number,
        animal.studbook_schedule,
        animal.selection,
        animal.name,
        formatAnimalSex(animal.sex),
        animal.breed,
        animal.species,
        formatAnimalStatus(animal.status),
        animal.birth_date,
        placeFor(animal),
        parentLabel(animal.dam_id),
        parentLabel(animal.sire_id),
        animal.notes,
      ]),
    )
  }

  const handleDelete = async (animal: Animal) => {
    const label = animalLabel(animal)
    if (
      !window.confirm(
        `Delete ${label}? Photos, documents, health records, and show results for this animal will also be removed. Linked offspring stay, but parent links to this animal are cleared.`,
      )
    ) {
      return
    }

    setError('')
    setSuccess('')
    setDeletingId(animal.id)

    try {
      await deleteAnimal(animal)
      setAnimals((prev) => prev.filter((a) => a.id !== animal.id))
      setSuccess(`${label} deleted.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete animal')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteAllStamboek = async () => {
    const stamboekAnimals = animals.filter((a) => a.status === 'stamboek')
    const count = stamboekAnimals.length
    
    if (count === 0) {
      setError('No stamboek animals to delete.')
      return
    }

    if (
      !window.confirm(
        `Delete all ${count} stamboek ${count === 1 ? 'animal' : 'animals'}? This action cannot be undone. Photos, documents, health records, and show results will also be removed.`,
      )
    ) {
      return
    }

    setError('')
    setSuccess('')
    setDeletingStamboek(true)

    try {
      // Delete each animal individually to properly clean up storage and handle cascades
      const deletePromises = stamboekAnimals.map((animal) =>
        deleteAnimal({ id: animal.id, company_id: animal.company_id })
      )
      
      await Promise.all(deletePromises)

      setAnimals((prev) => prev.filter((a) => a.status !== 'stamboek'))
      setSuccess(`Deleted ${count} stamboek ${count === 1 ? 'animal' : 'animals'}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete stamboek animals')
    } finally {
      setDeletingStamboek(false)
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Animals"
          description="Livestock on your farm. Open an animal to add photos and view history."
        />
        <AnimalListActions
          canExport={filteredAnimals.length > 0}
          downloadingTemplate={downloadingTemplate}
          onExport={handleExportCsv}
          onDownloadTemplate={downloadTemplate}
          canDeleteStamboek={profile?.role === 'company_admin' && stamboekCount > 0}
          stamboekCount={stamboekCount}
          deletingStamboek={deletingStamboek}
          onDeleteStamboek={handleDeleteAllStamboek}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-pasture-800">{success}</p>}

      <Card>
        {loading ? (
          <EmptyState>Loading animals...</EmptyState>
        ) : animals.length === 0 ? (
          <div className="text-center">
            <EmptyState>No animals recorded yet.</EmptyState>
            <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <Link to="/app/animals/new">
                <Button>Capture your first animal</Button>
              </Link>
              <Button
                type="button"
                variant="secondary"
                onClick={downloadTemplate}
                disabled={downloadingTemplate}
              >
                {downloadingTemplate ? 'Preparing template...' : 'Download template'}
              </Button>
              <Link to="/app/animals/import">
                <Button variant="secondary">Upload Excel</Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <SearchField
              id="animals-search"
              value={query}
              onChange={setQuery}
              placeholder="Search animal ID, tag, name, breed, location, status…"
              resultCount={filteredAnimals.length}
              totalCount={animals.length}
            />

            <div className="mt-4 space-y-3 rounded-2xl bg-panel-muted/80 p-3 ring-1 ring-field-dark/80">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-soil-500">
                  Status
                </span>
                <FilterChip
                  active={statusFilter === 'all'}
                  label="All"
                  count={countMatching('status', () => true)}
                  onClick={() => setStatusFilter('all')}
                />
                {animalStatusOptions.map((option) => {
                  const present = animals.some((animal) => recordedStatus(animal) === option.value)
                  if (!present && statusFilter !== option.value) return null
                  return (
                    <FilterChip
                      key={option.value}
                      active={statusFilter === option.value}
                      label={option.label}
                      count={countMatching('status', (animal) => recordedStatus(animal) === option.value)}
                      onClick={() => setStatusFilter(option.value)}
                    />
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-soil-500">
                  Sex
                </span>
                <FilterChip
                  active={sexFilter === 'all'}
                  label="All"
                  count={countMatching('sex', () => true)}
                  onClick={() => setSexFilter('all')}
                />
                <FilterChip
                  active={sexFilter === 'female'}
                  label="Female"
                  count={countMatching('sex', (animal) => recordedSex(animal) === 'female')}
                  onClick={() => setSexFilter('female')}
                />
                <FilterChip
                  active={sexFilter === 'male'}
                  label="Male"
                  count={countMatching('sex', (animal) => recordedSex(animal) === 'male')}
                  onClick={() => setSexFilter('male')}
                />
                {(sexFilter === 'unknown' || animals.some((animal) => recordedSex(animal) === 'unknown')) && (
                  <FilterChip
                    active={sexFilter === 'unknown'}
                    label="Unknown"
                    count={countMatching('sex', (animal) => recordedSex(animal) === 'unknown')}
                    onClick={() => setSexFilter('unknown')}
                  />
                )}
                <span className="ml-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-soil-500">
                  Parents
                </span>
                <FilterChip
                  active={parentsFilter === 'all'}
                  label="All"
                  count={countMatching('parents', () => true)}
                  onClick={() => setParentsFilter('all')}
                />
                <FilterChip
                  active={parentsFilter === 'both'}
                  label="Both parents"
                  count={countMatching('parents', (animal) => parentCoverage(animal) === 'both')}
                  onClick={() => setParentsFilter('both')}
                />
                <FilterChip
                  active={parentsFilter === 'missing'}
                  label="Missing a parent"
                  count={countMatching('parents', (animal) => parentCoverage(animal) === 'missing')}
                  onClick={() => setParentsFilter('missing')}
                />
              </div>

              {(placeOptions.names.length + (placeOptions.missing ? 1 : 0) > 1 ||
                breedOptions.names.length + (breedOptions.missing ? 1 : 0) > 1 ||
                speciesOptions.length > 1) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {placeOptions.names.length + (placeOptions.missing ? 1 : 0) > 1 && (
                    <FilterSelect label="Camp" value={placeFilter} onChange={setPlaceFilter}>
                      <option value="all">All camps</option>
                      {placeOptions.names.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                      {placeOptions.missing && <option value="—">No camp</option>}
                    </FilterSelect>
                  )}
                  {breedOptions.names.length + (breedOptions.missing ? 1 : 0) > 1 && (
                    <FilterSelect label="Breed" value={breedFilter} onChange={setBreedFilter}>
                      <option value="all">All breeds</option>
                      {breedOptions.names.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                      {breedOptions.missing && <option value="—">No breed</option>}
                    </FilterSelect>
                  )}
                  {speciesOptions.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-soil-500">
                        Species
                      </span>
                      <FilterChip
                        active={speciesFilter === 'all'}
                        label="All"
                        onClick={() => setSpeciesFilter('all')}
                      />
                      {speciesOptions.map((species) => (
                        <FilterChip
                          key={species}
                          active={speciesFilter === species}
                          label={formatSpecies(species)}
                          count={countMatching('species', (animal) => animal.species?.trim() === species)}
                          onClick={() => setSpeciesFilter(species)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {filtersActive && (
                <button
                  type="button"
                  className="text-xs font-semibold text-pasture-800 hover:text-pasture-700"
                  onClick={() => {
                    setStatusFilter('all')
                    setSexFilter('all')
                    setPlaceFilter('all')
                    setBreedFilter('all')
                    setParentsFilter('all')
                    setSpeciesFilter('all')
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>

            {exactTag && tagMatches.length > 1 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-soil-800">
                  {tagMatches.length} animals use tag {exactTag}
                </p>
                <p className="mt-1 text-xs text-soil-500">
                  Same visual tag, different stud numbers.
                </p>
                <ul className="mt-2 overflow-hidden rounded-xl border border-field-dark">
                  {tagMatches.map((animal) => (
                    <li key={animal.id} className="border-b border-field-dark/70 last:border-b-0">
                      <Link
                        to={`/app/animals/${animal.id}`}
                        className="block min-h-11 px-3 py-2.5 text-sm font-medium text-soil-800 hover:bg-pasture-50"
                      >
                        {studTagChoiceLabel(animal)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {filteredAnimals.length === 0 ? (
              <EmptyState>No animals match these filters.</EmptyState>
            ) : (
              <>
                <MobileCardList>
                  {pagedAnimals.map((animal) => (
                    <MobileCard
                      key={animal.id}
                      title={animalLabel(animal)}
                      subtitle={animal.breed ?? animal.species ?? undefined}
                      fields={[
                        { label: 'Tag number', value: formatTagNumber(animal) ?? '—' },
                        { label: 'Sex', value: formatAnimalSex(animal.sex) },
                        { label: 'Lives at', value: placeFor(animal) },
                        { label: 'Status', value: formatAnimalStatus(animal.status) },
                      ]}
                      action={
                        <div className="flex flex-col items-end gap-1">
                          <Link
                            to={`/app/animals/${animal.id}`}
                            className="text-sm font-semibold text-pasture-800 hover:text-pasture-700"
                          >
                            Open
                          </Link>
                          <Link
                            to={`/app/family-trees?animal=${animal.id}`}
                            className="text-sm font-semibold text-pasture-800 hover:text-pasture-700"
                          >
                            Family tree
                          </Link>
                          <button
                            type="button"
                            className="text-xs font-semibold text-red-700 hover:text-red-800 disabled:opacity-50"
                            disabled={deletingId === animal.id}
                            onClick={() => handleDelete(animal)}
                          >
                            {deletingId === animal.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      }
                    />
                  ))}
                </MobileCardList>

                <DesktopTable>
                  <thead>
                    <tr className="border-b border-field-dark text-soil-500">
                      <th className="pb-2 font-medium">Animal ID</th>
                      <th className="pb-2 font-medium">Tag number</th>
                      <th className="pb-2 font-medium">Name</th>
                      <th className="pb-2 font-medium">Sex</th>
                      <th className="pb-2 font-medium">Lives at</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedAnimals.map((animal) => (
                      <tr key={animal.id} className="border-b border-field-dark/60">
                        <td className="py-3 font-medium text-soil-800">{formatAnimalId(animal) ?? '—'}</td>
                        <td className="py-3 text-soil-600">{formatTagNumber(animal) ?? '—'}</td>
                        <td className="py-3 text-soil-600">{animal.name ?? '—'}</td>
                        <td className="py-3 text-soil-600">{formatAnimalSex(animal.sex)}</td>
                        <td className="py-3 text-soil-600">{placeFor(animal)}</td>
                        <td className="py-3 text-soil-600">{formatAnimalStatus(animal.status)}</td>
                        <td className="py-3 text-right whitespace-nowrap">
                          <Link
                            to={`/app/animals/${animal.id}`}
                            className="mr-3 font-semibold text-pasture-800 hover:text-pasture-700"
                          >
                            Open
                          </Link>
                          <Link
                            to={`/app/family-trees?animal=${animal.id}`}
                            className="mr-3 font-semibold text-pasture-800 hover:text-pasture-700"
                          >
                            Family tree
                          </Link>
                          <button
                            type="button"
                            className="font-semibold text-red-700 hover:text-red-800 disabled:opacity-50"
                            disabled={deletingId === animal.id}
                            onClick={() => handleDelete(animal)}
                          >
                            {deletingId === animal.id ? 'Deleting...' : 'Delete'}
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
