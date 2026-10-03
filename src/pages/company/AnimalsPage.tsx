import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Animal } from '../../lib/types'
import { animalLabel, deleteAnimal, formatAnimalSex, formatAnimalStatus } from '../../lib/animals'
import { animalPlaceLabel } from '../../lib/locations'
import { filterBySearch } from '../../lib/search'
import { useClientPagination } from '../../lib/pagination'
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

  const filteredAnimals = useMemo(
    () =>
      filterBySearch(animals, deferredQuery, (animal) => [
        animal.tag_number,
        animal.stud_tag_number,
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
    [animals, deferredQuery],
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

  const handleDelete = async (animal: Animal) => {
    const label = animalLabel(animal)
    if (
      !window.confirm(
        `Delete ${label}? Photos and inoculations for this animal will also be removed. Linked offspring stay, but parent links to this animal are cleared.`,
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
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Link to="/app/family-trees">
            <Button variant="secondary" className="w-full sm:w-auto">
              Family trees
            </Button>
          </Link>
          <Link to="/app/animals/new">
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
              placeholder="Search tag, name, breed, location, status…"
              resultCount={filteredAnimals.length}
              totalCount={animals.length}
            />

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
                      <th className="pb-2 font-medium">Tag</th>
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
                        <td className="py-3 font-medium text-soil-800">{animal.tag_number ?? '—'}</td>
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
