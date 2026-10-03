import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Animal, Encampment, FarmLocation } from '../../lib/types'
import { animalLabel, deleteAnimal, formatAnimalSex, formatAnimalStatus } from '../../lib/animals'
import { animalPlaceLabel, encampmentLabel, locationLabel } from '../../lib/locations'
import { AnimalPhotosPanel } from '../../components/animals/AnimalPhotosPanel'
import { AnimalInoculationsPanel } from '../../components/animals/AnimalInoculationsPanel'
import { AnimalBreedingPanel } from '../../components/animals/AnimalBreedingPanel'
import { AnimalPrintCard } from '../../components/animals/AnimalPrintCard'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/layout/AppShell'

export function AnimalDetailPage() {
  const { animalId } = useParams<{ animalId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [animal, setAnimal] = useState<Animal | null>(null)
  const [herdAnimals, setHerdAnimals] = useState<Animal[]>([])
  const [locations, setLocations] = useState<FarmLocation[]>([])
  const [encampments, setEncampments] = useState<Encampment[]>([])
  const [locationId, setLocationId] = useState('')
  const [encampmentId, setEncampmentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingPlace, setSavingPlace] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadAnimal = async () => {
    if (!animalId || !profile?.company_id) return

    setLoading(true)
    const [animalRes, locationsRes, encampmentsRes, herdRes] = await Promise.all([
      supabase
        .from('animals')
        .select('*, encampments(id, name, location_id, locations(id, name))')
        .eq('id', animalId)
        .eq('company_id', profile.company_id)
        .maybeSingle(),
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
        .select('*')
        .eq('company_id', profile.company_id)
        .order('tag_number', { ascending: true }),
    ])

    if (animalRes.error) setError(animalRes.error.message)
    else if (!animalRes.data) setError('Animal not found.')
    else {
      setAnimal(animalRes.data)
      const camp = animalRes.data.encampments
      setEncampmentId(animalRes.data.encampment_id ?? '')
      setLocationId(camp?.location_id ?? '')
    }

    if (locationsRes.error) setError(locationsRes.error.message)
    else setLocations(locationsRes.data ?? [])

    if (encampmentsRes.error) setError(encampmentsRes.error.message)
    else setEncampments(encampmentsRes.data ?? [])

    if (herdRes.error) setError(herdRes.error.message)
    else setHerdAnimals(herdRes.data ?? [])

    setLoading(false)
  }

  useEffect(() => {
    loadAnimal()
  }, [animalId, profile?.company_id])

  const campsForLocation = useMemo(
    () => encampments.filter((e) => e.location_id === locationId),
    [encampments, locationId],
  )

  const placeDisplay = animal
    ? animalPlaceLabel({
        encampment: animal.encampments,
        location: animal.encampments?.locations,
        legacyLocation: animal.location,
      })
    : '—'

  const handleDeleteAnimal = async () => {
    if (!animal) return
    const label = animalLabel(animal)
    if (
      !window.confirm(
        `Delete ${label}? Photos and inoculations for this animal will also be removed.`,
      )
    ) {
      return
    }

    setDeleting(true)
    setError('')
    try {
      await deleteAnimal(animal)
      navigate('/app/animals', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete animal')
      setDeleting(false)
    }
  }

  const handleSavePlace = async (e: FormEvent) => {
    e.preventDefault()
    if (!animal || !profile?.company_id) return

    setSavingPlace(true)
    setError('')
    setSuccess('')

    const selectedLocation = locations.find((l) => l.id === locationId)
    const selectedCamp = encampments.find((c) => c.id === encampmentId)
    const label = animalPlaceLabel({
      location: selectedLocation,
      encampment: selectedCamp,
    })

    const { error: updateError } = await supabase
      .from('animals')
      .update({
        encampment_id: encampmentId || null,
        location: label === '—' ? null : label,
      })
      .eq('id', animal.id)

    if (updateError) {
      setError(updateError.message)
      setSavingPlace(false)
      return
    }

    setSuccess('Living place updated.')
    await loadAnimal()
    setSavingPlace(false)
  }

  if (loading) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <PageHeader title="Animal" />
        <Card>
          <p className="text-sm text-soil-500">Loading animal...</p>
        </Card>
      </div>
    )
  }

  if (error && !animal) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <PageHeader title="Animal" />
        <Card>
          <p className="text-sm text-red-600">{error}</p>
          <Link to="/app/animals" className="mt-4 inline-block">
            <Button variant="secondary">Back to animals</Button>
          </Link>
        </Card>
      </div>
    )
  }

  if (!animal || !profile?.company_id) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <PageHeader title="Animal" />
        <Card>
          <p className="text-sm text-red-600">Animal not found.</p>
          <Link to="/app/animals" className="mt-4 inline-block">
            <Button variant="secondary">Back to animals</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title={animalLabel(animal)}
          description="Photos, living place, and family links for this animal."
        />
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row print:hidden">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => window.print()}
          >
            Print / PDF card
          </Button>
          <Link to={`/app/family-trees?animal=${animal.id}`}>
            <Button variant="secondary" className="w-full sm:w-auto">
              Family tree
            </Button>
          </Link>
          <Link to="/app/animals">
            <Button variant="secondary" className="w-full sm:w-auto">
              All animals
            </Button>
          </Link>
          <Button
            variant="danger"
            className="w-full sm:w-auto"
            disabled={deleting}
            onClick={handleDeleteAnimal}
          >
            {deleting ? 'Deleting...' : 'Delete animal'}
          </Button>
        </div>
      </div>

      <AnimalPrintCard animal={animal} herdAnimals={herdAnimals} placeDisplay={placeDisplay} />

      <Card className="print:hidden">
        <h3 className="font-display font-semibold text-pasture-900">Details</h3>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Tag', value: animal.tag_number ?? '—' },
            { label: 'Stud tag', value: animal.stud_tag_number ?? '—' },
            { label: 'Name', value: animal.name ?? '—' },
            { label: 'Breed', value: animal.breed ?? '—' },
            { label: 'Sex', value: formatAnimalSex(animal.sex) },
            { label: 'Status', value: formatAnimalStatus(animal.status) },
            { label: 'Birth date', value: animal.birth_date ?? '—' },
            { label: 'Lives at', value: placeDisplay },
            { label: 'Color / markings', value: animal.color_markings ?? '—' },
          ].map((field) => (
            <div key={field.label} className="section-inset rounded-xl px-3 py-2.5">
              <dt className="text-xs font-semibold uppercase tracking-wide text-soil-500">
                {field.label}
              </dt>
              <dd className="mt-0.5 text-sm font-medium text-soil-800">{field.value}</dd>
            </div>
          ))}
        </dl>
        {animal.notes && (
          <p className="mt-4 text-sm text-soil-600">
            <span className="font-semibold text-soil-700">Notes: </span>
            {animal.notes}
          </p>
        )}
      </Card>

      <Card className="print:hidden">
        <h3 className="font-display font-semibold text-pasture-900">Living place</h3>
        <p className="mt-1 text-sm text-soil-500">
          Assign this animal to a location and encampment.
        </p>
        <form onSubmit={handleSavePlace} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="Location"
            id="detail-location"
            value={locationId}
            onChange={(e) => {
              setLocationId(e.target.value)
              setEncampmentId('')
            }}
          >
            <option value="">Not assigned</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {locationLabel(location)}
              </option>
            ))}
          </Select>
          <Select
            label="Encampment"
            id="detail-encampment"
            value={encampmentId}
            onChange={(e) => setEncampmentId(e.target.value)}
            disabled={!locationId}
          >
            <option value="">{locationId ? 'Not assigned' : 'Select a location first'}</option>
            {campsForLocation.map((camp) => (
              <option key={camp.id} value={camp.id}>
                {encampmentLabel(camp)}
              </option>
            ))}
          </Select>
          <div className="md:col-span-2">
            <Button type="submit" disabled={savingPlace} className="w-full sm:w-auto">
              {savingPlace ? 'Saving...' : 'Save living place'}
            </Button>
          </div>
        </form>
        {locations.length === 0 && (
          <p className="mt-3 text-sm text-soil-500">
            <Link to="/app/locations" className="font-semibold text-pasture-800 hover:text-pasture-700">
              Set up locations
            </Link>{' '}
            first, then add encampments.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-3 text-sm text-pasture-800">{success}</p>}
      </Card>

      <div className="print:hidden">
        <AnimalBreedingPanel
          animal={animal}
          companyId={profile.company_id}
          userId={profile.id}
          herdAnimals={herdAnimals}
        />
      </div>

      <div className="print:hidden">
        <AnimalInoculationsPanel
          animalId={animal.id}
          companyId={profile.company_id}
          userId={profile.id}
        />
      </div>

      <div className="print:hidden">
        <AnimalPhotosPanel animalId={animal.id} companyId={profile.company_id} userId={profile.id} />
      </div>
    </div>
  )
}
