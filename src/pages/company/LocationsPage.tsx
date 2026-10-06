import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Encampment, FarmLocation } from '../../lib/types'
import { encampmentLabel, locationLabel } from '../../lib/locations'
import { filterBySearch } from '../../lib/search'
import { useClientPagination } from '../../lib/pagination'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
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

export function LocationsPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'company_admin'

  const [locations, setLocations] = useState<FarmLocation[]>([])
  const [encampments, setEncampments] = useState<Encampment[]>([])
  const [animalCounts, setAnimalCounts] = useState<Record<string, number>>({})
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [locationName, setLocationName] = useState('')
  const [locationDescription, setLocationDescription] = useState('')
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null)
  const [savingLocation, setSavingLocation] = useState(false)

  const [campName, setCampName] = useState('')
  const [campDescription, setCampDescription] = useState('')
  const [editingCampId, setEditingCampId] = useState<string | null>(null)
  const [savingCamp, setSavingCamp] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [campQuery, setCampQuery] = useState('')
  const deferredLocationQuery = useDeferredValue(locationQuery)
  const deferredCampQuery = useDeferredValue(campQuery)

  const loadData = async () => {
    if (!profile?.company_id) return

    setLoading(true)
    setError('')

    const [locationsRes, encampmentsRes, animalsRes] = await Promise.all([
      supabase
        .from('locations')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name'),
      supabase
        .from('encampments')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name'),
      supabase
        .from('animals')
        .select('encampment_id')
        .eq('company_id', profile.company_id)
        .not('encampment_id', 'is', null),
    ])

    if (locationsRes.error) setError(locationsRes.error.message)
    else {
      setLocations(locationsRes.data ?? [])
      if (!selectedLocationId && (locationsRes.data?.length ?? 0) > 0) {
        setSelectedLocationId(locationsRes.data![0].id)
      }
    }

    if (encampmentsRes.error) setError(encampmentsRes.error.message)
    else setEncampments(encampmentsRes.data ?? [])

    if (!animalsRes.error) {
      const counts: Record<string, number> = {}
      for (const row of animalsRes.data ?? []) {
        if (!row.encampment_id) continue
        counts[row.encampment_id] = (counts[row.encampment_id] ?? 0) + 1
      }
      setAnimalCounts(counts)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [profile?.company_id])

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  )

  const filteredLocations = useMemo(
    () =>
      filterBySearch(locations, deferredLocationQuery, (location) => [
        location.name,
        location.description,
      ]),
    [locations, deferredLocationQuery],
  )

  const campsForLocation = useMemo(
    () => encampments.filter((e) => e.location_id === selectedLocationId),
    [encampments, selectedLocationId],
  )

  const filteredCamps = useMemo(
    () =>
      filterBySearch(campsForLocation, deferredCampQuery, (camp) => [
        camp.name,
        camp.description,
      ]),
    [campsForLocation, deferredCampQuery],
  )

  const {
    pageItems: pagedLocations,
    page: locationPage,
    setPage: setLocationPage,
    totalPages: locationTotalPages,
    totalItems: locationTotalItems,
    start: locationStart,
    end: locationEnd,
  } = useClientPagination(filteredLocations, { resetKey: deferredLocationQuery })

  const {
    pageItems: pagedCamps,
    page: campPage,
    setPage: setCampPage,
    totalPages: campTotalPages,
    totalItems: campTotalItems,
    start: campStart,
    end: campEnd,
  } = useClientPagination(filteredCamps, {
    resetKey: `${selectedLocationId ?? ''}:${deferredCampQuery}`,
  })

  const resetLocationForm = () => {
    setLocationName('')
    setLocationDescription('')
    setEditingLocationId(null)
  }

  const resetCampForm = () => {
    setCampName('')
    setCampDescription('')
    setEditingCampId(null)
  }

  const startEditLocation = (location: FarmLocation) => {
    setEditingLocationId(location.id)
    setLocationName(location.name)
    setLocationDescription(location.description ?? '')
    setSelectedLocationId(location.id)
    setSuccess('')
    setError('')
  }

  const startEditCamp = (camp: Encampment) => {
    setEditingCampId(camp.id)
    setCampName(camp.name)
    setCampDescription(camp.description ?? '')
    setSuccess('')
    setError('')
  }

  const handleSaveLocation = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile?.company_id || !isAdmin) return

    setSavingLocation(true)
    setError('')
    setSuccess('')

    const payload = {
      name: locationName.trim(),
      description: locationDescription.trim() || null,
      company_id: profile.company_id,
    }

    const result = editingLocationId
      ? await supabase.from('locations').update(payload).eq('id', editingLocationId)
      : await supabase.from('locations').insert(payload).select('id').single()

    if (result.error) {
      setError(result.error.message)
    } else {
      if (!editingLocationId && result.data && 'id' in result.data) {
        setSelectedLocationId(result.data.id as string)
      }
      setSuccess(editingLocationId ? 'Location updated.' : 'Location added.')
      resetLocationForm()
      await loadData()
    }

    setSavingLocation(false)
  }

  const handleDeleteLocation = async (location: FarmLocation) => {
    if (!isAdmin) return
    const campCount = encampments.filter((e) => e.location_id === location.id).length
    const message =
      campCount > 0
        ? `Delete "${location.name}" and its ${campCount} camp(s)? Animals in those camps will be unassigned.`
        : `Delete location "${location.name}"?`

    if (!window.confirm(message)) return

    setError('')
    setSuccess('')
    const { error: deleteError } = await supabase.from('locations').delete().eq('id', location.id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }

    if (selectedLocationId === location.id) setSelectedLocationId('')
    setSuccess('Location deleted.')
    resetLocationForm()
    await loadData()
  }

  const handleSaveCamp = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile?.company_id || !isAdmin || !selectedLocationId) return

    setSavingCamp(true)
    setError('')
    setSuccess('')

    const payload = {
      name: campName.trim(),
      description: campDescription.trim() || null,
      company_id: profile.company_id,
      location_id: selectedLocationId,
    }

    const result = editingCampId
      ? await supabase.from('encampments').update(payload).eq('id', editingCampId)
      : await supabase.from('encampments').insert(payload)

    if (result.error) {
      setError(result.error.message)
    } else {
      setSuccess(editingCampId ? 'Camp updated.' : 'Camp added.')
      resetCampForm()
      await loadData()
    }

    setSavingCamp(false)
  }

  const handleDeleteCamp = async (camp: Encampment) => {
    if (!isAdmin) return
    const count = animalCounts[camp.id] ?? 0
    const message =
      count > 0
        ? `Delete "${camp.name}"? ${count} animal(s) will be unassigned from this camp.`
        : `Delete camp "${camp.name}"?`

    if (!window.confirm(message)) return

    setError('')
    setSuccess('')
    const { error: deleteError } = await supabase.from('encampments').delete().eq('id', camp.id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setSuccess('Camp deleted.')
    resetCampForm()
    await loadData()
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Locations"
        description="Set up farm locations and the camps where your animals live."
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-pasture-800">{success}</p>}

      {isAdmin && (
        <Card>
          <h3 className="font-display font-semibold text-pasture-900">
            {editingLocationId ? 'Edit location' : 'Add location'}
          </h3>
          <p className="mt-1 text-sm text-soil-500">
            A location is a farm area (block, section, or site) that contains camps.
          </p>
          <form onSubmit={handleSaveLocation} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Location name"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. North Block"
              required
            />
            <Input
              label="Description (optional)"
              value={locationDescription}
              onChange={(e) => setLocationDescription(e.target.value)}
              placeholder="Short note"
            />
            <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
              <Button type="submit" disabled={savingLocation} className="w-full sm:w-auto">
                {savingLocation ? 'Saving...' : editingLocationId ? 'Update location' : 'Add location'}
              </Button>
              {editingLocationId && (
                <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={resetLocationForm}>
                  Cancel edit
                </Button>
              )}
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 lg:gap-6">
        <Card className="lg:col-span-2">
          <h3 className="font-display font-semibold text-pasture-900">Your locations</h3>
          {loading ? (
            <EmptyState>Loading locations...</EmptyState>
          ) : locations.length === 0 ? (
            <EmptyState>
              {isAdmin
                ? 'No locations yet. Add your first farm location above.'
                : 'No locations set up yet. Ask a farm admin to create them.'}
            </EmptyState>
          ) : (
            <>
              <div className="mt-4">
                <SearchField
                  id="locations-search"
                  value={locationQuery}
                  onChange={setLocationQuery}
                  placeholder="Search locations…"
                  resultCount={filteredLocations.length}
                  totalCount={locations.length}
                />
              </div>
              {filteredLocations.length === 0 ? (
                <EmptyState>No locations match your search.</EmptyState>
              ) : (
                <>
                <ul className="mt-4 space-y-2">
                  {pagedLocations.map((location) => {
                    const campCount = encampments.filter((e) => e.location_id === location.id).length
                    const active = location.id === selectedLocationId
                    return (
                      <li key={location.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedLocationId(location.id)}
                          className={`w-full rounded-2xl border px-4 py-3 text-left shadow-sm transition ${
                            active
                              ? 'border-pasture-700 bg-pasture-100 shadow-pasture-900/10'
                              : 'border-field-dark bg-panel hover:border-pasture-600 hover:bg-pasture-50'
                          }`}
                        >
                          <p className="font-semibold text-pasture-900">{locationLabel(location)}</p>
                          <p className="mt-0.5 text-xs text-soil-500">
                            {campCount} camp{campCount === 1 ? '' : 's'}
                            {location.description ? ` · ${location.description}` : ''}
                          </p>
                        </button>
                        {isAdmin && (
                          <div className="mt-1.5 flex flex-wrap gap-2 px-1">
                            <Button
                              type="button"
                              variant="secondary"
                              className="px-3 py-1.5 text-xs"
                              onClick={() => startEditLocation(location)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              className="px-3 py-1.5 text-xs"
                              onClick={() => handleDeleteLocation(location)}
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
                <Pagination
                  page={locationPage}
                  totalPages={locationTotalPages}
                  totalItems={locationTotalItems}
                  start={locationStart}
                  end={locationEnd}
                  onPageChange={setLocationPage}
                />
                </>
              )}
            </>
          )}
        </Card>

        <Card className="lg:col-span-3">
          {!selectedLocation ? (
            <EmptyState>Select a location to manage its camps.</EmptyState>
          ) : (
            <>
              <h3 className="font-display font-semibold text-pasture-900">
                Camps at {locationLabel(selectedLocation)}
              </h3>
              <p className="mt-1 text-sm text-soil-500">
                Camps are the paddocks where animals live within this location.
              </p>

              {isAdmin && (
                <form
                  onSubmit={handleSaveCamp}
                  className="section-inset mt-4 grid grid-cols-1 gap-4 rounded-2xl p-4 md:grid-cols-2"
                >
                  <Input
                    label={editingCampId ? 'Edit camp name' : 'Camp name'}
                    value={campName}
                    onChange={(e) => setCampName(e.target.value)}
                    placeholder="e.g. Camp 3 / River paddock"
                    required
                  />
                  <Input
                    label="Description (optional)"
                    value={campDescription}
                    onChange={(e) => setCampDescription(e.target.value)}
                    placeholder="Water point, capacity notes..."
                  />
                  <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
                    <Button type="submit" disabled={savingCamp} className="w-full sm:w-auto">
                      {savingCamp
                        ? 'Saving...'
                        : editingCampId
                          ? 'Update camp'
                          : 'Add camp'}
                    </Button>
                    {editingCampId && (
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full sm:w-auto"
                        onClick={resetCampForm}
                      >
                        Cancel edit
                      </Button>
                    )}
                  </div>
                </form>
              )}

              {campsForLocation.length === 0 ? (
                <EmptyState>
                  {isAdmin
                    ? 'No camps here yet. Add one above.'
                    : 'No camps in this location yet.'}
                </EmptyState>
              ) : (
                <>
                  <div className="mt-4">
                    <SearchField
                      id="encampments-search"
                      value={campQuery}
                      onChange={setCampQuery}
                      placeholder="Search camps…"
                      resultCount={filteredCamps.length}
                      totalCount={campsForLocation.length}
                    />
                  </div>
                  {filteredCamps.length === 0 ? (
                    <EmptyState>No camps match your search.</EmptyState>
                  ) : (
                <>
                  <MobileCardList>
                    {pagedCamps.map((camp) => (
                      <MobileCard
                        key={camp.id}
                        title={encampmentLabel(camp)}
                        subtitle={camp.description ?? undefined}
                        fields={[
                          {
                            label: 'Animals',
                            value: String(animalCounts[camp.id] ?? 0),
                          },
                        ]}
                        action={
                          isAdmin ? (
                            <div className="flex flex-col items-end gap-1">
                              <Button
                                type="button"
                                variant="secondary"
                                className="px-3 py-1.5 text-xs"
                                onClick={() => startEditCamp(camp)}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="danger"
                                className="px-3 py-1.5 text-xs"
                                onClick={() => handleDeleteCamp(camp)}
                              >
                                Delete
                              </Button>
                            </div>
                          ) : undefined
                        }
                      />
                    ))}
                  </MobileCardList>

                  <DesktopTable>
                    <thead>
                      <tr className="border-b border-field-dark text-soil-500">
                        <th className="pb-2 font-medium">Camp</th>
                        <th className="pb-2 font-medium">Description</th>
                        <th className="pb-2 font-medium">Animals</th>
                        {isAdmin && <th className="pb-2 font-medium"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedCamps.map((camp) => (
                        <tr key={camp.id} className="border-b border-field-dark/60">
                          <td className="py-3 font-medium text-soil-800">
                            {encampmentLabel(camp)}
                          </td>
                          <td className="py-3 text-soil-600">{camp.description ?? '—'}</td>
                          <td className="py-3 text-soil-600">{animalCounts[camp.id] ?? 0}</td>
                          {isAdmin && (
                            <td className="py-3 text-right">
                              <Button
                                type="button"
                                variant="secondary"
                                className="mr-2 px-3 py-1.5 text-xs"
                                onClick={() => startEditCamp(camp)}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="danger"
                                className="px-3 py-1.5 text-xs"
                                onClick={() => handleDeleteCamp(camp)}
                              >
                                Delete
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </DesktopTable>

                  <Pagination
                    page={campPage}
                    totalPages={campTotalPages}
                    totalItems={campTotalItems}
                    start={campStart}
                    end={campEnd}
                    onPageChange={setCampPage}
                  />
                </>
                  )}
                </>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
