import type { Encampment, FarmLocation } from './types'

export function locationLabel(location: Pick<FarmLocation, 'name'> | null | undefined) {
  return location?.name?.trim() || 'Unnamed location'
}

export function encampmentLabel(encampment: Pick<Encampment, 'name'> | null | undefined) {
  return encampment?.name?.trim() || 'Unnamed camp'
}

export function animalPlaceLabel(params: {
  encampment?: Pick<Encampment, 'name'> | null
  location?: Pick<FarmLocation, 'name'> | null
  legacyLocation?: string | null
}) {
  if (params.location && params.encampment) {
    return `${locationLabel(params.location)} · ${encampmentLabel(params.encampment)}`
  }
  if (params.encampment) return encampmentLabel(params.encampment)
  if (params.location) return locationLabel(params.location)
  return params.legacyLocation?.trim() || '—'
}
