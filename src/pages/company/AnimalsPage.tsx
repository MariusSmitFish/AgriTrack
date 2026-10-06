import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Animal } from '../../lib/types'
import {
  animalLabel,
  animalsWithExactTag,
  deleteAnimal,
  exactTagQuery,
  formatAnimalId,
  formatAnimalSex,
  formatAnimalStatus,
  formatTagNumber,
  studTagChoiceLabel,
} from '../../lib/animals'
import { animalPlaceLabel } from '../../lib/locations'
import { filterBySearch } from '../../lib/search'
import { useClientPagination } from '../../lib/pagination'
import { exportCsv } from '../../lib/exportCsv'
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

export function AnimalsPage() {
  const { profile } = useAuth()
  const [animals, setAnimals] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

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

  const exactTag = exactTagQuery(deferredQuery)
  const tagMatches = useMemo(() => {
    if (!exactTag) return []
    return animalsWithExactTag(animals, exactTag).sort((a, b) =>
      (a.stud_number ?? '').localeCompare(b.stud_number ?? ''),
    )
  }, [animals, exactTag])

  const filteredAnimals = useMemo(
    () =>
      exactTag
        ? tagMatches
        : filterBySearch(animals, deferredQuery, (animal) => [
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
      ]),
    [animals, deferredQuery, exactTag, tagMatches],
  )

  const {
    pageItems: pagedAnimals,
    page,
    setPage,
    totalPages,
    totalItems,
    start,
    end,
  } = useClientPagination(filteredAnimals, { resetKey: deferredQuery, pageSize: 20 })

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

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Animals"
          description="Livestock on your farm. Open an animal to add photos and view history."
        />
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          {filteredAnimals.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={handleExportCsv}
            >
              Export CSV
            </Button>
          )}
          <Link to="/app/family-trees" className="block w-full sm:w-auto">
            <Button variant="secondary" className="w-full sm:w-auto">
              Family tree
            </Button>
          </Link>
          <Link to="/app/animals/new" className="block w-full sm:w-auto">
            <Button className="w-full sm:w-auto">+ Capture animal</Button>
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-pasture-800">{success}</p>}

      <Card>
        {loading ? (
          <EmptyState>Loading animals...</EmptyState>
        ) : animals.length === 0 ? (
          <div className="text-center">
            <EmptyState>No animals recorded yet.</EmptyState>
            <Link to="/app/animals/new" className="mt-4 inline-block">
              <Button>Capture your first animal</Button>
            </Link>
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
              enableTagScan
            />

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
              <EmptyState>No animals match your search.</EmptyState>
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
                        { label: 'Dam', value: parentLabel(animal.dam_id) },
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
                      <th className="pb-2 font-medium">Dam</th>
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
                        <td className="py-3 text-soil-600">{parentLabel(animal.dam_id)}</td>
                        <td className="py-3 text-soil-600">{formatAnimalStatus(animal.status)}</td>
                        <td className="py-3 text-right">
                          <Link
                            to={`/app/animals/${animal.id}`}
                            className="mr-3 font-semibold text-pasture-800 hover:text-pasture-700"
                          >
                            Open
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
