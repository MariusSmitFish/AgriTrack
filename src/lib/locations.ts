import type { Animal, Encampment, FarmLocation } from './types'

type Named = { name?: string | null }
type PlaceCamp = Pick<Encampment, 'id' | 'name' | 'location_id'>
type PlaceLocation = Pick<FarmLocation, 'id' | 'name'>

function firstNamed<T extends Named>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value.find((item) => item?.name?.trim()) ?? value[0] ?? null
  return value ?? null
}

export function locationLabel(location: Pick<FarmLocation, 'name'> | null | undefined) {
  return location?.name?.trim() || 'Unnamed location'
}

export function encampmentLabel(encampment: Pick<Encampment, 'name'> | null | undefined) {
  return encampment?.name?.trim() || 'Unnamed camp'
}

export function animalPlaceLabel(params: {
  encampment?: Pick<Encampment, 'name'> | Pick<Encampment, 'name'>[] | null
  location?: Pick<FarmLocation, 'name'> | Pick<FarmLocation, 'name'>[] | null
  legacyLocation?: string | null
}) {
  const encampment = firstNamed(params.encampment)
  const location = firstNamed(params.location)
  const locationName = location?.name?.trim() || ''
  const campName = encampment?.name?.trim() || ''
  const legacy = params.legacyLocation?.trim() || ''

  if (locationName && campName) return `${locationName} · ${campName}`
  if (legacy) return legacy
  if (campName) return campName
  if (locationName) return locationName
  return '—'
}

function splitPlaceLabel(label: string): [string, string | null] {
  const parts = label.split(' · ')
  if (parts.length < 2) return [label.trim(), null]
  const campName = parts.pop()?.trim() || null
  return [parts.join(' · ').trim(), campName]
}

export function resolveAnimalPlace(
  animal: Pick<Animal, 'encampment_id' | 'location' | 'encampments'>,
  locations: PlaceLocation[],
  encampments: PlaceCamp[],
) {
  const embedded = firstNamed(animal.encampments)
  const camp =
    encampments.find((item) => item.id === animal.encampment_id) ??
    (embedded?.id ? (encampments.find((item) => item.id === embedded.id) ?? embedded) : null)

  const embeddedLocation = firstNamed(embedded?.locations)
  let location =
    locations.find((item) => item.id === camp?.location_id) ??
    (embeddedLocation?.id
      ? (locations.find((item) => item.id === embeddedLocation.id) ?? embeddedLocation)
      : null)

  const legacy = animal.location?.trim() ?? ''
  if (!location && legacy) {
    const [locationName, campName] = splitPlaceLabel(legacy)
    location = locations.find((item) => item.name.trim() === locationName) ?? null
    if (!camp && location && campName) {
      const matched = encampments.find(
        (item) => item.location_id === location?.id && item.name.trim() === campName,
      )
      if (matched) return { location, camp: matched }
    }
  }

  return { location: location ?? null, camp: camp ?? null }
}
